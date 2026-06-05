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
import { useWorkspaceStore } from "../stores/workspaceStore";
import { showNotification, canNotify } from "./notifications";

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
  access_status: "early_access" | "approved" | "rejected";
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

// Reject / revoke a user's access (blocks them from using the app, even if they
// were previously approved). A direct update guarded by the "Admins can update
// any profile" RLS policy — no Edge Function needed.
export async function rejectUser(userId: string): Promise<boolean> {
  if (!canSync()) return false;
  try {
    const { error } = await getSupabase()
      .from("profiles")
      .update({ access_status: "rejected" })
      .eq("id", userId);
    return !error;
  } catch {
    return false;
  }
}

// Notify a mentioned teammate. Direct insert into notifications, guarded by the
// "Members can notify co-members" RLS policy — no Edge Function needed. Resolves
// the recipient's auth id from workspace_members (by name, then email).
export async function notifyMention(
  workspaceId: string,
  memberName: string,
  taskTitle: string,
  taskId: string,
  memberEmail?: string
) {
  if (!canSync()) return;
  try {
    const sb = getSupabase();
    const me = useAuthStore.getState().user;
    let userId: string | null = null;

    const byName = await sb
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .ilike("name", memberName)
      .not("user_id", "is", null)
      .maybeSingle();
    userId = (byName.data?.user_id as string | undefined) ?? null;

    if (!userId && memberEmail) {
      const byEmail = await sb
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .ilike("email", memberEmail)
        .not("user_id", "is", null)
        .maybeSingle();
      userId = (byEmail.data?.user_id as string | undefined) ?? null;
    }

    if (!userId || userId === me?.id) return; // unknown, or it's me
    await sb.from("notifications").insert({
      id: crypto.randomUUID(),
      recipient_id: userId,
      type: "mention",
      title: `You were mentioned in "${taskTitle || "a task"}"`,
      task_id: taskId || null,
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

// ─── Leaving a shared workspace: remove my own member row ────────────
export async function leaveWorkspaceServer(workspaceId: string) {
  if (!canSync()) return;
  const u = useAuthStore.getState().user!;
  try {
    await getSupabase()
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", u.id);
  } catch {
    /* best-effort */
  }
}

// ─── Join requests (request-to-join + admin approval) ───────────────
export type JoinRequest = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

// A user asks to join a workspace by its code/id.
export async function requestToJoinWorkspace(workspaceId: string): Promise<{ ok: boolean; error?: string }> {
  if (!canSync()) return { ok: false, error: "offline" };
  const u = useAuthStore.getState().user;
  if (!u || u.id === "guest") return { ok: false, error: "not signed in" };
  try {
    const { error } = await getSupabase()
      .from("workspace_join_requests")
      .upsert(
        {
          workspace_id: workspaceId.trim(),
          user_id: u.id,
          name: u.name ?? u.email ?? "",
          email: u.email ?? "",
          status: "pending",
        },
        { onConflict: "workspace_id,user_id" }
      );
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Admin: list pending requests (RLS returns only ones for workspaces I own).
export async function fetchJoinRequests(): Promise<JoinRequest[]> {
  if (!canSync()) return [];
  const u = useAuthStore.getState().user;
  try {
    const { data } = await getSupabase()
      .from("workspace_join_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    // Exclude my own outgoing requests — the admin view is incoming requests.
    return ((data as JoinRequest[]) ?? []).filter((r) => r.user_id !== u?.id);
  } catch {
    return [];
  }
}

// Admin approves: add the requester as a member + mark approved + ping them.
export async function approveJoinRequest(req: JoinRequest): Promise<boolean> {
  if (!canSync()) return false;
  try {
    const sb = getSupabase();
    await sb.from("workspace_members").upsert({
      id: `${req.workspace_id}:${req.user_id}`,
      workspace_id: req.workspace_id,
      user_id: req.user_id,
      name: req.name ?? req.email ?? "Member",
      email: req.email ?? "",
      role: "member",
    });
    await sb.from("workspace_join_requests").update({ status: "approved" }).eq("id", req.id);
    // They now share the workspace → allowed to notify them of acceptance.
    await sb.from("notifications").insert({
      id: crypto.randomUUID(),
      recipient_id: req.user_id,
      type: "info",
      title: "Your request to join a workspace was approved 🎉",
    });
    return true;
  } catch {
    return false;
  }
}

export async function rejectJoinRequest(reqId: string): Promise<boolean> {
  if (!canSync()) return false;
  try {
    await getSupabase().from("workspace_join_requests").update({ status: "rejected" }).eq("id", reqId);
    return true;
  } catch {
    return false;
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
let notifReconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
          // Browser popup for new (INSERT) notifications only
          if (p.eventType === "INSERT" && canNotify()) {
            const kindMap: Record<string, "task" | "mention" | "invite"> = {
              assignment: "task",
              mention: "mention",
              workspace_invite: "invite",
            };
            const kind = kindMap[row.type];
            if (kind) {
              showNotification(row.title, row.body ?? "", { kind, tag: row.id });
            }
          }
        }
      }
    )
    .subscribe((status: string) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (notifReconnectTimer) clearTimeout(notifReconnectTimer);
        notifReconnectTimer = setTimeout(() => {
          notifReconnectTimer = null;
          void startNotifications();
        }, 5_000);
      }
    });
}

export function stopNotifications() {
  if (notifReconnectTimer) {
    clearTimeout(notifReconnectTimer);
    notifReconnectTimer = null;
  }
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
  attachments: c.attachments ?? null,
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
  attachments: (r.attachments as TaskComment["attachments"]) ?? undefined,
  created_at: r.created_at as string,
});

// Upload a base64 attachment to Storage (reuses the public canvas-media bucket)
// → returns a public URL. Falls back to the original data URL on failure.
async function uploadAttachment(dataUrl: string, commentId: string, idx: number): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  try {
    const sb = getSupabase();
    const [meta, b64] = dataUrl.split(",");
    const mime = meta.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
    const ext = (mime.split("/")[1] ?? "bin").split("+")[0];
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const path = `comments/${commentId}-${idx}.${ext}`;
    const { error } = await sb.storage.from("canvas-media").upload(path, bytes, { contentType: mime, upsert: true });
    if (error) return dataUrl;
    return sb.storage.from("canvas-media").getPublicUrl(path).data.publicUrl;
  } catch {
    return dataUrl;
  }
}

export async function pushComment(c: TaskComment) {
  if (!canSync()) return;
  try {
    let attachments = c.attachments;
    // Upload any base64 media to Storage and keep only the URL — never store
    // big base64 blobs in Postgres (and swap the local copy to the URL too).
    if (attachments?.some((a) => a.src.startsWith("data:"))) {
      attachments = await Promise.all(
        attachments.map(async (a, i) =>
          a.src.startsWith("data:") ? { ...a, src: await uploadAttachment(a.src, c.id, i) } : a
        )
      );
      useTasksStore.getState().upsertComment({ ...c, attachments });
    }
    const row = commentToRow({ ...c, attachments });
    const { error } = await getSupabase().from("task_comments").upsert(row);
    if (error && (error as { code?: string }).code === "PGRST204") {
      // task_comments.attachments column not added yet → keep text sync working.
      const legacy = { ...row } as Record<string, unknown>;
      delete legacy.attachments;
      await getSupabase().from("task_comments").upsert(legacy as typeof row);
    }
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

// Inbox activity feed: pull the most recent comments across ALL of my
// workspaces (not just the task that's open) so the Inbox can show team
// conversations ordered by recency. Merges into the local comments store.
export async function fetchRecentActivity(limit = 80): Promise<void> {
  if (!canSync()) return;
  const wsIds = useWorkspaceStore.getState().workspaces.map((w) => w.id);
  if (!wsIds.length) return;
  try {
    const { data } = await getSupabase()
      .from("task_comments")
      .select("*")
      .in("workspace_id", wsIds)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data) {
      const upsert = useTasksStore.getState().upsertComment;
      (data as Record<string, unknown>[]).forEach((r) => upsert(commentFromRow(r)));
    }
  } catch {
    /* ignore */
  }
}

// Load a task's comments from the server and subscribe to live changes while
// the task drawer is open. Returns an unsubscribe function.
// Uses a locally-scoped channel (keyed by taskId) to avoid singleton leaks
// when multiple task drawers are opened in rapid succession.
export function watchTaskComments(taskId: string): () => void {
  if (!canSync()) return () => {};
  const sb = getSupabase();
  const upsert = useTasksStore.getState().upsertComment;

  void sb
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .then(({ data }) => data?.forEach((r) => upsert(commentFromRow(r as Record<string, unknown>))));

  const ch = sb
    .channel("comments:" + taskId + ":" + Date.now())
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
    try { sb.removeChannel(ch); } catch { /* ignore */ }
  };
}
