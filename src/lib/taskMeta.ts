import type { Priority } from "../stores/tasksStore";

// Single source of truth for task priority styling. Replaces the per-file
// copies in Dashboard, TaskDetailDrawer, AddTaskInput, KanbanCard, CanvasNodeView.

export const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

// Hex — for charts (recharts) and inline styles.
export const PRIORITY_HEX: Record<Priority, string> = {
  urgent: "#EF4444",
  high: "#F97316",
  medium: "#6735E1",
  low: "#858585",
};

// Solid filled badge (e.g. priority banner / selected toggle).
export const PRIORITY_SOLID: Record<Priority, string> = {
  urgent: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-sky-500 text-white",
};

// Outlined chip (e.g. add-task quick picker).
export const PRIORITY_CHIP: Record<Priority, string> = {
  low: "border-sky-500/45 bg-sky-500/15 text-sky-400",
  medium: "border-amber-500/45 bg-amber-500/15 text-amber-400",
  high: "border-orange-500/45 bg-orange-500/15 text-orange-400",
  urgent: "border-red-500/45 bg-red-500/15 text-red-400",
};

// Left stripe / dot accent (kanban + canvas task cards).
export const PRIORITY_STRIPE: Record<Priority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-primary",
  low: "bg-muted-foreground/40",
};
