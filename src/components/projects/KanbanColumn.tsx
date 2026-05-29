import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { KanbanColumn as KanbanColType, Task } from "../../stores/tasksStore";
import { useTasksStore } from "../../stores/tasksStore";
import { KanbanCard } from "./KanbanCard";
import { cn } from "../../lib/utils";
import { quickTaskDates } from "../../lib/taskDateShortcuts";

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
}: {
  column: KanbanColType;
  tasks: Task[];
  onOpen: (id: string) => void;
  projectId: string;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { setNodeRef, isOver } = useDroppable({ id: column });
  const addTask = useTasksStore((s) => s.addTask);
  const [newTitle, setNewTitle] = useState("");
  const [deadline, setDeadline] = useState<string | null>(
    column === "today" ? quickTaskDates()[0].value : null
  );

  const cfg = colConfig[column];

  const handleAdd = () => {
    const t = newTitle.trim();
    if (!t) return;
    addTask({
      title: t,
      project_id: projectId,
      column,
      deadline,
      position: tasks.length * 100,
    });
    setNewTitle("");
    setDeadline(column === "today" ? quickTaskDates()[0].value : null);
  };

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
            <KanbanCard key={task.id} task={task} onOpen={onOpen} />
          ))}
        </SortableContext>

        {tasks.length === 0 && !isOver && (
          <div className="grid h-16 place-items-center rounded-lg border border-dashed border-border/40">
            <span className="font-micro text-[10px] text-muted-foreground/40">
              {isAr ? "اسحب مهمة هنا" : "Drop a task"}
            </span>
          </div>
        )}

        {/* Add task — inline at bottom of column */}
        {column !== "done" && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5 rounded-lg border border-transparent bg-card/40 px-2 py-1.5 transition-all focus-within:border-primary/30 focus-within:bg-card hover:border-border">
              <Plus className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={isAr ? "مهمة جديدة" : "New task"}
                className="min-w-0 flex-1 bg-transparent font-micro text-xs outline-none placeholder:text-muted-foreground/40"
              />
            </div>
            {newTitle.trim() && (
              <div className="flex flex-wrap gap-1 px-1">
                {quickTaskDates().map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDeadline(option.value)}
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 font-micro text-[10px] transition",
                      deadline === option.value
                        ? "border-primary/45 bg-primary/15 text-primary"
                        : "border-border/40 bg-card/60 text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    {isAr ? option.labelAr : option.labelEn}
                  </button>
                ))}
                {deadline && (
                  <button
                    type="button"
                    onClick={() => setDeadline(null)}
                    className="rounded-full border border-border/40 bg-card/60 px-1.5 py-0.5 font-micro text-[10px] text-muted-foreground hover:bg-secondary"
                  >
                    {isAr ? "بدون تاريخ" : "No date"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
