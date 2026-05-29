import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  pushTask, deleteTask as syncDeleteTask,
  pushProject, deleteProject as syncDeleteProject,
  pushCategory, deleteCategory as syncDeleteCategory,
  pushTag, deleteTag as syncDeleteTag,
} from "../lib/sync";
import { useWorkspaceStore } from "./workspaceStore";

const activeWs = () => useWorkspaceStore.getState().activeWorkspaceId;

export type Priority = "low" | "medium" | "high" | "urgent";
export type Status = "todo" | "in_progress" | "done" | "cancelled";
export type KanbanColumn = "backlog" | "this_week" | "today" | "done";
export type VideoStage =
  | "idea"
  | "script"
  | "filming"
  | "editing"
  | "scheduled"
  | "published";

export type Category = {
  id: string;
  name: string;
  color: string;
  type: "general" | "video" | "design";
  description?: string;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
  description?: string;
};

export type Project = {
  id: string;
  name: string;
  color: string; // hex
  icon: string;  // first letter or emoji
  iconUrl?: string | null; // base64 data URL or null
  type: "general" | "video" | "design";
  created_at: string;
  workspace_id: string;
  shared_workspace_ids?: string[]; // workspaces this project is shared/synced to
};

export type Task = {
  id: string;
  title: string;
  notes: string;
  project_id: string | null;
  category_id: string | null;
  tag_ids: string[];
  priority: Priority;
  status: Status;
  column: KanbanColumn;
  position: number;
  estimated_minutes: number | null;
  actual_minutes: number;
  deadline: string | null; // ISO date string (YYYY-MM-DD) or null
  video_stage: VideoStage | null;
  links: Array<{ label: string; url: string }>;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  workspace_id: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const seedCategories: Category[] = [];
const seedTags: Tag[] = [];
const seedProjects: Project[] = [];
const seedTasks: Task[] = [];

type TasksState = {
  tasks: Task[];
  categories: Category[];
  projects: Project[];
  tags: Tag[];

  addTask: (input: Partial<Task> & { title: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleDone: (id: string) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, column: KanbanColumn, position: number) => void;

  addCategory: (input: Omit<Category, "id">) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  addTag: (input: Omit<Tag, "id">) => Tag;
  updateTag: (id: string, patch: Partial<Tag>) => void;
  deleteTag: (id: string) => void;

  addProject: (input: Omit<Project, "id" | "created_at">) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  reorderProjects: (orderedIds: string[]) => void;
  shareProjectTo: (id: string, wsId: string) => void;
  unshareProjectFrom: (id: string, wsId: string) => void;

  addActualMinutes: (taskId: string, minutes: number) => void;
};

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: seedTasks,
      categories: seedCategories,
      projects: seedProjects,
      tags: seedTags,

      addTask: (input) => {
        const task: Task = {
          id: uid(),
          title: input.title.trim(),
          notes: input.notes ?? "",
          project_id: input.project_id ?? null,
          category_id: input.category_id ?? null,
          tag_ids: input.tag_ids ?? [],
          priority: input.priority ?? "medium",
          status: input.status ?? "todo",
          column: input.column ?? "today",
          position: input.position ?? Date.now(),
          estimated_minutes: input.estimated_minutes ?? null,
          actual_minutes: input.actual_minutes ?? 0,
          deadline: input.deadline ?? null,
          video_stage: input.video_stage ?? null,
          links: input.links ?? [],
          completed_at: input.completed_at ?? null,
          created_at: nowIso(),
          updated_at: nowIso(),
          workspace_id: input.workspace_id ?? activeWs(),
        };
        set((s) => ({ tasks: [task, ...s.tasks] }));
        pushTask(task);
        return task;
      },

      updateTask: (id, patch) => {
        let updated: Task | undefined;
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            updated = { ...t, ...patch, updated_at: nowIso() };
            return updated;
          }),
        }));
        if (updated) pushTask(updated);
      },

      toggleDone: (id) => {
        const t = get().tasks.find((x) => x.id === id);
        if (!t) return;
        const marking = t.status !== "done";
        get().updateTask(id, {
          status: marking ? "done" : "todo",
          // Always sync column with status so the task moves between
          // Today/Done buckets in both Tasks page and the project board.
          column: marking ? "done" : (t.column === "done" ? "today" : t.column),
          completed_at: marking ? nowIso() : null,
        });
      },

      deleteTask: (id) => {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
        syncDeleteTask(id);
      },

      moveTask: (id, column, position) => {
        let moved: Task | undefined;
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            moved = {
              ...t,
              column,
              position,
              status:
                column === "done"
                  ? "done"
                  : t.status === "done"
                  ? "todo"
                  : t.status,
              updated_at: nowIso(),
            };
            return moved;
          }),
        }));
        if (moved) pushTask(moved);
      },

      addCategory: (input) => {
        const cat: Category = { ...input, id: uid() };
        set((s) => ({ categories: [...s.categories, cat] }));
        pushCategory(cat, activeWs());
        return cat;
      },
      updateCategory: (id, patch) => {
        let updated: Category | undefined;
        set((s) => ({
          categories: s.categories.map((c) => {
            if (c.id !== id) return c;
            updated = { ...c, ...patch };
            return updated;
          }),
        }));
        if (updated) pushCategory(updated, activeWs());
      },
      deleteCategory: (id) => {
        // Tasks updated to null category_id locally; server handles via ON DELETE SET NULL.
        const affected: Task[] = [];
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          tasks: s.tasks.map((t) => {
            if (t.category_id !== id) return t;
            const next = { ...t, category_id: null, updated_at: nowIso() };
            affected.push(next);
            return next;
          }),
        }));
        syncDeleteCategory(id);
        affected.forEach(pushTask);
      },

      addTag: (input) => {
        const tag: Tag = { ...input, id: uid() };
        set((s) => ({ tags: [...s.tags, tag] }));
        pushTag(tag, activeWs());
        return tag;
      },
      updateTag: (id, patch) => {
        let updated: Tag | undefined;
        set((s) => ({
          tags: s.tags.map((t) => {
            if (t.id !== id) return t;
            updated = { ...t, ...patch };
            return updated;
          }),
        }));
        if (updated) pushTag(updated, activeWs());
      },
      deleteTag: (id) => {
        const affected: Task[] = [];
        set((s) => ({
          tags: (s.tags ?? []).filter((t) => t.id !== id),
          tasks: s.tasks.map((t) => {
            const ids = t.tag_ids ?? [];
            if (!ids.includes(id)) return t;
            const next = { ...t, tag_ids: ids.filter((tid) => tid !== id), updated_at: nowIso() };
            affected.push(next);
            return next;
          }),
        }));
        syncDeleteTag(id);
        affected.forEach(pushTask);
      },

      addProject: (input) => {
        const project: Project = {
          ...input,
          id: uid(),
          created_at: nowIso(),
          workspace_id: input.workspace_id ?? activeWs(),
        };
        let position = 0;
        set((s) => {
          position = s.projects.length;
          return { projects: [...s.projects, project] };
        });
        pushProject(project, position);
        return project;
      },
      updateProject: (id, patch) => {
        let updated: Project | undefined;
        let position = 0;
        set((s) => ({
          projects: s.projects.map((p, i) => {
            if (p.id !== id) return p;
            updated = { ...p, ...patch };
            position = i;
            return updated;
          }),
        }));
        if (updated) pushProject(updated, position);
      },
      deleteProject: (id) => {
        const affected: Task[] = [];
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          tasks: s.tasks.map((t) => {
            if (t.project_id !== id) return t;
            const next = { ...t, project_id: null, updated_at: nowIso() };
            affected.push(next);
            return next;
          }),
        }));
        syncDeleteProject(id);
        affected.forEach(pushTask);
      },
      reorderProjects: (orderedIds) => {
        let toPush: Project[] = [];
        set((s) => {
          const byId = new Map(s.projects.map((p) => [p.id, p]));
          const reordered = orderedIds
            .map((id) => byId.get(id))
            .filter((p): p is Project => !!p);
          const seen = new Set(orderedIds);
          const rest = s.projects.filter((p) => !seen.has(p.id));
          toPush = reordered;
          return { projects: [...reordered, ...rest] };
        });
        toPush.forEach((p, i) => pushProject(p, i));
      },
      shareProjectTo: (id, wsId) => {
        let updated: Project | undefined;
        let position = 0;
        set((s) => ({
          projects: s.projects.map((p, i) => {
            if (p.id !== id) return p;
            updated = { ...p, shared_workspace_ids: [...new Set([...(p.shared_workspace_ids ?? []), wsId])] };
            position = i;
            return updated;
          }),
        }));
        if (updated) pushProject(updated, position);
      },
      unshareProjectFrom: (id, wsId) => {
        let updated: Project | undefined;
        let position = 0;
        set((s) => ({
          projects: s.projects.map((p, i) => {
            if (p.id !== id) return p;
            updated = { ...p, shared_workspace_ids: (p.shared_workspace_ids ?? []).filter((w) => w !== wsId) };
            position = i;
            return updated;
          }),
        }));
        if (updated) pushProject(updated, position);
      },

      addActualMinutes: (taskId, minutes) => {
        let updated: Task | undefined;
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t;
            updated = { ...t, actual_minutes: t.actual_minutes + minutes, updated_at: nowIso() };
            return updated;
          }),
        }));
        if (updated) pushTask(updated);
      },
    }),
    {
      name: "mindora:tasks",
      version: 9,
      migrate: (state: unknown, version: number | undefined) => {
        const s = state as Record<string, unknown>;
        const v = version ?? 0;
        if (v < 3) {
          return {
            ...s,
            tasks: ((s.tasks as Task[]) || []).map((t: Task, i: number) => ({
              ...t,
              project_id: (t as Task & { project_id?: string | null }).project_id ?? null,
              column: (t as Task & { column?: KanbanColumn }).column ?? ("today" as KanbanColumn),
              position: (t as Task & { position?: number }).position ?? i * 100,
              completed_at: null,
              tag_ids: [],
            })),
            projects: seedProjects,
            tags: seedTags,
          };
        }
        if (v < 4) {
          return {
            ...s,
            tasks: ((s.tasks as Task[]) || []).map((t: Task) => ({
              ...t,
              completed_at: (t as Task & { completed_at?: string | null }).completed_at ?? null,
              tag_ids: [],
            })),
          };
        }
        if (v < 5) {
          return {
            ...s,
            tasks: ((s.tasks as Task[]) || []).map((t: Task) => ({
              ...t,
              tag_ids: (t as Task & { tag_ids?: string[] }).tag_ids ?? [],
            })),
            tags: (s.tags as Tag[] | undefined) ?? seedTags,
          };
        }
        if (v < 6) {
          return {
            ...s,
            tasks: ((s.tasks as Task[]) || []).map((t: Task) => ({
              ...t,
              workspace_id: (t as Task & { workspace_id?: string }).workspace_id ?? "personal",
            })),
            projects: ((s.projects as Project[]) || []).map((p: Project) => ({
              ...p,
              workspace_id: (p as Project & { workspace_id?: string }).workspace_id ?? "personal",
            })),
          };
        }
        if (v < 7) {
          return {
            ...s,
            projects: ((s.projects as Project[]) || []).map((p: Project) => ({
              ...p,
              shared_workspace_ids: (p as Project & { shared_workspace_ids?: string[] }).shared_workspace_ids ?? [],
            })),
          };
        }
        if (v < 8) {
          return {
            ...s,
            projects: ((s.projects as Project[]) || []).map((p: Project) => ({
              ...p,
              iconUrl: (p as Project & { iconUrl?: string | null }).iconUrl ?? null,
            })),
          };
        }
        if (v < 9) {
          // Remove leftover seed projects/categories/tags/tasks from earlier builds
          const seedProjectIds = new Set(["proj-film", "proj-work"]);
          const seedCategoryIds = new Set(["cat-work", "cat-video", "cat-personal"]);
          const seedTagIds = new Set(["tag-urgent", "tag-idea"]);
          const seedTaskTitles = new Set([
            "تصوير فيديو React Tips",
            "تصميم لاندنج بيج للعميل",
            "أكتب أفكار فيديو الأسبوع الجاي",
          ]);
          return {
            ...s,
            projects: ((s.projects as Project[]) || []).filter(
              (p) => !seedProjectIds.has(p.id)
            ),
            categories: ((s.categories as Category[]) || []).filter(
              (c) => !seedCategoryIds.has(c.id)
            ),
            tags: ((s.tags as Tag[]) || []).filter((t) => !seedTagIds.has(t.id)),
            tasks: ((s.tasks as Task[]) || []).filter(
              (t) => !seedTaskTitles.has(t.title)
            ),
          };
        }
        return s;
      },
    }
  )
);

// Helpers
export function categorizeByDeadline(tasks: Task[]) {
  const todayStr = isoDate(new Date());
  const weekEnd = new Date(Date.now() + 7 * 86400000);
  const weekEndStr = isoDate(weekEnd);

  const todayBucket: Task[] = [];
  const thisWeek: Task[] = [];
  const later: Task[] = [];
  const noDate: Task[] = [];
  const done: Task[] = [];

  for (const t of tasks) {
    if (t.status === "done" || t.column === "done") {
      done.push(t);
      continue;
    }
    if (!t.deadline) {
      // Use kanban column as fallback
      if (t.column === "today") todayBucket.push(t);
      else if (t.column === "this_week") thisWeek.push(t);
      else noDate.push(t);
      continue;
    }
    if (t.deadline <= todayStr) todayBucket.push(t);
    else if (t.deadline <= weekEndStr) thisWeek.push(t);
    else later.push(t);
  }

  const priorityWeight: Record<Priority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const sortFn = (a: Task, b: Task) =>
    priorityWeight[a.priority] - priorityWeight[b.priority] ||
    (a.deadline ?? "").localeCompare(b.deadline ?? "");
  todayBucket.sort(sortFn);
  thisWeek.sort(sortFn);
  later.sort(sortFn);
  noDate.sort(sortFn);

  return { today: todayBucket, thisWeek, later, noDate, done };
}
