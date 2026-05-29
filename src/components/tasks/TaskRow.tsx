import { useState, useRef, useEffect } from "react";
import { Check, Play, Pause, Square, Send, Share2, Copy, X, Clock, Calendar, Trash2, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Task } from "../../stores/tasksStore";
import { useTasksStore } from "../../stores/tasksStore";
import { useTimerStore } from "../../stores/timerStore";
import { useScheduleStore } from "../../stores/scheduleStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useUIStore } from "../../stores/uiStore";
import { useNow } from "../../hooks/useNow";
import { cn, formatHMS } from "../../lib/utils";
import { pauseAndCommit, stopTimerAndCommit } from "../../lib/timerActions";
import { formatScheduleDate } from "../../lib/scheduleDates";

async function hideToTray() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("hide_to_tray");
  } catch {}
}

// Dense task row — single line, ~44px tall.
// Subtle priority color via thin stripe + dot. Actions appear as small icons
// on the right (always visible but muted; highlight on hover).

const priorityConfig: Record<
  Task["priority"],
  { stripe: string; dot: string }
> = {
  urgent: { stripe: "bg-red-500",            dot: "bg-red-500" },
  high:   { stripe: "bg-orange-500",         dot: "bg-orange-500" },
  medium: { stripe: "bg-primary",            dot: "bg-primary" },
  low:    { stripe: "bg-muted-foreground/40", dot: "bg-muted-foreground/40" },
};

const videoStageLabels: Record<NonNullable<Task["video_stage"]>, { label: string; color: string }> = {
  idea:      { label: "فكرة",    color: "text-violet-400" },
  script:    { label: "سكريبت", color: "text-blue-400" },
  filming:   { label: "تصوير",  color: "text-cyan-400" },
  editing:   { label: "مونتاج", color: "text-teal-400" },
  scheduled: { label: "مجدول",  color: "text-emerald-400" },
  published: { label: "منشور",  color: "text-green-400" },
};

export function TaskRow({ task, onOpen }: { task: Task; onOpen: (id: string) => void }) {
  useTranslation(); // re-render on locale change
  const toggleDone  = useTasksStore((s) => s.toggleDone);
  const deleteTask  = useTasksStore((s) => s.deleteTask);
  const addPost     = useScheduleStore((s) => s.addPost);
  const allPosts    = useScheduleStore((s) => s.posts);
  const cat         = useTasksStore((s) => s.categories.find((c) => c.id === task.category_id) ?? null);
  const project     = useTasksStore((s) => s.projects.find((p) => p.id === task.project_id) ?? null);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const isActive  = useTimerStore((s) => s.activeTask?.id === task.id);
  const startTask = useTimerStore((s) => s.startTask);
  const setIsTray = useUIStore((s) => s.setIsTray);
  const isDone    = task.status === "done";

  const [showPrompt, setShowPrompt]       = useState(false);
  const [promptDate, setPromptDate]       = useState("");
  const [showShare, setShowShare]         = useState(false);
  const [copied, setCopied]               = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  const isContent        = task.video_stage !== null && task.video_stage !== "published";
  const scheduledPost = allPosts.find(
    (p) => p.taskId === task.id && (p.workspace_id ?? "personal") === activeWorkspaceId,
  );
  const alreadyScheduled = !!scheduledPost;
  const publishDateLabel = scheduledPost
    ? formatScheduleDate(scheduledPost.scheduledDate, scheduledPost.scheduledTime) || "بدون تاريخ"
    : "";
  const cfg = priorityConfig[task.priority];

  useEffect(() => {
    if (!showShare) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShowShare(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showShare]);

  const handleToggleDone = () => {
    const markingDone = task.status !== "done";
    toggleDone(task.id);
    if (markingDone && isContent && !alreadyScheduled) setShowPrompt(true);
  };

  const handleAddToSchedule = () => {
    addPost({
      title: task.title,
      notes: "",
      platforms: [],
      scheduledDate: promptDate ? promptDate.slice(5) : null,
      scheduledTime: null,
      tags: [],
      column: promptDate ? "this_week" : "content",
      position: Date.now(),
      taskId: task.id,
      links: [],
      previewImageUrl: null,
      workspace_id: activeWorkspaceId,
    });
    setShowPrompt(false);
    setPromptDate("");
  };

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(`mindora://task/${task.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFocus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isActive && !isDone) {
      startTask(
        { id: task.id, title: task.title, estimatedMinutes: task.estimated_minutes, categoryColor: cat?.color ?? null },
        null,
      );
    }
    setIsTray(true);
    await hideToTray();
  };

  return (
    <div
      className={cn(
        "group/row row-surface relative flex flex-col overflow-hidden rounded-lg",
        isDone && "opacity-60",
        isActive && "!border-primary/50 ring-1 ring-primary/25",
      )}
    >
      {/* Thin priority stripe */}
      <span className={cn("absolute inset-y-0 start-0 w-[3px]", cfg.stripe, isActive && "!bg-primary")} />

      {/* Main row */}
      <div className="flex items-center gap-2 ps-2.5 pe-1.5 py-2">
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleDone(); }}
          aria-label="toggle done"
          className={cn(
            "grid h-4 w-4 shrink-0 place-items-center rounded-full border-[1.5px] transition-all",
            isDone
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-border hover:border-primary hover:bg-primary/10",
          )}
        >
          {isDone && <Check className="h-2.5 w-2.5 stroke-[3]" />}
        </button>

        {/* Body — clickable */}
        <button onClick={() => onOpen(task.id)} className="flex min-w-0 flex-1 items-center gap-2 text-start">
          {/* Title + project line */}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className={cn(
              "truncate text-[13px] font-medium leading-tight",
              isDone && "line-through text-muted-foreground",
            )}>
              {task.title}
            </span>
            {(project || cat || task.video_stage) && (
              <span className="flex items-center gap-2 truncate font-micro text-[10px] leading-none">
                {project && (
                  <span className="flex items-center gap-1" style={{ color: project.color }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: project.color }} />
                    {project.name}
                  </span>
                )}
                {cat && (
                  <span style={{ color: cat.color }}>{cat.name}</span>
                )}
                {task.video_stage && (
                  <span className={videoStageLabels[task.video_stage].color}>
                    {videoStageLabels[task.video_stage].label}
                  </span>
                )}
              </span>
            )}
          </span>

          {/* Inline meta — only if any */}
          <span className="ms-auto hidden shrink-0 items-center gap-1.5 font-micro text-[10px] text-muted-foreground/70 md:flex">
            {isActive && <ActiveTimerInline />}
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
          </span>
        </button>

        {/* Action icons — compact horizontal row */}
        <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {/* Active-state timer controls */}
          {isActive && (
            <ActiveTimerControls />
          )}

          {/* Focus / hide to tray */}
          {!isDone && !isActive && (
            <IconBtn onClick={handleFocus} title="تركيز — يصغر للـ Menu Bar">
              <Target className="h-3 w-3" />
            </IconBtn>
          )}

          {/* Share */}
          <div className="relative" ref={shareRef}>
            <IconBtn
              onClick={(e) => { e.stopPropagation(); setShowShare((v) => !v); }}
              title="مشاركة"
            >
              <Share2 className="h-3 w-3" />
            </IconBtn>

            {showShare && (
              <div
                className="absolute end-0 top-7 z-50 w-60 rounded-xl border border-border bg-popover p-3 shadow-2xl"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium">مشاركة المهمة</span>
                  <button onClick={() => setShowShare(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate font-micro text-[10px] text-muted-foreground">
                    mindora://task/{task.id}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 font-micro text-[10px] transition",
                      copied ? "bg-emerald-500/20 text-emerald-500" : "bg-primary/15 text-primary hover:bg-primary/25",
                    )}
                  >
                    {copied ? "✓" : <Copy className="h-2.5 w-2.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Delete (with inline confirm) */}
          {deleteConfirm ? (
            <>
              <button
                onClick={() => deleteTask(task.id)}
                className="rounded-md bg-destructive/20 px-1.5 py-0.5 font-micro text-[10px] font-semibold text-destructive hover:bg-destructive/35 transition"
              >
                حذف
              </button>
              <IconBtn onClick={() => setDeleteConfirm(false)} title="إلغاء">
                <X className="h-3 w-3" />
              </IconBtn>
            </>
          ) : (
            <IconBtn
              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(true); }}
              title="حذف"
              danger
            >
              <Trash2 className="h-3 w-3" />
            </IconBtn>
          )}
        </div>
      </div>

      {/* Scheduled post badge — small inline under main row */}
      {scheduledPost && (
        <div className="border-t border-border/40 bg-emerald-500/5 px-3 py-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-micro text-[10px] text-emerald-500 dark:text-emerald-400">
            <span className="flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              {publishDateLabel}
            </span>
            {scheduledPost.platforms.length > 0 && (
              <span className="opacity-70">· {scheduledPost.platforms.join(" · ")}</span>
            )}
          </div>
        </div>
      )}

      {/* Schedule prompt (after marking done content task) */}
      {showPrompt && (
        <div className="border-t border-border/40 bg-primary/8 px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 font-micro text-[11px] text-primary">
            <Send className="h-3 w-3" />
            <span>إضافة لجدولة النشر؟</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={promptDate}
              onChange={(e) => setPromptDate(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-1.5 py-0.5 font-micro text-[11px] outline-none focus:ring-1 focus:ring-primary/40"
            />
            <button onClick={handleAddToSchedule} className="rounded-md bg-primary/20 px-2 py-0.5 font-micro text-[11px] text-primary hover:bg-primary/30">
              إضافة
            </button>
            <button onClick={() => setShowPrompt(false)} className="rounded-md bg-secondary px-2 py-0.5 font-micro text-[11px] text-muted-foreground hover:bg-secondary/80">
              تخطي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable compact icon button ─────────────────────────────────────────────
function IconBtn({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground/50 transition",
        danger
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-primary/10 hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}

// ── Active timer pieces ──────────────────────────────────────────────────────
function ActiveTimerInline() {
  useNow(1000);
  const elapsed = useTimerStore((s) => s.getElapsedSeconds());
  return (
    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 tabular-nums text-[10px] font-semibold text-primary">
      {formatHMS(elapsed)}
    </span>
  );
}

function ActiveTimerControls() {
  const isRunning = useTimerStore((s) => s.isRunning);
  const resume    = useTimerStore((s) => s.resume);
  return (
    <>
      {isRunning ? (
        <IconBtn onClick={(e) => { e.stopPropagation(); pauseAndCommit(); }} title="إيقاف مؤقت">
          <Pause className="h-3 w-3" />
        </IconBtn>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); resume(); }}
          title="استئناف"
          className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground hover:opacity-90"
        >
          <Play className="h-3 w-3" />
        </button>
      )}
      <IconBtn onClick={(e) => { e.stopPropagation(); stopTimerAndCommit(); }} title="إنهاء" danger>
        <Square className="h-3 w-3" />
      </IconBtn>
    </>
  );
}
