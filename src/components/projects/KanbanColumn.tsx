import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import type { KanbanColumn as KanbanColType, Task } from "../../stores/tasksStore";
import type { WorkspaceMember } from "../../stores/workspaceStore";
import { KanbanCard } from "./KanbanCard";
import { cn } from "../../lib/utils";
import { quickTaskDates } from "../../lib/taskDateShortcuts";
import { AddTaskInput } from "../tasks/AddTaskInput";

const colConfig: Record<
  KanbanColType,
  { arLabel: string; enLabel: string; dot: string; countCls: string }
> = {
  backlog: {
    arLabel: "تراكمي",
    enLabel: "Backlog",
    dot: "bg-muted-foreground/50",
    countCls: "bg-secondary text-muted-foreground",
  },
  this_week: {
    arLabel: "الأسبوع ده",
    enLabel: "This Week",
    dot: "bg-blue-500",
    countCls: "bg-blue-500/15 text-blue-500 dark:text-blue-400",
  },
  today: {
    arLabel: "النهارده",
    enLabel: "Today",
    dot: "bg-primary",
    countCls: "bg-primary/15 text-primary",
  },
  done: {
    arLabel: "خلصت",
    enLabel: "Done",
    dot: "bg-emerald-500",
    countCls: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
  },
};

export function KanbanColumn({
  column,
  tasks,
  onOpen,
  projectId,
  members,
  selectedIds,
  onToggleSelect,
}: {
  column: KanbanColType;
  tasks: Task[];
  onOpen: (id: string) => void;
  projectId: string;
  members?: WorkspaceMember[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { setNodeRef, isOver } = useDroppable({ id: column });

  const cfg = colConfig[column];
  const defaultDeadline = column === "today" ? quickTaskDates()[0].value : null;

  return (
    <div className="flex w-72 shrink-0 flex-col">
      {/* Column header — neutral, just a colored dot for identity */}
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
          <h3 className="text-[13px] font-semibold tracking-tight">
            {isAr ? cfg.arLabel : cfg.enLabel}
          </h3>
          <span
            className={cn(
              "rounded-full px-1.5 py-0 font-micro text-[10px] font-bold tabular-nums leading-[1.4]",
              cfg.countCls,
            )}
          >
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Task list — droppable */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-1.5 rounded-xl border border-border/50 bg-secondary/30 p-1.5 transition-colors",
          isOver && "border-primary/40 bg-primary/5",
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onOpen={onOpen}
              members={members}
              isSelected={selectedIds?.has(task.id)}
              selectionActive={(selectedIds?.size ?? 0) > 0}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && !isOver && (
          <div className="grid h-16 place-items-center rounded-lg border border-dashed border-border/40">
            <span className="font-micro text-[10px] text-muted-foreground/40">
              {isAr ? "اسحب مهمة هنا" : "Drop a task"}
            </span>
          </div>
        )}

        {/* Add task — full settings inline at bottom of column */}
        {column !== "done" && (
          <div className="pt-1">
            <AddTaskInput
              defaultDeadline={defaultDeadline}
              defaultProjectId={projectId}
              defaultColumn={column}
              lockProject
            />
          </div>
        )}
      </div>
    </div>
  );
}
