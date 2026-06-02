import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowLeft, CheckCircle2, Clock4, ListChecks, Settings2 } from "lucide-react";
import {
  useTasksStore,
  type KanbanColumn,
  type Task,
} from "../stores/tasksStore";
import { KanbanColumn as KanbanCol } from "../components/projects/KanbanColumn";
import { KanbanCardOverlay } from "../components/projects/KanbanCard";
import { TaskDetailDrawer } from "../components/tasks/TaskDetailDrawer";
import { EditProjectModal } from "./Projects";

const COLUMNS: KanbanColumn[] = ["backlog", "this_week", "today", "done"];

export default function ProjectBoard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const projects = useTasksStore((s) => s.projects);
  const tasks = useTasksStore((s) => s.tasks);
  const updateTask = useTasksStore((s) => s.updateTask);
  const moveTask = useTasksStore((s) => s.moveTask);

  const project = projects.find((p) => p.id === id);

  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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

        <div className="ms-auto">
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

      <TaskDetailDrawer
        taskId={openTaskId}
        onClose={() => setOpenTaskId(null)}
      />

      {editOpen && (
        <EditProjectModal
          project={project}
          onClose={() => setEditOpen(false)}
        />
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
