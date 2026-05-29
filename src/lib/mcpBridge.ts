import { useTasksStore } from "../stores/tasksStore";
import { useScheduleStore } from "../stores/scheduleStore";

type McpCommand = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
};

async function invoke<T = void>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(cmd, args);
}

async function syncToFile() {
  try {
    const { tasks, projects, categories } = useTasksStore.getState();
    const { posts } = useScheduleStore.getState();
    await invoke("sync_data", {
      data: {
        tasks,
        projects,
        categories,
        scheduledPosts: posts,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch {
    // Not running inside Tauri (dev browser) — silently skip
  }
}

function applyCommand(cmd: McpCommand) {
  const tasksStore = useTasksStore.getState();
  const scheduleStore = useScheduleStore.getState();

  switch (cmd.type) {
    case "create_task": {
      const p = cmd.payload as {
        title: string;
        priority?: "low" | "medium" | "high" | "urgent";
        estimated_minutes?: number;
        deadline?: string;
        notes?: string;
      };
      tasksStore.addTask({
        title: p.title,
        priority: p.priority ?? "medium",
        estimated_minutes: p.estimated_minutes ?? null,
        deadline: p.deadline ?? null,
        notes: p.notes ?? "",
      });
      break;
    }
    case "complete_task": {
      const { task_id } = cmd.payload as { task_id: string };
      const t = tasksStore.tasks.find((x) => x.id === task_id);
      if (t && t.status !== "done") tasksStore.toggleDone(task_id);
      break;
    }
    case "update_task": {
      const { task_id, ...updates } = cmd.payload as { task_id: string } & Record<string, unknown>;
      tasksStore.updateTask(task_id, updates as Parameters<typeof tasksStore.updateTask>[1]);
      break;
    }
    case "add_to_schedule": {
      const p = cmd.payload as {
        title: string;
        platform?: string;
        platforms?: string[];
        scheduled_date?: string;
        scheduled_time?: string;
        notes?: string;
        column?: "content" | "this_week" | "today" | "published";
      };
      const platforms = p.platforms ?? (p.platform ? [p.platform] : []);
      scheduleStore.addPost({
        title: p.title,
        platforms,
        scheduledDate: p.scheduled_date ?? null,
        scheduledTime: p.scheduled_time ?? null,
        tags: [],
        notes: p.notes ?? "",
        column: p.column ?? "content",
        position: Date.now(),
        taskId: null,
        links: [],
        previewImageUrl: null,
        workspace_id: "personal",
      });
      break;
    }
    default:
      console.warn("[MCP] Unknown command type:", cmd.type);
  }
}

async function pollCommands() {
  try {
    const raw = await invoke<string>("read_commands");
    const commands: McpCommand[] = JSON.parse(raw);
    if (commands.length === 0) return;
    for (const cmd of commands) applyCommand(cmd);
    await invoke("clear_commands");
    await syncToFile();
  } catch {
    // Not in Tauri or file not ready yet
  }
}

let pollInterval: ReturnType<typeof setInterval> | null = null;
let unsubTasks: (() => void) | null = null;
let unsubSchedule: (() => void) | null = null;

export function startMcpBridge() {
  // Sync on every store change
  unsubTasks = useTasksStore.subscribe(() => void syncToFile());
  unsubSchedule = useScheduleStore.subscribe(() => void syncToFile());

  // Initial sync
  void syncToFile();

  // Poll for incoming commands every 2 seconds
  pollInterval = setInterval(() => void pollCommands(), 2000);
}

export function stopMcpBridge() {
  unsubTasks?.();
  unsubSchedule?.();
  if (pollInterval) clearInterval(pollInterval);
}
