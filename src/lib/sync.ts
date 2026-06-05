// =========================================================================
// Heed — Supabase sync layer
// =========================================================================
// Optimistic + realtime sync between Zustand stores and Supabase.
//
//   • Local mutation → push to Supabase (fire-and-forget upsert)
//   • Realtime postgres_changes → patch the local store
//   • Initial pull on login replaces local state with server snapshot
//   • Per-row last-write-wins (updated_at). Collections merge naturally
//     because each row has its own PK + realtime channel.
//
// All push/delete calls are no-ops for guests or when Supabase is
// unconfigured, so the store API works identically in offline mode.
// =========================================================================

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from "./supabase";
import { useAuthStore } from "../stores/authStore";
import { useTasksStore, type Task, type Project, type Category, type Tag } from "../stores/tasksStore";
import { useWorkspaceStore, type Workspace, type WorkspaceMember } from "../stores/workspaceStore";
import { useScheduleStore, type ScheduledPost } from "../stores/scheduleStore";
import { useMeetingsStore, type Meeting } from "../stores/meetingsStore";
import { useSyncStatusStore } from "../stores/syncStatusStore";
import type { Database } from "../types/database";

type Tables = Database["public"]["Tables"];

// ─── Guard: only sync when signed into Supabase ──────────────────────
const canSync = () => {
  if (!isSupabaseConfigured()) return false;
  const u = useAuthStore.getState().user;
  return Boolean(u && u.id !== "guest");
};

// =========================================================================
// MAPPERS — Zustand row ↔ Supabase row
// =========================================================================

// ─── tasks ───────────────────────────────────────────────────────────
const taskToDb = (t: Task): Tables["tasks"]["Insert"] => ({
  id: t.id,
  workspace_id: t.workspace_id,
  project_id: t.project_id,
  category_id: t.category_id,
  title: t.title,
  notes: t.notes,
  tag_ids: t.tag_ids,
  priority: t.priority,
  status: t.status,
  column: t.column,
  position: t.position,
  estimated_minutes: t.estimated_minutes,
  actual_minutes: t.actual_minutes,
  deadline: t.deadline,
  start_date: t.start_date ?? null,
  workflow_status: t.workflow_status ?? null,
  assignee_id: t.assignee_id ?? null,
  recurrence: (t.recurrence ?? "none") as Tables["tasks"]["Insert"]["recurrence"],
  video_stage: t.video_stage,
  links: t.links,
  completed_at: t.completed_at,
  created_at: t.created_at,
  updated_at: t.updated_at,
});

const taskFromDb = (r: Tables["tasks"]["Row"]): Task => ({
  id: r.id,
  workspace_id: r.workspace_id,
  project_id: r.project_id,
  category_id: r.category_id,
  title: r.title,
  notes: r.notes,
  tag_ids: r.tag_ids ?? [],
  priority: r.priority,
  status: r.status,
  column: r.column,
  position: r.position,
  estimated_minutes: r.estimated_minutes,
  actual_minutes: r.actual_minutes,
  deadline: r.deadline,
  start_date: r.start_date ?? null,
  workflow_status: r.workflow_status ?? undefined,
  assignee_id: r.assignee_id ?? null,
  recurrence: (r.recurrence as Task["recurrence"]) ?? "none",
  video_stage: r.video_stage,
  links: r.links ?? [],
  completed_at: r.completed_at,
  created_at: r.created_at,
  updated_at: r.updated_at,
});

// ─── projects ────────────────────────────────────────────────────────
const projectToDb = (p: Project, position: number) => ({
  id: p.id,
  workspace_id: p.workspace_id,
  name: p.name,
  color: p.color,
  icon: p.icon,
  icon_url: p.iconUrl ?? null,
  type: p.type,
  description: p.description ?? null, // column added in 20260605000006_project_description.sql
  shared_workspace_ids: p.shared_workspace_ids ?? [],
  position,
  created_at: p.created_at,
} as unknown as Tables["projects"]["Insert"]);

const projectFromDb = (r: Tables["projects"]["Row"] & { description?: string | null }): Project => ({
  id: r.id,
  workspace_id: r.workspace_id,
  name: r.name,
  color: r.color,
  icon: r.icon,
  iconUrl: r.icon_url,
  type: r.type,
  description: r.description ?? undefined,
  shared_workspace_ids: r.shared_workspace_ids ?? [],
  created_at: r.created_at,
});

// ─── categories ──────────────────────────────────────────────────────
const categoryToDb = (c: Category, workspace_id: string): Tables["categories"]["Insert"] => ({
  id: c.id,
  workspace_id,
  name: c.name,
  color: c.color,
  type: c.type,
  description: c.description ?? null,
});

const categoryFromDb = (r: Tables["categories"]["Row"]): Category => ({
  id: r.id,
  name: r.name,
  color: r.color,
  type: r.type,
  description: r.description ?? undefined,
});

// ─── tags ────────────────────────────────────────────────────────────
const tagToDb = (t: Tag, workspace_id: string): Tables["tags"]["Insert"] => ({
  id: t.id,
  workspace_id,
  name: t.name,
  color: t.color,
  description: t.description ?? null,
});

const tagFromDb = (r: Tables["tags"]["Row"]): Tag => ({
  id: r.id,
  name: r.name,
  color: r.color,
  description: r.description ?? undefined,
});

// ─── workspaces ──────────────────────────────────────────────────────
const workspaceToDb = (w: Workspace, ownerId: string): Tables["workspaces"]["Insert"] => ({
  id: w.id,
  owner_id: ownerId,
  name: w.name,
  type: w.type,
  color: w.color,
  member_count: w.memberCount,
});

const workspaceFromDb = (
  r: Tables["workspaces"]["Row"],
  members: WorkspaceMember[]
): Workspace => ({
  id: r.id,
  name: r.name,
  type: r.type,
  color: r.color,
  memberCount: r.member_count,
  members,
});

const memberToDb = (
  m: WorkspaceMember,
  workspace_id: string
): Tables["workspace_members"]["Insert"] => ({
  id: m.id,
  workspace_id,
  user_id: null,
  name: m.name,
  email: m.email,
  role: m.role,
  added_at: m.addedAt,
});

const memberFromDb = (r: Tables["workspace_members"]["Row"]): WorkspaceMember => ({
  id: r.id,
  name: r.name,
  email: r.email ?? "",
  role: r.role,
  addedAt: r.added_at,
});

// ─── schedule posts ──────────────────────────────────────────────────
const postToDb = (p: ScheduledPost): Tables["schedule_posts"]["Insert"] => ({
  id: p.id,
  workspace_id: p.workspace_id,
  task_id: p.taskId,
  title: p.title,
  notes: p.notes,
  platforms: p.platforms,
  tags: p.tags,
  links: p.links,
  scheduled_date: p.scheduledDate,
  scheduled_time: p.scheduledTime,
  column: p.column,
  position: p.position,
  preview_image_url: p.previewImageUrl,
  created_at: p.createdAt,
});

const postFromDb = (r: Tables["schedule_posts"]["Row"]): ScheduledPost => ({
  id: r.id,
  workspace_id: r.workspace_id,
  taskId: r.task_id,
  title: r.title,
  notes: r.notes,
  platforms: r.platforms ?? [],
  tags: r.tags ?? [],
  links: r.links ?? [],
  scheduledDate: r.scheduled_date,
  scheduledTime: r.scheduled_time,
  column: r.column,
  position: r.position,
  previewImageUrl: r.preview_image_url,
  createdAt: r.created_at,
});

// ─── meetings ────────────────────────────────────────────────────────
const meetingToDb = (m: Meeting): Tables["meetings"]["Insert"] => ({
  id: m.id,
  workspace_id: m.workspace_id,
  title: m.title,
  date: m.date,
  time: m.time,
  duration_minutes: m.duration_minutes,
  location: m.location,
  notes: m.notes,
  attendees: m.attendees ?? [],
  meeting_link: m.meetingLink ?? null,
  source: m.source,
  external_id: m.externalId,
  created_at: m.createdAt,
});

const meetingFromDb = (r: Tables["meetings"]["Row"]): Meeting => ({
  id: r.id,
  workspace_id: r.workspace_id,
  title: r.title,
  date: r.date,
  time: r.time,
  duration_minutes: r.duration_minutes,
  location: r.location,
  notes: r.notes,
  attendees: r.attendees ?? [],
  meetingLink: r.meeting_link,
  source: r.source,
  externalId: r.external_id,
  createdAt: r.created_at,
});

// =========================================================================
// PUSH — fire-and-forget upserts (called from store mutations)
// =========================================================================

const swallow = (op: string) => (e: unknown) => {
  // eslint-disable-next-line no-console
  console.warn(`[sync] ${op} failed:`, (e as Error)?.message ?? e);
};

// Wrap a Supabase builder so the SyncStatus store reflects pending operations.
const track = <T extends { error: unknown }>(op: string, p: PromiseLike<T>) => {
  void useSyncStatusStore.getState().trackPending(
    Promise.resolve(p).then((r) => {
      if (r.error) swallow(op)(r.error);
      return r;
    })
  );
};

// ─── notify-task fire-and-forget helper ──────────────────────────────────────
export function notifyTaskAssigned(
  assigneeId: string,
  assignerName: string,
  taskTitle: string,
  taskId: string
): void {
  if (!supabaseUrl || !supabaseAnonKey) return;
  void fetch(`${supabaseUrl}/functions/v1/notify-task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ assigneeId, assignerName, taskTitle, taskId }),
  }).catch((err) => console.warn("[sync] notify-task failed:", err));
}

export const pushTask = (t: Task) => {
  if (!canSync()) return;
  const row = taskToDb(t);
  void useSyncStatusStore.getState().trackPending(
    Promise.resolve(getSupabase().from("tasks").upsert(row)).then(async (r) => {
      // Older databases may not have the start_date / workflow_status /
      // assignee_id columns yet (PostgREST schema-cache miss → PGRST204). Retry
      // without them so basic task sync keeps working until the migration runs.
      if (r.error && (r.error as { code?: string }).code === "PGRST204") {
        const legacy = { ...row } as Record<string, unknown>;
        delete legacy.start_date;
        delete legacy.workflow_status;
        delete legacy.assignee_id;
        delete legacy.recurrence;
        const r2 = await getSupabase().from("tasks").upsert(legacy as typeof row);
        if (r2.error) swallow("pushTask")(r2.error);
        return r2;
      }
      if (r.error) swallow("pushTask")(r.error);
      return r;
    })
  );
};

export const deleteTask = (id: string) => {
  if (!canSync()) return;
  track("deleteTask", getSupabase().from("tasks").delete().eq("id", id));
};

export const pushProject = (p: Project, position: number) => {
  if (!canSync()) return;
  track("pushProject", getSupabase().from("projects").upsert(projectToDb(p, position)));
};

export const deleteProject = (id: string) => {
  if (!canSync()) return;
  track("deleteProject", getSupabase().from("projects").delete().eq("id", id));
};

export const pushCategory = (c: Category, workspace_id: string) => {
  if (!canSync()) return;
  track("pushCategory", getSupabase().from("categories").upsert(categoryToDb(c, workspace_id)));
};

export const deleteCategory = (id: string) => {
  if (!canSync()) return;
  track("deleteCategory", getSupabase().from("categories").delete().eq("id", id));
};

export const pushTag = (t: Tag, workspace_id: string) => {
  if (!canSync()) return;
  track("pushTag", getSupabase().from("tags").upsert(tagToDb(t, workspace_id)));
};

export const deleteTag = (id: string) => {
  if (!canSync()) return;
  track("deleteTag", getSupabase().from("tags").delete().eq("id", id));
};

export const pushWorkspace = (w: Workspace) => {
  if (!canSync()) return;
  const u = useAuthStore.getState().user;
  if (!u) return;
  track("pushWorkspace", getSupabase().from("workspaces").upsert(workspaceToDb(w, u.id)));
};

export const deleteWorkspace = (id: string) => {
  if (!canSync()) return;
  track("deleteWorkspace", getSupabase().from("workspaces").delete().eq("id", id));
};

export const pushMember = (m: WorkspaceMember, workspace_id: string) => {
  if (!canSync()) return;
  track("pushMember", getSupabase().from("workspace_members").upsert(memberToDb(m, workspace_id)));
};

export const deleteMember = (id: string) => {
  if (!canSync()) return;
  track("deleteMember", getSupabase().from("workspace_members").delete().eq("id", id));
};

export const pushPost = (p: ScheduledPost) => {
  if (!canSync()) return;
  track("pushPost", getSupabase().from("schedule_posts").upsert(postToDb(p)));
};

export const deletePost = (id: string) => {
  if (!canSync()) return;
  track("deletePost", getSupabase().from("schedule_posts").delete().eq("id", id));
};

export const pushMeeting = (m: Meeting) => {
  if (!canSync()) return;
  track("pushMeeting", getSupabase().from("meetings").upsert(meetingToDb(m)));
};

export const deleteMeeting = (id: string) => {
  if (!canSync()) return;
  track("deleteMeeting", getSupabase().from("meetings").delete().eq("id", id));
};

// =========================================================================
// PULL — initial sync after login
// =========================================================================

export async function pullAll(): Promise<void> {
  if (!canSync()) {
    useSyncStatusStore.getState().setState("offline");
    return;
  }
  useSyncStatusStore.getState().setState("syncing");
  const sb = getSupabase();

  // Fetch in parallel
  const [
    workspacesRes,
    membersRes,
    projectsRes,
    categoriesRes,
    tagsRes,
    tasksRes,
    postsRes,
    meetingsRes,
  ] = await Promise.all([
    sb.from("workspaces").select("*"),
    sb.from("workspace_members").select("*"),
    sb.from("projects").select("*").order("position", { ascending: true }),
    sb.from("categories").select("*"),
    sb.from("tags").select("*"),
    sb.from("tasks").select("*"),
    sb.from("schedule_posts").select("*"),
    sb.from("meetings").select("*"),
  ]);

  // ── 1. Resolve personal workspace ID mismatch ─────────────────────
  // Server creates personal workspace with `ws_<uid>` via trigger.
  // Local store uses the hardcoded id "personal". Migrate before applying server snapshot.
  const serverWorkspaces = workspacesRes.data ?? [];
  const personalServer = serverWorkspaces.find((w) => w.type === "personal");
  const realPersonalId = personalServer?.id ?? "personal";

  await migrateLocalPersonalId(realPersonalId);

  // ── 2. Workspaces store ───────────────────────────────────────────
  const allMembers = membersRes.data ?? [];
  const workspaces: Workspace[] = serverWorkspaces.map((w) =>
    workspaceFromDb(
      w,
      allMembers.filter((m) => m.workspace_id === w.id).map(memberFromDb)
    )
  );
  // Push any local workspaces that exist locally but not on server
  const localWorkspaces = useWorkspaceStore.getState().workspaces;
  const serverIds = new Set(serverWorkspaces.map((w) => w.id));
  for (const lw of localWorkspaces) {
    if (!serverIds.has(lw.id)) {
      pushWorkspace(lw);
      for (const m of lw.members) pushMember(m, lw.id);
      workspaces.push(lw);
    }
  }

  // Pick active workspace: prefer current one if still present, else personal
  const currentActive = useWorkspaceStore.getState().activeWorkspaceId;
  const activeWorkspaceId = workspaces.some((w) => w.id === currentActive)
    ? currentActive
    : realPersonalId;

  useWorkspaceStore.setState({ workspaces, activeWorkspaceId });

  // ── 3. Push any local-only rows to the server, then apply server snapshot ─
  const tasksStore = useTasksStore.getState();
  const serverTaskIds = new Set((tasksRes.data ?? []).map((r) => r.id));
  for (const t of tasksStore.tasks) {
    if (!serverTaskIds.has(t.id)) pushTask(t);
  }
  const serverProjectIds = new Set((projectsRes.data ?? []).map((r) => r.id));
  tasksStore.projects.forEach((p, i) => {
    if (!serverProjectIds.has(p.id)) pushProject(p, i);
  });
  const serverCategoryIds = new Set((categoriesRes.data ?? []).map((r) => r.id));
  for (const c of tasksStore.categories) {
    if (!serverCategoryIds.has(c.id)) pushCategory(c, activeWorkspaceId);
  }
  const serverTagIds = new Set((tagsRes.data ?? []).map((r) => r.id));
  for (const t of tasksStore.tags) {
    if (!serverTagIds.has(t.id)) pushTag(t, activeWorkspaceId);
  }

  // Build merged snapshot (server wins for shared IDs)
  const mergedTasks = [
    ...(tasksRes.data ?? []).map(taskFromDb),
    ...tasksStore.tasks.filter((t) => !serverTaskIds.has(t.id)),
  ];
  const mergedProjects = [
    ...(projectsRes.data ?? []).map(projectFromDb),
    ...tasksStore.projects.filter((p) => !serverProjectIds.has(p.id)),
  ];
  const mergedCategories = [
    ...(categoriesRes.data ?? []).map(categoryFromDb),
    ...tasksStore.categories.filter((c) => !serverCategoryIds.has(c.id)),
  ];
  const mergedTags = [
    ...(tagsRes.data ?? []).map(tagFromDb),
    ...tasksStore.tags.filter((t) => !serverTagIds.has(t.id)),
  ];
  useTasksStore.setState({
    tasks: mergedTasks,
    projects: mergedProjects,
    categories: mergedCategories,
    tags: mergedTags,
  });

  // ── 4. Schedule posts ─────────────────────────────────────────────
  const scheduleStore = useScheduleStore.getState();
  const serverPostIds = new Set((postsRes.data ?? []).map((r) => r.id));
  for (const p of scheduleStore.posts) {
    if (!serverPostIds.has(p.id)) pushPost(p);
  }
  useScheduleStore.setState({
    posts: [
      ...(postsRes.data ?? []).map(postFromDb),
      ...scheduleStore.posts.filter((p) => !serverPostIds.has(p.id)),
    ],
  });

  // ── 5. Meetings ───────────────────────────────────────────────────
  const meetingsStore = useMeetingsStore.getState();
  const serverMeetingIds = new Set((meetingsRes.data ?? []).map((r) => r.id));
  for (const m of meetingsStore.meetings) {
    if (!serverMeetingIds.has(m.id)) pushMeeting(m);
  }
  useMeetingsStore.setState({
    meetings: [
      ...(meetingsRes.data ?? []).map(meetingFromDb),
      ...meetingsStore.meetings.filter((m) => !serverMeetingIds.has(m.id)),
    ],
  });

  useSyncStatusStore.getState().setState("synced");
}

// ─── Migrate local rows with workspace_id="personal" to the server id ─
async function migrateLocalPersonalId(realId: string): Promise<void> {
  if (realId === "personal") return; // no migration needed

  const ws = useWorkspaceStore.getState();
  useWorkspaceStore.setState({
    workspaces: ws.workspaces.map((w) =>
      w.id === "personal" ? { ...w, id: realId } : w
    ),
    activeWorkspaceId: ws.activeWorkspaceId === "personal" ? realId : ws.activeWorkspaceId,
  });

  const t = useTasksStore.getState();
  useTasksStore.setState({
    tasks: t.tasks.map((x) =>
      x.workspace_id === "personal" ? { ...x, workspace_id: realId } : x
    ),
    projects: t.projects.map((x) =>
      x.workspace_id === "personal" ? { ...x, workspace_id: realId } : x
    ),
  });

  const s = useScheduleStore.getState();
  useScheduleStore.setState({
    posts: s.posts.map((x) =>
      x.workspace_id === "personal" ? { ...x, workspace_id: realId } : x
    ),
  });

  const m = useMeetingsStore.getState();
  useMeetingsStore.setState({
    meetings: m.meetings.map((x) =>
      x.workspace_id === "personal" ? { ...x, workspace_id: realId } : x
    ),
  });
}

// =========================================================================
// REALTIME — apply remote changes to local store
// =========================================================================

export function subscribeRealtime(): () => void {
  if (!canSync()) return () => {};
  const sb = getSupabase();

  const ch: RealtimeChannel = sb
    .channel("heed-sync")
    // ─── tasks ──────────────────────────────────────────────────────
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (p) => {
      const s = useTasksStore.getState();
      if (p.eventType === "DELETE") {
        useTasksStore.setState({ tasks: s.tasks.filter((t) => t.id !== (p.old as { id: string }).id) });
      } else {
        const row = taskFromDb(p.new as Tables["tasks"]["Row"]);
        const idx = s.tasks.findIndex((t) => t.id === row.id);
        if (idx >= 0) {
          // last-write-wins per row
          if (row.updated_at >= s.tasks[idx].updated_at) {
            const next = s.tasks.slice();
            next[idx] = row;
            useTasksStore.setState({ tasks: next });
          }
        } else {
          useTasksStore.setState({ tasks: [row, ...s.tasks] });
        }
      }
    })
    // ─── projects ───────────────────────────────────────────────────
    .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, (p) => {
      const s = useTasksStore.getState();
      if (p.eventType === "DELETE") {
        useTasksStore.setState({ projects: s.projects.filter((x) => x.id !== (p.old as { id: string }).id) });
      } else {
        const row = projectFromDb(p.new as Tables["projects"]["Row"]);
        const idx = s.projects.findIndex((x) => x.id === row.id);
        if (idx >= 0) {
          const next = s.projects.slice();
          next[idx] = row;
          useTasksStore.setState({ projects: next });
        } else {
          useTasksStore.setState({ projects: [...s.projects, row] });
        }
      }
    })
    // ─── categories ─────────────────────────────────────────────────
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, (p) => {
      const s = useTasksStore.getState();
      if (p.eventType === "DELETE") {
        useTasksStore.setState({ categories: s.categories.filter((x) => x.id !== (p.old as { id: string }).id) });
      } else {
        const row = categoryFromDb(p.new as Tables["categories"]["Row"]);
        const idx = s.categories.findIndex((x) => x.id === row.id);
        const next = s.categories.slice();
        if (idx >= 0) next[idx] = row; else next.push(row);
        useTasksStore.setState({ categories: next });
      }
    })
    // ─── tags ───────────────────────────────────────────────────────
    .on("postgres_changes", { event: "*", schema: "public", table: "tags" }, (p) => {
      const s = useTasksStore.getState();
      if (p.eventType === "DELETE") {
        useTasksStore.setState({ tags: s.tags.filter((x) => x.id !== (p.old as { id: string }).id) });
      } else {
        const row = tagFromDb(p.new as Tables["tags"]["Row"]);
        const idx = s.tags.findIndex((x) => x.id === row.id);
        const next = s.tags.slice();
        if (idx >= 0) next[idx] = row; else next.push(row);
        useTasksStore.setState({ tags: next });
      }
    })
    // ─── workspaces ─────────────────────────────────────────────────
    .on("postgres_changes", { event: "*", schema: "public", table: "workspaces" }, (p) => {
      const s = useWorkspaceStore.getState();
      if (p.eventType === "DELETE") {
        const id = (p.old as { id: string }).id;
        useWorkspaceStore.setState({
          workspaces: s.workspaces.filter((w) => w.id !== id),
          activeWorkspaceId: s.activeWorkspaceId === id
            ? (s.workspaces.find((w) => w.type === "personal")?.id ?? "personal")
            : s.activeWorkspaceId,
        });
      } else {
        const row = p.new as Tables["workspaces"]["Row"];
        const idx = s.workspaces.findIndex((w) => w.id === row.id);
        const members = idx >= 0 ? s.workspaces[idx].members : [];
        const w = workspaceFromDb(row, members);
        const next = s.workspaces.slice();
        if (idx >= 0) next[idx] = w; else next.push(w);
        useWorkspaceStore.setState({ workspaces: next });
      }
    })
    // ─── schedule_posts ─────────────────────────────────────────────
    .on("postgres_changes", { event: "*", schema: "public", table: "schedule_posts" }, (p) => {
      const s = useScheduleStore.getState();
      if (p.eventType === "DELETE") {
        useScheduleStore.setState({ posts: s.posts.filter((x) => x.id !== (p.old as { id: string }).id) });
      } else {
        const row = postFromDb(p.new as Tables["schedule_posts"]["Row"]);
        const idx = s.posts.findIndex((x) => x.id === row.id);
        const next = s.posts.slice();
        if (idx >= 0) next[idx] = row; else next.push(row);
        useScheduleStore.setState({ posts: next });
      }
    })
    // ─── meetings ───────────────────────────────────────────────────
    .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, (p) => {
      const s = useMeetingsStore.getState();
      if (p.eventType === "DELETE") {
        useMeetingsStore.setState({ meetings: s.meetings.filter((x) => x.id !== (p.old as { id: string }).id) });
      } else {
        const row = meetingFromDb(p.new as Tables["meetings"]["Row"]);
        const idx = s.meetings.findIndex((x) => x.id === row.id);
        const next = s.meetings.slice();
        if (idx >= 0) next[idx] = row; else next.push(row);
        useMeetingsStore.setState({ meetings: next });
      }
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        // Re-pull from server so no changes are missed during the gap.
        setTimeout(() => void pullAll().catch(() => {}), 5_000);
      }
    });

  return () => {
    void sb.removeChannel(ch);
  };
}
