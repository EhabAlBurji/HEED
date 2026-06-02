import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Circle,
  Frame,
  Image as ImageIcon,
  Link2,
  ListTodo,
  Mic,
  Plus,
  Redo2,
  Square,
  StickyNote,
  Type,
  Undo2,
  Video,
} from "lucide-react";
import { useTasksStore } from "../../stores/tasksStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useCanvasStore, type CanvasNode, type CanvasNodeType } from "../../stores/canvasStore";
import { cn } from "../../lib/utils";

type AddFn = (type: CanvasNodeType, data?: CanvasNode["data"]) => void;

const BUTTONS: { type: CanvasNodeType; icon: React.ReactNode; labelKey: string; data?: CanvasNode["data"] }[] = [
  { type: "text", icon: <Type className="h-4 w-4" />, labelKey: "canvas.nText" },
  { type: "sticky", icon: <StickyNote className="h-4 w-4" />, labelKey: "canvas.nSticky" },
  { type: "image", icon: <ImageIcon className="h-4 w-4" />, labelKey: "canvas.nImage" },
  { type: "video", icon: <Video className="h-4 w-4" />, labelKey: "canvas.nVideo" },
  { type: "voice", icon: <Mic className="h-4 w-4" />, labelKey: "canvas.nVoice" },
  { type: "link", icon: <Link2 className="h-4 w-4" />, labelKey: "canvas.nLink" },
  { type: "frame", icon: <Frame className="h-4 w-4" />, labelKey: "canvas.nFrame" },
  { type: "shape", icon: <Square className="h-4 w-4" />, labelKey: "canvas.nRect", data: { shape: "rect" } },
  { type: "shape", icon: <Circle className="h-4 w-4" />, labelKey: "canvas.nCircle", data: { shape: "ellipse" } },
];

export function CanvasToolbar({ projectId, onAdd }: { projectId: string | null; onAdd: AddFn }) {
  const { t } = useTranslation();
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute start-4 top-4 z-20 flex items-center gap-1 rounded-2xl border border-border/60 bg-card/90 p-1.5 shadow-xl backdrop-blur"
    >
      <button
        onClick={undo}
        disabled={!canUndo}
        title={t("canvas.undo")}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title={t("canvas.redo")}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Redo2 className="h-4 w-4" />
      </button>
      <div className="mx-0.5 h-6 w-px bg-border/60" />
      <TaskPicker projectId={projectId} onAdd={onAdd} />
      <div className="mx-0.5 h-6 w-px bg-border/60" />
      {BUTTONS.map((b, i) => (
        <button
          key={i}
          onClick={() => onAdd(b.type, b.data)}
          draggable
          onDragStart={(e) => {
            // Drag a node type onto the canvas to drop it at that spot.
            e.dataTransfer.setData(
              "application/x-heed-node",
              JSON.stringify({ type: b.type, data: b.data })
            );
            e.dataTransfer.effectAllowed = "copy";
          }}
          title={t(b.labelKey)}
          className="grid h-8 w-8 cursor-grab place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground active:cursor-grabbing"
        >
          {b.icon}
        </button>
      ))}
    </div>
  );
}

// Task node picker: choose an existing task, or create a new one. For a
// project canvas it lists that project's tasks; for a standalone board it
// lists the active workspace's tasks.
function TaskPicker({ projectId, onAdd }: { projectId: string | null; onAdd: AddFn }) {
  const { t: tr } = useTranslation();
  const tasks = useTasksStore((s) => s.tasks);
  const addTask = useTasksStore((s) => s.addTask);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const projectTasks = projectId
    ? tasks.filter((t) => t.project_id === projectId)
    : tasks.filter((t) => t.workspace_id === activeWorkspaceId);
  const onCanvasTaskIds = useCanvasOnboardIds();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const createNew = () => {
    const t = title.trim();
    if (!t) return;
    const task = addTask({ title: t, project_id: projectId ?? null });
    onAdd("task", { taskId: task.id });
    setTitle("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={tr("canvas.taskCard")}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-primary transition hover:bg-primary/20"
      >
        <ListTodo className="h-4 w-4" />
        <Plus className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute start-0 top-full mt-1.5 max-h-80 w-64 overflow-y-auto rounded-xl border border-border/60 bg-card p-2 shadow-2xl">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2 py-1.5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createNew()}
              placeholder={tr("canvas.newTask")}
              className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
            />
            <button
              onClick={createNew}
              className="rounded-md bg-primary px-2 py-0.5 font-micro text-[10px] text-primary-foreground hover:opacity-90"
            >
              {tr("canvas.add")}
            </button>
          </div>

          <p className="px-1 pb-1 pt-2 font-micro text-[10px] uppercase tracking-widest text-muted-foreground/60">
            {tr("canvas.projectTasks")}
          </p>
          {projectTasks.length === 0 && (
            <p className="px-1 py-2 font-micro text-[11px] text-muted-foreground/50">{tr("canvas.noTasks")}</p>
          )}
          {projectTasks.map((t) => {
            const placed = onCanvasTaskIds.has(t.id);
            return (
              <button
                key={t.id}
                disabled={placed}
                onClick={() => {
                  onAdd("task", { taskId: t.id });
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs transition",
                  placed
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : "hover:bg-secondary"
                )}
              >
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {placed && <span className="font-micro text-[9px]">{tr("canvas.onBoard")}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Task ids already represented as task nodes anywhere on the canvas,
// so the picker can disable duplicates.
function useCanvasOnboardIds() {
  const nodes = useCanvasStore((s) => s.nodes);
  return new Set(
    nodes.filter((n) => n.type === "task" && n.data.taskId).map((n) => n.data.taskId as string)
  );
}
