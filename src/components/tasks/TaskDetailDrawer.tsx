import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CalendarDays, ChevronDown, ExternalLink, FolderKanban, Link2, Plus, Trash2, X } from "lucide-react";
import {
  useTasksStore,
  type Task,
  type VideoStage,
} from "../../stores/tasksStore";
import { useScheduleStore } from "../../stores/scheduleStore";
import { cn } from "../../lib/utils";
import { formatScheduleDate } from "../../lib/scheduleDates";
import { QUICK_ESTIMATED_MINUTES, quickTaskDates } from "../../lib/taskDateShortcuts";
import { PRIORITIES as priorities, PRIORITY_SOLID as priorityBg } from "../../lib/taskMeta";
import { TaskComments } from "./TaskComments";

const videoStages: VideoStage[] = [
  "idea",
  "script",
  "filming",
  "editing",
  "scheduled",
  "published",
];

export function TaskDetailDrawer({
  taskId,
  onClose,
}: {
  taskId: string | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const tasks = useTasksStore((s) => s.tasks);
  const categories = useTasksStore((s) => s.categories);
  const projects = useTasksStore((s) => s.projects);
  const updateTask = useTasksStore((s) => s.updateTask);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const scheduledPosts = useScheduleStore((s) => s.posts);

  const task = tasks.find((x) => x.id === taskId) ?? null;
  const scheduledPost = scheduledPosts.find((p) => p.taskId === taskId) ?? null;
  const [draft, setDraft] = useState<Task | null>(task);

  useEffect(() => {
    setDraft(task);
  }, [task]);

  // Auto-save on draft changes (debounced 300ms)
  useEffect(() => {
    if (!draft || !task) return;
    if (JSON.stringify(draft) === JSON.stringify(task)) return;
    const id = window.setTimeout(() => {
      updateTask(draft.id, draft);
    }, 300);
    return () => window.clearTimeout(id);
  }, [draft, task, updateTask]);

  if (!taskId) return null;

  if (!task || !draft) {
    return (
      <Backdrop onClose={onClose}>
        <p className="p-8 text-sm text-muted-foreground">Task not found.</p>
      </Backdrop>
    );
  }

  const selectedCategory = categories.find((c) => c.id === draft.category_id);
  const isVideoCategory = selectedCategory?.type === "video";
  const quickDates = quickTaskDates();

  const addLink = () =>
    setDraft({ ...draft, links: [...draft.links, { label: "", url: "" }] });

  const updateLink = (i: number, field: "url" | "label", val: string) => {
    const links = draft.links.map((l, idx) =>
      idx === i ? { ...l, [field]: val } : l
    );
    setDraft({ ...draft, links });
  };

  const removeLink = (i: number) =>
    setDraft({ ...draft, links: draft.links.filter((_, idx) => idx !== i) });

  return (
    <Backdrop onClose={onClose}>
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </button>
        <button
          onClick={() => {
            deleteTask(task.id);
            onClose();
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("common.delete")}
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
        {/* Priority color banner */}
        <div
          className={cn(
            "rounded-xl px-3 py-1.5 font-micro text-xs font-medium",
            priorityBg[draft.priority]
          )}
        >
          {t(`tasks.priorities.${draft.priority}`)} ·{" "}
          {draft.column === "today"
            ? "النهارده"
            : draft.column === "this_week"
            ? "الأسبوع ده"
            : draft.column === "done"
            ? "خلصت"
            : "تراكمي"}
        </div>

        {/* Title */}
        <div>
          <Label>{t("tasks.title")}</Label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-lg font-medium outline-none focus:border-primary/50"
          />
        </div>

        {/* Notes */}
        <div>
          <Label>{t("tasks.notes")}</Label>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            rows={4}
            className="mt-1 w-full resize-y rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/50"
            placeholder="اكتب تفاصيل أو ملاحظات…"
          />
        </div>

        {/* Priority */}
        <div>
          <Label>{t("tasks.priority")}</Label>
          <div className="mt-2 flex gap-1.5">
            {priorities.map((p) => (
              <button
                key={p}
                onClick={() => setDraft({ ...draft, priority: p })}
                className={cn(
                  "flex-1 rounded-lg px-2 py-2 font-micro text-xs font-medium transition",
                  draft.priority === p
                    ? priorityBg[p]
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {t(`tasks.priorities.${p}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Move to project */}
        <MoveToProject
          projects={projects}
          currentProjectId={draft.project_id}
          onChange={(id) => setDraft({ ...draft, project_id: id })}
        />

        <div className="grid grid-cols-2 gap-4">
          {/* Category */}
          <div className="col-span-2">
            <Label>{t("tasks.category")}</Label>
            <select
              value={draft.category_id ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, category_id: e.target.value || null })
              }
              className="mt-1 w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/50"
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Deadline */}
          <div>
            <Label>{t("tasks.deadline")}</Label>
            <input
              type="date"
              value={draft.deadline ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, deadline: e.target.value || null })
              }
              className="mt-1 w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickDates.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, deadline: option.value })}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-micro text-[10px] transition",
                    draft.deadline === option.value
                      ? "border-primary/45 bg-primary/15 text-primary"
                      : "border-border/40 bg-background/40 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                  )}
                >
                  {i18n.language === "ar" ? option.labelAr : option.labelEn}
                </button>
              ))}
              {draft.deadline && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, deadline: null })}
                  className="rounded-full border border-border/30 bg-secondary/30 px-2.5 py-1 font-micro text-[10px] text-muted-foreground hover:bg-secondary/60"
                >
                  {i18n.language === "ar" ? "بدون تاريخ" : "No date"}
                </button>
              )}
            </div>
          </div>

          {/* Estimated */}
          <div>
            <Label>{t("tasks.estimated")} (min)</Label>
            <input
              type="number"
              min={0}
              value={draft.estimated_minutes ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  estimated_minutes:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_ESTIMATED_MINUTES.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDraft({ ...draft, estimated_minutes: minutes })}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-micro text-[10px] transition",
                    draft.estimated_minutes === minutes
                      ? "border-primary/45 bg-primary/15 text-primary"
                      : "border-border/40 bg-background/40 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                  )}
                >
                  {minutes}م
                </button>
              ))}
            </div>
          </div>
        </div>

        {scheduledPost && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
            <Label>تاريخ النشر</Label>
            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-400">
              <CalendarDays className="h-4 w-4" />
              <span>{formatScheduleDate(scheduledPost.scheduledDate, scheduledPost.scheduledTime) || "بدون تاريخ محدد"}</span>
            </div>

            {(scheduledPost.platforms.length > 0 || scheduledPost.notes || scheduledPost.links.length > 0) && (
              <div className="mt-3 space-y-2 border-t border-emerald-500/15 pt-3">
                {scheduledPost.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {scheduledPost.platforms.map((platform) => (
                      <span
                        key={platform}
                        className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-micro text-[10px] text-emerald-300"
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                )}

                {scheduledPost.notes && (
                  <p className="font-micro text-xs leading-relaxed text-muted-foreground">
                    {scheduledPost.notes}
                  </p>
                )}

                {scheduledPost.links.length > 0 && (
                  <div className="flex items-center gap-1.5 font-micro text-xs text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" />
                    <span>{scheduledPost.links.length} روابط مرتبطة بالمنشور</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Video stages */}
        {isVideoCategory && (
          <div>
            <Label>{t("tasks.video.stage")}</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {videoStages.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      video_stage: draft.video_stage === s ? null : s,
                    })
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 font-micro text-xs transition",
                    draft.video_stage === s
                      ? "border-primary bg-primary/15 text-primary-foreground"
                      : "border-border/60 bg-background/30 text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {t(`tasks.video.${s}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reference links */}
        <div>
          <div className="flex items-center justify-between">
            <Label>{t("tasks.links")}</Label>
            <button
              onClick={addLink}
              className="inline-flex items-center gap-1 font-micro text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              {t("tasks.addLink")}
            </button>
          </div>

          {draft.links.length === 0 && (
            <p className="mt-2 font-micro text-xs text-muted-foreground/50">
              مفيش روابط مضافة لسه
            </p>
          )}

          <div className="mt-2 space-y-2">
            {draft.links.map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(i, "url", e.target.value)}
                  placeholder="https://..."
                  className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 font-micro text-xs outline-none focus:border-primary/50"
                />
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => updateLink(i, "label", e.target.value)}
                  placeholder="تسمية"
                  className="w-20 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 font-micro text-xs outline-none focus:border-primary/50"
                />
                {link.url && (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={() => removeLink(i)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Time tracked */}
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <Label>{t("tasks.actual")}</Label>
          <p className="mt-2 font-display text-2xl">
            {draft.actual_minutes}
            <span className="ms-1 text-sm text-muted-foreground">min</span>
          </p>
          {draft.estimated_minutes !== null && (
            <p className="mt-1 font-micro text-xs text-muted-foreground">
              {draft.actual_minutes > draft.estimated_minutes
                ? `+${draft.actual_minutes - draft.estimated_minutes}m ${t("timer.overtime")}`
                : `${draft.estimated_minutes - draft.actual_minutes}m ${t("timer.remaining")}`}
            </p>
          )}
        </div>

        {/* Comments & activity */}
        <div className="border-t border-border/40 pt-5">
          <TaskComments taskId={draft.id} workspaceId={draft.workspace_id} />
        </div>
      </div>
    </Backdrop>
  );
}

// ── Move to project picker ─────────────────────────────────────────────────
type ProjectItem = { id: string; name: string; color: string; icon: string };

function MoveToProject({
  projects,
  currentProjectId,
  onChange,
}: {
  projects: ProjectItem[];
  currentProjectId: string | null;
  onChange: (id: string | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = projects.find((p) => p.id === currentProjectId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Label>
        {isAr ? "المشروع" : t("projects.title")}
      </Label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-sm transition hover:border-primary/40"
      >
        {current ? (
          <>
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
              style={{ backgroundColor: current.color }}
            >
              {current.icon}
            </div>
            <span className="flex-1 text-start font-medium">{current.name}</span>
          </>
        ) : (
          <>
            <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            <span className="flex-1 text-start text-muted-foreground/60">
              {isAr ? "بدون مشروع" : "No project"}
            </span>
          </>
        )}
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute start-0 end-0 top-full z-50 mt-1 rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
          {/* No project option */}
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition hover:bg-white/5",
              !currentProjectId && "bg-primary/8"
            )}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary/60">
              <FolderKanban className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <span className="flex-1 text-start text-muted-foreground">
              {isAr ? "بدون مشروع" : "No project"}
            </span>
            {!currentProjectId && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
          </button>

          {projects.length > 0 && (
            <div className="border-t border-border/30">
              {projects.map((p) => {
                const isSelected = p.id === currentProjectId;
                return (
                  <button
                    key={p.id}
                    onClick={() => { onChange(p.id); setOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition hover:bg-white/5",
                      isSelected && "bg-primary/8"
                    )}
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.icon}
                    </div>
                    <span className="flex-1 text-start font-medium">{p.name}</span>
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-micro text-[11px] uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col border-s border-border/60 bg-card shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}
