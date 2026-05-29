import { useTasksStore } from "../stores/tasksStore";
import { useTimerStore } from "../stores/timerStore";

/**
 * Stops the active timer AND writes the accumulated minutes back to the task.
 * Use this everywhere instead of calling `useTimerStore.getState().stop()` directly.
 */
export function stopTimerAndCommit() {
  const timer = useTimerStore.getState();
  const task = timer.activeTask;
  const elapsedSec = timer.getElapsedSeconds();
  if (task && elapsedSec > 0) {
    const minutes = Math.max(1, Math.round(elapsedSec / 60));
    useTasksStore.getState().addActualMinutes(task.id, minutes);
  }
  useTimerStore.getState().stop();
}

/** Pauses timer and commits accumulated minutes — used when switching tasks. */
export function pauseAndCommit() {
  const timer = useTimerStore.getState();
  const task = timer.activeTask;
  const elapsedSec = timer.getElapsedSeconds();
  timer.pause();
  if (task && elapsedSec > 0) {
    const minutes = Math.max(1, Math.round(elapsedSec / 60));
    useTasksStore.getState().addActualMinutes(task.id, minutes);
  }
}
