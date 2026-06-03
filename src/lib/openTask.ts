import type { NavigateFunction } from "react-router-dom";
import { useTasksStore } from "../stores/tasksStore";
import { pullAll } from "./sync";

// Open a task from a notification / inbox item. Looks the task up locally (and
// pulls once if it isn't cached yet, e.g. a mention in a workspace we just
// joined), then routes to its project board with the task drawer open.
export async function navigateToTask(taskId: string | undefined, navigate: NavigateFunction): Promise<void> {
  if (!taskId) return;
  let task = useTasksStore.getState().tasks.find((t) => t.id === taskId);
  if (!task) {
    await pullAll().catch(() => {});
    task = useTasksStore.getState().tasks.find((t) => t.id === taskId);
  }
  if (task?.project_id) {
    navigate(`/projects/${task.project_id}?task=${taskId}`);
  } else if (task) {
    navigate(`/?task=${taskId}`);
  }
}
