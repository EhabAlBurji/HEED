import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowLeft, Check, CheckCircle2, Clock4, Columns3, Layers, ListChecks, Plus, Rows3, Settings2, Table2, Trash2, X } from "lucide-react";
import {
  useTasksStore,
  type KanbanColumn,
  type Task,
  type Category,
} from "../stores/tasksStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { KanbanColumn as KanbanCol } from "../components/projects/KanbanColumn";
import { KanbanCard, KanbanCardOverlay } from "../components/projects/KanbanCard";
import { TaskTable } from "../components/projects/TaskTable";
import { TaskDetailDrawer } from "../components/tasks/TaskDetailDrawer";
import { EditProjectModal } from "./Projects";
import { PRIORITY_STRIPE } from "../lib/taskMeta";
import { cn } from "../lib/utils";

const COLUMNS: KanbanColumn[] = ["backlog", "this_week", "today", "done"];

export default function ProjectBoard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const projects    = useTasksStore((s) => s.projects);
  const tasks       = useTasksStore((s) => s.tasks);
  const categories  = useTasksStore((s) => s.categories);
  const updateTask  = useTasksStore((s) => s.updateTask);
  const moveTask    = useTasksStore((s) => s.moveTask);
  const addTask     = useTasksStore((s) => s.addTask);
  const deleteTask  = useTasksStore((s) => s.deleteTask);

  const project = projects.find((p) => p.id === id);

  const [draggingTask,  setDraggingTask]  = useState<Task | null>(null);
  const [openTaskId,    setOpenTaskId]    = useState<string | null>(null);
  const [editOpen,      setEditOpen]      = useState(false);
  const [view,          setView]          = useState<"table" | "list" | "board">("table");
  const [newTitle,      setNewTitle]      = useState("");
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [groupBy,       setGroupBy]       = useState<"none" | "priority" | "status" | "category">("none");
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  const toggleSelect = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const markSelectedDone = () => {
    for (const tid of selectedIds) updateTask(tid, { status: "done", column: "done" });
    setSelectedIds(new Set());
  };

  const deleteSelected = () => {
    for (const tid of selectedIds) deleteTask(tid);
    setSelectedIds(new Set());
  };
  const [searchParams] = useSearchParams();

  // Open a task directly from a shared deep link (?task=ID).
  useEffect(() => {
    const tid = searchParams.get("task");
    if (tid) setOpenTaskId(tid);
  }, [searchParams]);

  const createTask = () => {
    const title = newTitle.trim();
    if (!title || !id) return;
    const task = addTask({ title, project_id: id, column: "backlog" });
    setNewTitle("");
    setOpenTaskId(task.id);
  };

  // Resizable master-detail split (table | task detail). Width of the detail
  // panel as a % of the row; default ~50/50, drag the handle to resize.
  const [detailPct, setDetailPct] = useState(50);
  const splitRef = useRef<HTMLDivElement>(null);
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const el = splitRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const fromEnd = rtl ? ev.clientX - rect.left : rect.right - ev.clientX;
      setDetailPct(Math.min(75, Math.max(25, (fromEnd / rect.width) * 100)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const projectTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.project_id === id)
        .sort((a, b) => a.position - b.position),
    [tasks, id]
  );

  const tasksByColumn = useMemo(() => {
    const map: Record<KanbanColumn, Task[]> = {
      backlog: [],
      this_week: [],
      today: [],
      done: [],
    };
    for (const t of projectTasks) {
      // status takes precedence over column so any task marked done
      // lands in the Done column even if its `column` field is stale.
      const col: KanbanColumn = t.status === "done" ? "done" : t.column;
      map[col].push(t);
    }
    return map;
  }, [projectTasks]);

  const progress = useMemo(() => {
    if (projectTasks.length === 0) return 0;
    const done = projectTasks.filter((t) => t.status === "done" || t.column === "done").length;
    return Math.round((done / projectTasks.length) * 100);
  }, [projectTasks]);

  const { totalEstimated, totalActual } = useMemo(() => {
    let totalEstimated = 0;
    let totalActual = 0;
    for (const t of projectTasks) {
      totalEstimated += t.estimated_minutes ?? 0;
      totalActual += t.actual_minutes;
    }
    return { totalEstimated, totalActual };
  }, [projectTasks]);

  const findTask = (taskId: string) => tasks.find((t) => t.id === taskId);
  const isColumn = (val: string): val is KanbanColumn =>
    COLUMNS.includes(val as KanbanColumn);

  // The column an `over` target belongs to: the column itself, or the
  // column of the task being hovered over. Falls back to `fallback`.
  const columnOf = (overId: string, fallback: KanbanColumn): KanbanColumn =>
    isColumn(overId) ? overId : findTask(overId)?.column ?? fallback;

  const handleDragStart = ({ active }: DragStartEvent) => {
    setDraggingTask(findTask(active.id as string) ?? null);
  };

  // While dragging across columns, move the task into the destination column
  // live. Same-column reordering is finalized in handleDragEnd.
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeTask = findTask(activeId);
    if (!activeTask) return;

    const destColumn = columnOf(overId, activeTask.column);
    if (destColumn === activeTask.column) return; // same column → handled on drag end

    // Insert just before the hovered task, or append to the end of the column.
    const overTask = isColumn(overId) ? null : findTask(overId);
    const destTasks = tasksByColumn[destColumn];
    const newPos = overTask
      ? overTask.position - 0.5
      : (destTasks[destTasks.length - 1]?.position ?? 0) + 100;

    moveTask(activeId, destColumn, newPos);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingTask(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = findTask(activeId);
    if (!activeTask) return;

    // After handleDragOver, the task already sits in its destination column.
    const destColumn = columnOf(overId, activeTask.column);
    const colTasks = [...tasksByColumn[destColumn]];

    const fromIdx = colTasks.findIndex((t) => t.id === activeId);
    if (fromIdx === -1) return; // not in this column (shouldn't happen)

    let toIdx = isColumn(overId)
      ? colTasks.length - 1
      : colTasks.findIndex((t) => t.id === overId);
    if (toIdx === -1) toIdx = colTasks.length - 1;

    // Normalize positions to clean 0,100,200… within the final column order.
    const reordered = arrayMove(colTasks, fromIdx, toIdx);
    reordered.forEach((t, i) => {
      if (t.position !== i * 100) {
        updateTask(t.id, { position: i * 100 });
      }
    });
  };

  if (!project) {
    return (
      <div className="grid h-full place-items-center">
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            {isAr ? "المشروع مش موجود" : "Project not found"}
          </p>
          <button
            onClick={() => navigate("/projects")}
            className="text-sm text-primary hover:underline"
          >
            {isAr ? "رجوع للمشاريع" : "Back to projects"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Board header */}
      <div className="flex items-center gap-3 border-b border-border/60 px-6 py-4">
        <button
          onClick={() => navigate("/projects")}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg font-display text-sm font-bold text-white"
          style={{ backgroundColor: project.iconUrl ? undefined : project.color }}
        >
          {project.iconUrl ? (
            <img src={project.iconUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            project.icon
          )}
        </div>
        <h1 className="font-display text-xl font-medium">{project.name}</h1>
        <span className="font-micro text-xs text-muted-foreground">
          · {projectTasks.filter((t) => t.column !== "done").length}{" "}
          {isAr ? "مهمة متبقية" : "remaining"}
        </span>

        <div className="ms-auto flex items-center gap-2">
          {/* View toggle: list (master-detail) ↔ board (kanban) */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/60 p-0.5">
            <button
              onClick={() => setView("table")}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-md transition",
                view === "table" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              title={isAr ? "جدول" : "Table"}
            >
              <Table2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-md transition",
                view === "list" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              title={isAr ? "قائمة" : "List"}
            >
              <Rows3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("board")}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-md transition",
                view === "board" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              title={isAr ? "بورد" : "Board"}
            >
              <Columns3 className="h-4 w-4" />
            </button>
          </div>
          {/* Group by picker */}
          {view === "board" && (
            <div className="relative">
              <button
                onClick={() => setGroupMenuOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition",
                  groupBy !== "none" ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:bg-secondary hover:text-foreground",
                )}
              >
                <Layers className="h-4 w-4" />
                <span className="font-micro text-xs">
                  {groupBy === "none" ? (isAr ? "تجميع" : "Group") : groupBy === "priority" ? (isAr ? "الأولوية" : "Priority") : groupBy === "status" ? (isAr ? "الحالة" : "Status") : (isAr ? "التصنيف" : "Category")}
                </span>
              </button>
              {groupMenuOpen && (
                <div className="absolute end-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-border/60 bg-card p-1.5 shadow-2xl">
                  {([["none", isAr ? "بدون تجميع" : "No grouping"], ["priority", isAr ? "الأولوية" : "Priority"], ["status", isAr ? "الحالة" : "Status"], ["category", isAr ? "التصنيف" : "Category"]] as const).map(([val, label]) => (
                    <button key={val} onClick={() => { setGroupBy(val); setGroupMenuOpen(false); }}
                      className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition", groupBy === val ? "bg-primary/10 text-primary" : "hover:bg-secondary")}>
                      {groupBy === val && <Check className="h-3.5 w-3.5 shrink-0" />}
                      <span className={groupBy === val ? "" : "ms-5"}>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted-foreground/60 transition hover:bg-secondary hover:text-foreground"
            title={isAr ? "إعدادات المشروع" : "Project settings"}
          >
            <Settings2 className="h-4 w-4" />
            <span className="font-micro text-xs">
              {isAr ? "إعدادات" : "Settings"}
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 border-b border-border/60 bg-card/20 px-6 py-3">
        <StatChip
          icon={<ListChecks className="h-3.5 w-3.5" />}
          label={isAr ? "الكل" : "All"}
          value={projectTasks.length}
        />
        <StatChip
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
          label={isAr ? "خلصت" : "Done"}
          value={tasksByColumn.done.length}
          color="text-emerald-400"
        />
        <StatChip
          icon={<Clock4 className="h-3.5 w-3.5 text-primary" />}
          label={isAr ? "النهارده" : "Today"}
          value={tasksByColumn.today.length}
          color="text-primary"
        />
        <div className="flex-1" />
        {totalEstimated > 0 && (
          <span className="font-micro text-xs text-muted-foreground">
            {totalActual}m / {totalEstimated}m
          </span>
        )}
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-border/40">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: project.color }}
            />
          </div>
          <span className="font-micro text-xs text-muted-foreground">
            {progress}%
          </span>
        </div>
      </div>

      {view === "table" ? (
        <div ref={splitRef} className="flex min-h-0 flex-1">
          <div className={cn("min-h-0 min-w-0 flex-1", openTaskId && "hidden md:block")}>
            <TaskTable
              tasks={projectTasks}
              members={workspaces.find((w) => w.id === project.workspace_id)?.members ?? []}
              projectId={project.id}
              onOpen={setOpenTaskId}
            />
          </div>
          {openTaskId && (
            <>
              {/* Drag handle to resize the split */}
              <div
                onPointerDown={startResize}
                title={isAr ? "اسحب لتغيير الحجم" : "Drag to resize"}
                className="hidden w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-border/40 transition-colors hover:bg-primary/50 md:flex"
              >
                <span className="h-8 w-0.5 rounded-full bg-muted-foreground/40" />
              </div>
              <div
                style={{ "--dw": `${detailPct}%` } as React.CSSProperties}
                className="min-h-0 w-full shrink-0 border-s border-border/60 md:w-[var(--dw)] md:border-s-0"
              >
                <TaskDetailDrawer
                  taskId={openTaskId}
                  embedded
                  onClose={() => setOpenTaskId(null)}
                  taskIds={projectTasks.map((t) => t.id)}
                  onNavigate={setOpenTaskId}
                />
              </div>
            </>
          )}
        </div>
      ) : view === "board" ? (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex flex-1 gap-4 overflow-x-auto p-6">
              {COLUMNS.map((col) => (
                <KanbanCol
                  key={col}
                  column={col}
                  tasks={tasksByColumn[col]}
                  onOpen={setOpenTaskId}
                  projectId={project.id}
                />
              ))}
            </div>

            <DragOverlay>
              {draggingTask && <KanbanCardOverlay task={draggingTask} />}
            </DragOverlay>
          </DndContext>

          {/* Overlay drawer in board mode */}
          <TaskDetailDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
        </>
      ) : (
        /* ── List view: task list (start) + inline detail (main) ── */
        <div className="flex min-h-0 flex-1">
          <div className="flex w-72 shrink-0 flex-col border-e border-border/60">
            <div className="border-b border-border/60 p-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/40 px-2">
                <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createTask(); }}
                  placeholder={isAr ? "أضف مهمة…" : "Add task…"}
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/50"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
              {projectTasks.length === 0 ? (
                <p className="px-3 py-6 text-center font-micro text-xs text-muted-foreground/50">
                  {isAr ? "مفيش مهام لسه" : "No tasks yet"}
                </p>
              ) : (
                projectTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => setOpenTaskId(task.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start transition",
                      openTaskId === task.id ? "bg-primary/10" : "hover:bg-secondary"
                    )}
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_STRIPE[task.priority])} />
                    <span className={cn("min-w-0 flex-1 truncate text-sm", task.status === "done" && "text-muted-foreground line-through")}>
                      {task.title}
                    </span>
                    {task.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {openTaskId ? (
              <TaskDetailDrawer
                taskId={openTaskId}
                embedded
                onClose={() => setOpenTaskId(null)}
                taskIds={projectTasks.map((t) => t.id)}
                onNavigate={setOpenTaskId}
              />
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div className="space-y-2">
                  <ListChecks className="mx-auto h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground/60">
                    {isAr ? "اختر مهمة لعرض تفاصيلها والشات" : "Select a task to view its details and chat"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {editOpen && (
        <EditProjectModal
          project={project}
          onClose={() => setEditOpen(false)}
        />
      )}

      {/* Multi-select action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-border/60 bg-card px-4 py-2.5 shadow-2xl">
          <span className="font-micro text-sm text-muted-foreground">
            {isAr ? `${selectedIds.size} محدد` : `${selectedIds.size} selected`}
          </span>
          <div className="mx-2 h-4 w-px bg-border" />
          <button onClick={markSelectedDone} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1.5 font-micro text-xs text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            {isAr ? "خلص الكل" : "Mark done"}
          </button>
          <button onClick={deleteSelected} className="flex items-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-1.5 font-micro text-xs text-destructive transition hover:bg-destructive/20">
            <Trash2 className="h-3.5 w-3.5" />
            {isAr ? "احذف" : "Delete"}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="grid h-7 w-7 place-items-center rounded-xl text-muted-foreground/60 transition hover:bg-secondary hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={color ?? "text-muted-foreground"}>{icon}</span>
      <span className="font-micro text-xs text-muted-foreground">{label}</span>
      <span className={`font-display text-sm font-medium ${color ?? ""}`}>
        {value}
      </span>
    </div>
  );
}

// ── GroupColumn ───────────────────────────────────────────────────────────────
function GroupColumn({
  groupId, label, dot, tasks, selectedIds, onToggleSelect, onOpen,
}: {
  groupId: string; label: string; dot: string; tasks: Task[];
  selectedIds: Set<string>; onToggleSelect: (id: string) => void; onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: groupId });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        <h3 className="text-[13px] font-semibold tracking-tight">{label}</h3>
        <span className="rounded-full bg-secondary px-1.5 py-0 font-micro text-[10px] font-bold tabular-nums text-muted-foreground leading-[1.4]">{tasks.length}</span>
      </div>
      <div ref={setNodeRef} className={cn("flex-1 space-y-1.5 rounded-xl border border-border/50 bg-secondary/30 p-1.5 transition-colors", isOver && "border-primary/40 bg-primary/5")}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} onOpen={onOpen}
              isSelected={selectedIds.has(task.id)} selectionActive={selectedIds.size > 0} onToggleSelect={onToggleSelect} />
          ))}
        </SortableContext>
        {tasks.length === 0 && !isOver && (
          <div className="grid h-16 place-items-center rounded-lg border border-dashed border-border/40">
            <span className="font-micro text-[10px] text-muted-foreground/40">—</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── GroupedBoard ──────────────────────────────────────────────────────────────
function GroupedBoard({
  projectTasks, groupBy, projectId: _pid, projectWorkspaceId, categories,
  selectedIds, onToggleSelect, onOpen, isAr, updateTask,
}: {
  projectTasks: Task[]; groupBy: "priority" | "status" | "category";
  projectId: string; projectWorkspaceId: string; categories: Category[];
  selectedIds: Set<string>; onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void; isAr: boolean;
  updateTask: (id: string, patch: Partial<Task>) => void;
}) {
  const [dragging, setDragging] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const groups = useMemo(() => {
    if (groupBy === "priority") {
      return (["urgent", "high", "medium", "low"] as Task["priority"][]).map((p) => ({
        id: p,
        label: p === "urgent" ? (isAr ? "\u0639\u0627\u062c\u0644" : "Urgent") : p === "high" ? (isAr ? "\u0639\u0627\u0644\u064a\u0629" : "High") : p === "medium" ? (isAr ? "\u0645\u062a\u0648\u0633\u0637\u0629" : "Medium") : (isAr ? "\u0645\u0646\u062e\u0641\u0636\u0629" : "Low"),
        dot: p === "urgent" ? "bg-red-500" : p === "high" ? "bg-orange-500" : p === "medium" ? "bg-primary" : "bg-muted-foreground/40",
        tasks: projectTasks.filter((t) => t.priority === p),
      }));
    }
    if (groupBy === "status") {
      return (["todo", "in_progress", "done", "cancelled"] as Task["status"][]).map((s) => ({
        id: s,
        label: s === "todo" ? (isAr ? "\u0644\u0645 \u064a\u0628\u062f\u0623" : "To Do") : s === "in_progress" ? (isAr ? "\u0641\u064a \u0627\u0644\u062a\u0646\u0641\u064a\u0630" : "In Progress") : s === "done" ? (isAr ? "\u062e\u0644\u0635\u062a" : "Done") : (isAr ? "\u0645\u0644\u063a\u064a" : "Cancelled"),
        dot: s === "todo" ? "bg-muted-foreground/50" : s === "in_progress" ? "bg-primary" : s === "done" ? "bg-emerald-500" : "bg-red-400",
        tasks: projectTasks.filter((t) => t.status === s),
      }));
    }
    const ws = (categories as (Category & { workspace_id?: string })[]).filter((c) => c.workspace_id === projectWorkspaceId);
    return [
      { id: "__none", label: isAr ? "\u0628\u062f\u0648\u0646 \u062a\u0635\u0646\u064a\u0641" : "Uncategorized", dot: "bg-muted-foreground/30", tasks: projectTasks.filter((t) => !t.category_id) },
      ...ws.map((c) => ({ id: c.id, label: c.name, dot: "bg-primary", tasks: projectTasks.filter((t) => t.category_id === c.id) })),
    ];
  }, [groupBy, projectTasks, categories, projectWorkspaceId, isAr]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId   = over.id as string;
    const activeTask = projectTasks.find((t) => t.id === activeId);
    if (!activeTask) return;
    const src  = groups.find((g) => g.tasks.some((t) => t.id === activeId));
    const dest = groups.find((g) => g.id === overId || g.tasks.some((t) => t.id === overId));
    if (!src || !dest) return;
    if (src.id !== dest.id) {
      if (groupBy === "priority") updateTask(activeId, { priority: dest.id as Task["priority"] });
      else if (groupBy === "status") { const s = dest.id as Task["status"]; updateTask(activeId, { status: s, column: (s === "done" || s === "cancelled" ? "done" : activeTask.column) as KanbanColumn }); }
      else updateTask(activeId, { category_id: dest.id === "__none" ? null : dest.id });
    } else {
      const col = [...dest.tasks];
      const fi = col.findIndex((t) => t.id === activeId);
      const ti = col.findIndex((t) => t.id === overId);
      if (fi === -1 || ti === -1) return;
      arrayMove(col, fi, ti).forEach((t, i) => { if (t.position !== i * 100) updateTask(t.id, { position: i * 100 }); });
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={({ active }) => setDragging(projectTasks.find((t) => t.id === active.id) ?? null)}
      onDragEnd={handleDragEnd}>
      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {groups.map((g) => (
          <GroupColumn key={g.id} groupId={g.id} label={g.label} dot={g.dot} tasks={g.tasks}
            selectedIds={selectedIds} onToggleSelect={onToggleSelect} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay>{dragging && <KanbanCardOverlay task={dragging} />}</DragOverlay>
    </DndContext>
  );
}
