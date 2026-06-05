import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Link2, Pause, Play, Square, Clock, Calendar, Check } from "lucide-react";
import type { Task } from "../../stores/tasksStore";
import type { WorkspaceMember } from "../../stores/workspaceStore";
import { useTimerStore } from "../../stores/timerStore";
import { useNow } from "../../hooks/useNow";
import { cn, formatHMS } from "../../lib/utils";
import { pauseAndCommit, stopTimerAndCommit } from "../../lib/timerActions";

const priorityConfig: Record<
  Task["priority"],
  { stripe: string; dot: string; ring: string; label: string }
> = {
  urgent: { stripe: "bg-red-500",            dot: "bg-red-500",            ring: "ring-red-500/30",          label: "عاجل"   },
  high:   { stripe: "bg-orange-500",          dot: "bg-orange-500",          ring: "ring-orange-500/30",       label: "عالية"  },
  medium: { stripe: "bg-primary",             dot: "bg-primary",             ring: "ring-primary/30",          label: "متوسطة" },
  low:    { stripe: "bg-muted-foreground/40", dot: "bg-muted-foreground/40", ring: "ring-muted-foreground/20", label: "منخفضة" },
};

export function KanbanCardOverlay({ task }: { task: Task }) {
  const isDone = task.status === "done";
  const cfg    = priorityConfig[task.priority];
  return (
    <div className={cn(
      "row-surface flex items-center gap-2 overflow-hidden rounded-lg px-2.5 py-2 shadow-2xl ring-2 rotate-1 cursor-grabbing",
      cfg.ring,
      isDone && "opacity-50",
    )}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", cfg.dot)} />
      <p className={cn("truncate text-[13px] font-medium", isDone && "line-through text-muted-foreground")}>
        {task.title}
      </p>
    </div>
  );
}

export function KanbanCard({
  task,
  onOpen,
  members,
  isSelected = false,
  selectionActive = false,
  onToggleSelect,
}: {
  task: Task;
  onOpen?: (id: string) => void;
  members?: WorkspaceMember[];
  isSelected?: boolean;
  selectionActive?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const activeTask = useTimerStore((s) => s.activeTask);
  const isRunning  = useTimerStore((s) => s.isRunning);
  const startTask  = useTimerStore((s) => s.startTask);
  const resume     = useTimerStore((s) => s.resume);
  useNow(1000);

  const elapsed  = useTimerStore((s) => activeTask?.id === task.id ? s.getElapsedSeconds() : 0);
  const isActive = activeTask?.id === task.id;
  const isDone   = task.status === "done";
  const cfg      = priorityConfig[task.priority];
  const assignee = task.assignee_id && members
    ? members.find((m) => m.id === task.assignee_id)
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/card row-surface relative flex items-center overflow-hidden rounded-lg",
        isDragging && "opacity-30 scale-[0.98]",
        isDone && "opacity-55",
        isActive && "!border-primary/50 ring-1 ring-primary/25",
        isSelected && "ring-2 ring-primary/50 bg-primary/5",
      )}
    >
      {/* Thin priority stripe */}
      <span className={cn(
        "absolute inset-y-0 start-0 w-[3px]",
        cfg.stripe,
        isActive && "!bg-primary",
        isSelected && "!bg-primary",
      )} />

      {/* Drag handle OR selection checkbox */}
      {selectionActive ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(task.id); }}
          className="ms-[3px] grid h-9 w-5 shrink-0 place-items-center"
        >
          <span className={cn(
            "grid h-3.5 w-3.5 place-items-center rounded-sm border-2 transition",
            isSelected ? "border-primary bg-primary" : "border-muted-foreground/40 bg-background",
          )}>
            {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />}
          </span>
        </button>
      ) : (
        <button
          {...attributes}
          {...listeners}
          className="ms-[3px] grid h-9 w-5 shrink-0 touch-none place-items-center cursor-grab text-muted-foreground/0 transition group-hover/card:text-muted-foreground/40 hover:text-foreground active:cursor-grabbing"
          tabIndex={-1}
          aria-label="drag"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}

      {/* Body — open drawer or toggle selection */}
      <button
        onClick={() => {
          if (selectionActive) onToggleSelect?.(task.id);
          else onOpen?.(task.id);
        }}
        className="flex min-w-0 flex-1 items-center gap-2 py-2 pe-2 text-start"
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cfg.dot)} />
        <span className={cn(
          "min-w-0 flex-1 truncate text-[13px] font-medium leading-tight",
          isDone && "line-through text-muted-foreground",
        )}>
          {task.title}
        </span>
        <span className="hidden shrink-0 items-center gap-2 font-micro text-[10px] text-muted-foreground/70 sm:flex">
          {isActive && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 tabular-nums font-semibold text-primary">
              {formatHMS(elapsed)}
            </span>
          )}
          {task.estimated_minutes !== null && !isActive && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {task.estimated_minutes}م
            </span>
          )}
          {task.deadline && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              {task.deadline.slice(5)}
            </span>
          )}
          {task.links.length > 0 && (
            <span className="flex items-center gap-0.5">
              <Link2 className="h-2.5 w-2.5" />
              {task.links.length}
            </span>
          )}
          {assignee && (
            <span
              title={assignee.name}
              className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/20 text-[8px] font-bold text-primary"
            >
              {assignee.name[0]?.toUpperCase()}
            </span>
          )}
        </span>
      </button>

      {/* Timer controls — hidden in selection mode */}
      {!isDone && !selectionActive && (
        <div className={cn(
          "flex shrink-0 items-center gap-0.5 pe-1.5 transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover/card:opacity-100",
        )}>
          {!isActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                startTask({ id: task.id, title: task.title, estimatedMinutes: task.estimated_minutes, categoryColor: null }, null);
              }}
              title="ابدأ المؤقت"
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <Play className="h-2.5 w-2.5" />
            </button>
          )}
          {isActive && isRunning && (
            <button
              onClick={(e) => { e.stopPropagation(); pauseAndCommit(); }}
              className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-foreground hover:bg-secondary/80"
              title="إيقاف مؤقت"
            >
              <Pause className="h-2.5 w-2.5" />
            </button>
          )}
          {isActive && !isRunning && (
            <button
              onClick={(e) => { e.stopPropagation(); resume(); }}
              className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
              title="استئناف"
            >
              <Play className="h-2.5 w-2.5" />
            </button>
          )}
          {isActive && (
            <button
              onClick={(e) => { e.stopPropagation(); stopTimerAndCommit(); }}
              className="grid h-6 w-6 place-items-center rounded-full bg-destructive/15 text-destructive hover:bg-destructive/25"
              title="إنهاء"
            >
              <Square className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
