// =========================================================================
// Heed — team collaboration sync (notifications + invites + mentions)
// =========================================================================
// Cross-user delivery via Supabase. Every call is a no-op for guests or when
// Supabase isn't configured, so the app keeps working fully offline/local.
// Requires the migration `20260602000001_team_collab.sql` and the Edge
// Functions in `supabase/functions/*` to be deployed.
// =========================================================================
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { useAuthStore } from "../stores/authStore";
import { useNotificationsStore, type AppNotification } from "../stores/notificationsStore";
import { useTasksStore, type TaskComment } from "../stores/tasksStore";

const canSync = () => {
  if (!isSupabaseConfigured()) return false;
  const u = useAuthStore.getState().user;
  return Boolean(u && u.id !== "guest");
};

// Map a Supabase notifications row → local AppNotification.
type Row = {
  id: string;
  type: AppNotification["type"];
  title: string;
  body: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  workspace_color: string | null;
  task_id: string | null;
  read: boolean;
  created_at: string;
};
const fromRow = (r: Row): AppNotification => ({
  id: r.id,
  type: r.type,
  title: r.title,
  body: r.body ?? undefined,
  created_at: r.created_at,
  read: r.read,
  taskId: r.task_id ?? undefined,
  workspace:
    r.workspace_id && r.workspace_name
      ? { id: r.workspace_id, name: r.workspace_name, color: r.workspace_color ?? "#6735E1" }
      : undefined,
});

// ─── Invites & mentions (via Edge Functions) ─────────────────────────
export async function inviteMember(
  email: string,
  workspace: { id: string; name: string; color: string },
  inviterName: string
) {
  if (!canSync()) return;
  try {
    await getSupabase().functions.invoke("invite-member", {
      body: {
        email,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        workspaceColor: workspace.color,
        inviterName,
      },
    });
  } catch {
    /* best-effort */
  }
}

export type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  access_status: "early_access" | "approved";
  created_at: string;
};

// Admin dashboard: list all users, and approve early-access ones (the Edge
// Functions enforce that the caller is in ADMIN_EMAILS).
export async function listUsers(): Promise<AdminUser[]> {
  if (!canSync()) return [];
  try {
    const { data } = await getSupabase().functions.invoke("list-users");
    return (data?.users as AdminUser[]) ?? [];
  } catch {
    return [];
  }
}

export async function approveUser(userId: string): Promise<boolean> {
  if (!canSync()) return false;
  try {
    const { error } = await getSupabase().functions.invoke("approve-access", { body: { userId } });
    return !error;
  } catch {
    return false;
  }
}

export async function notifyMention(
  workspaceId: string,
  memberName: string,
  taskTitle: string,
  taskId: string
) {
  if (!canSync()) return;
  try {
    await getSupabase().functions.invoke("notify-mention", {
      body: { workspaceId, memberName, taskTitle, taskId },
    });
  } catch {
    /* best-effort */
  }
}

// ─── Accepting an invite: join the workspace's member row ────────────
export async function acceptInviteServer(workspaceId: string) {
  if (!canSync()) return;
  const u = useAuthStore.getState().user!;
  try {
    const sb = getSupabase();
    // Link this user into the workspace members so RLS grants access.
    await sb.from("workspace_members").upsert({
      id: `${workspaceId}:${u.id}`,
      workspace_id: workspaceId,
      user_id: u.id,
      name: u.name ?? u.email ?? "Member",
      email: u.email ?? "",
      role: "member",
    });
  } catch {
    /* best-effort */
  }
}

export async function markNotificationReadServer(id: string) {
  if (!canSync()) return;
  try {
    await getSupabase().from("notifications").update({ read: true }).eq("id", id);
  } catch {
    /* ignore */
  }
}

export async function removeNotificationServer(id: string) {
  if (!canSync()) return;
  try {
    await getSupabase().from("notifications").delete().eq("id", id);
  } catch {
    /* ignore */
  }
}

// ─── Pull + realtime subscribe (call on login) ───────────────────────
let channel: RealtimeChannel | null = null;

export async function startNotifications() {
  if (!canSync()) return;
  const u = useAuthStore.getState().user!;
  const sb = getSupabase();

  // Initial pull.
  try {
    const { data } = await sb
      .from("notifications")
      .select("*")
      .eq("recipient_id", u.id)
      .order("created_at", { ascending: false });
    if (data) useNotificationsStore.setState({ notifications: (data as Row[]).map(fromRow) });
  } catch {
    /* ignore */
  }

  // Realtime: new notifications land in the bell instantly.
  stopNotifications();
  channel = sb
    .channel("notifications:" + u.id)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${u.id}` },
      (p) => {
        const s = useNotificationsStore.getState();
        if (p.eventType === "DELETE") {
          useNotificationsStore.setState({
            notifications: s.notifications.filter((n) => n.id !== (p.old as { id: string }).id),
          });
        } else {
          const row = fromRow(p.new as Row);
          const rest = s.notifications.filter((n) => n.id !== row.id);
          useNotificationsStore.setState({ notifications: [row, ...rest] });
        }
      }
    )
    .subscribe();
}

export function stopNotifications() {
  if (channel) {
    try {
      getSupabase().removeChannel(channel);
    } catch {
      /* ignore */
    }
    channel = null;
  }
}

// ─── Task comments (cross-device) ────────────────────────────────────
const commentToRow = (c: TaskComment) => ({
  id: c.id,
  task_id: c.task_id,
  workspace_id: c.workspace_id,
  author_id: c.author_id === "guest" ? null : c.author_id,
  author_name: c.author_name,
  author_avatar: c.author_avatar ?? null,
  body: c.body,
  created_at: c.created_at,
});
const commentFromRow = (r: Record<string, unknown>): TaskComment => ({
  id: r.id as string,
  task_id: r.task_id as string,
  workspace_id: r.workspace_id as string,
  author_id: (r.author_id as string) ?? "",
  author_name: r.author_name as string,
  author_avatar: (r.author_avatar as string) ?? null,
  body: r.body as string,
  created_at: r.created_at as string,
});

export async function pushComment(c: TaskComment) {
  if (!canSync()) return;
  try {
    await getSupabase().from("task_comments").upsert(commentToRow(c));
  } catch {
    /* ignore */
  }
}

export async function removeCommentServer(id: string) {
  if (!canSync()) return;
  try {
    await getSupabase().from("task_comments").delete().eq("id", id);
  } catch {
    /* ignore */
  }
}

let commentsChannel: RealtimeChannel | null = null;

// Load a task's comments from the server and subscribe to live changes while
// the task drawer is open. Returns an unsubscribe function.
export function watchTaskComments(taskId: string): () => void {
  if (!canSync()) return () => {};
  const sb = getSupabase();
  const upsert = useTasksStore.getState().upsertComment;

  void sb
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .then(({ data }) => data?.forEach((r) => upsert(commentFromRow(r as Record<string, unknown>))));

  commentsChannel = sb
    .channel("comments:" + taskId)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
      (p) => {
        if (p.eventType === "DELETE") {
          useTasksStore.getState().deleteComment((p.old as { id: string }).id);
        } else {
          upsert(commentFromRow(p.new as Record<string, unknown>));
        }
      }
    )
    .subscribe();

  return () => {
    if (commentsChannel) {
      try {
        sb.removeChannel(commentsChannel);
      } catch {
        /* ignore */
      }
      commentsChannel = null;
    }
  };
}
