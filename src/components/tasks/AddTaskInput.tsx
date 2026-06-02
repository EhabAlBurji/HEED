import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ExternalLink,
  FolderKanban,
  Plus,
  X,
} from "lucide-react";
import {
  useTasksStore,
  type KanbanColumn,
  type Priority,
  type VideoStage,
} from "../../stores/tasksStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { cn } from "../../lib/utils";
import { QUICK_ESTIMATED_MINUTES, quickTaskDates } from "../../lib/taskDateShortcuts";
import { PRIORITIES as priorities, PRIORITY_CHIP as priorityChip } from "../../lib/taskMeta";

const videoStages: VideoStage[] = [
  "idea",
  "script",
  "filming",
  "editing",
  "scheduled",
  "published",
];

export function AddTaskInput({
  defaultDeadline = null,
  defaultProjectId = null,
  defaultColumn,
  lockProject = false,
  onAdded,
}: {
  defaultDeadline?: string | null;
  /** Pre-select (and optionally lock) the project — used inside a project board. */
  defaultProjectId?: string | null;
  /** Kanban column the task is created in — used inside a project board. */
  defaultColumn?: KanbanColumn;
  /** Hide the project picker (project is fixed by the surrounding board). */
  lockProject?: boolean;
  /** Called after a task is successfully added. */
  onAdded?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [deadline, setDeadline] = useState<string | null>(defaultDeadline);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [videoStage, setVideoStage] = useState<VideoStage | null>(null);
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([]);

  const addTask = useTasksStore((s) => s.addTask);
  const projects = useTasksStore((s) => s.projects);
  const categories = useTasksStore((s) => s.categories);
  const tags = useTasksStore((s) => s.tags);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const visibleProjects = projects.filter(
    (p) =>
      p.workspace_id === activeWorkspaceId ||
      (p.shared_workspace_ids ?? []).includes(activeWorkspaceId)
  );

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isVideoCategory = selectedCategory?.type === "video";

  const hasTitle = value.trim().length > 0;
  const canSubmit = hasTitle;

  const reset = () => {
    setValue("");
    setNotes("");
    setPriority("medium");
    setDeadline(defaultDeadline);
    setEstimatedMinutes(null);
    setProjectId(defaultProjectId);
    setCategoryId(null);
    setTagIds([]);
    setVideoStage(null);
    setLinks([]);
  };

  const submit = () => {
    if (!canSubmit) return;
    addTask({
      title: value.trim(),
      notes,
      priority,
      deadline,
      estimated_minutes: estimatedMinutes,
      project_id: projectId,
      category_id: categoryId,
      tag_ids: tagIds,
      video_stage: isVideoCategory ? videoStage : null,
      links: links.filter((l) => l.url.trim().length > 0),
      workspace_id: activeWorkspaceId,
      ...(defaultColumn ? { column: defaultColumn } : {}),
    });
    reset();
    onAdded?.();
  };

  // Enter in the title field saves; Shift+Enter is reserved for newlines elsewhere.
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const toggleTag = (id: string) =>
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const addLink = () => setLinks((prev) => [...prev, { label: "", url: "" }]);
  const updateLink = (i: number, field: "url" | "label", val: string) =>
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  const removeLink = (i: number) =>
    setLinks((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/40 transition-all focus-within:border-primary/50",
        hasTitle && "border-primary/30"
      )}
    >
      {/* Title row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={t("tasks.newTask") + (isAr ? " — اضغط Enter للحفظ" : " — press Enter to save")}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* All task settings — shown once you start typing a title */}
      {hasTitle && (
        <div className="space-y-3 border-t border-border/40 px-3 py-3">
          {/* Priority */}
          <Row label={t("tasks.priority")}>
            {priorities.map((p) => (
              <Chip
                key={p}
                active={priority === p}
                activeClassName={priorityChip[p]}
                onClick={() => setPriority(p)}
              >
                {t(`tasks.priorities.${p}`)}
              </Chip>
            ))}
          </Row>

          {/* Deadline */}
          <Row label={t("tasks.deadline")}>
            {quickTaskDates().map((option) => (
              <Chip
                key={option.value}
                active={deadline === option.value}
                onClick={() => setDeadline(option.value)}
              >
                {isAr ? option.labelAr : option.labelEn}
              </Chip>
            ))}
            {deadline && (
              <Chip onClick={() => setDeadline(null)} muted>
                {isAr ? "بدون تاريخ" : "No date"}
              </Chip>
            )}
          </Row>

          {/* Estimated time */}
          <Row label={t("tasks.estimated")}>
            {QUICK_ESTIMATED_MINUTES.map((m) => (
              <Chip
                key={m}
                active={estimatedMinutes === m}
                onClick={() => setEstimatedMinutes(estimatedMinutes === m ? null : m)}
              >
                {isAr ? `${m}د` : `${m}m`}
              </Chip>
            ))}
          </Row>

          {/* Project */}
          {!lockProject && (
          <Row
            label={isAr ? "المشروع" : "Project"}
            icon={<FolderKanban className="h-3.5 w-3.5 text-muted-foreground/50" />}
          >
            <Chip active={projectId === null} onClick={() => setProjectId(null)}>
              {isAr ? "بدون مشروع" : "No project"}
            </Chip>
            {visibleProjects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProjectId(p.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-micro text-[10px] transition",
                  projectId === p.id ? "opacity-100" : "opacity-60 hover:opacity-90"
                )}
                style={
                  projectId === p.id
                    ? { borderColor: p.color, backgroundColor: `${p.color}25`, color: p.color }
                    : { borderColor: `${p.color}40`, backgroundColor: `${p.color}10`, color: p.color }
                }
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </button>
            ))}
          </Row>
          )}

          {/* Category */}
          {categories.length > 0 && (
            <Row label={t("tasks.category")}>
              <Chip
                active={categoryId === null}
                onClick={() => {
                  setCategoryId(null);
                  setVideoStage(null);
                }}
              >
                —
              </Chip>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(c.id);
                    if (c.type !== "video") setVideoStage(null);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-micro text-[10px] transition",
                    categoryId === c.id ? "opacity-100" : "opacity-60 hover:opacity-90"
                  )}
                  style={
                    categoryId === c.id
                      ? { borderColor: c.color, backgroundColor: `${c.color}25`, color: c.color }
                      : { borderColor: `${c.color}40`, backgroundColor: `${c.color}10`, color: c.color }
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              ))}
            </Row>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <Row label={isAr ? "الوسوم" : "Tags"}>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-micro text-[10px] transition",
                    tagIds.includes(tag.id) ? "opacity-100" : "opacity-60 hover:opacity-90"
                  )}
                  style={
                    tagIds.includes(tag.id)
                      ? { borderColor: tag.color, backgroundColor: `${tag.color}25`, color: tag.color }
                      : { borderColor: `${tag.color}40`, backgroundColor: `${tag.color}10`, color: tag.color }
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </Row>
          )}

          {/* Video stage — only for video categories */}
          {isVideoCategory && (
            <Row label={t("tasks.video.stage")}>
              {videoStages.map((s) => (
                <Chip
                  key={s}
                  active={videoStage === s}
                  onClick={() => setVideoStage(videoStage === s ? null : s)}
                >
                  {t(`tasks.video.${s}`)}
                </Chip>
              ))}
            </Row>
          )}

          {/* Notes */}
          <div>
            <Label>{t("tasks.notes")}</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={isAr ? "اكتب تفاصيل أو ملاحظات…" : "Add details or notes…"}
              className="mt-1 w-full resize-y rounded-lg border border-border/60 bg-background/60 px-3 py-2 font-micro text-xs outline-none focus:border-primary/50"
            />
          </div>

          {/* Reference links */}
          <div>
            <div className="flex items-center justify-between">
              <Label>{t("tasks.links")}</Label>
              <button
                type="button"
                onClick={addLink}
                className="inline-flex items-center gap-1 font-micro text-[11px] text-primary hover:underline"
              >
                <Plus className="h-3 w-3" />
                {t("tasks.addLink")}
              </button>
            </div>
            {links.length > 0 && (
              <div className="mt-2 space-y-2">
                {links.map((link, i) => (
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
                      placeholder={isAr ? "تسمية" : "label"}
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
                      type="button"
                      onClick={() => removeLink(i)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirm */}
          <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("common.add")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small presentational helpers ───────────────────────────────────────────
function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex shrink-0 items-center gap-1.5">
        {icon}
        <span className="font-micro text-[11px] text-muted-foreground/60">{label}:</span>
      </div>
      {children}
    </div>
  );
}

function Chip({
  active = false,
  muted = false,
  activeClassName,
  onClick,
  children,
}: {
  active?: boolean;
  muted?: boolean;
  activeClassName?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 font-micro text-[10px] transition",
        muted
          ? "border-border/30 bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
          : active
          ? activeClassName ?? "border-primary/45 bg-primary/15 text-primary"
          : "border-border/40 bg-background/40 text-muted-foreground hover:border-primary/35 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-micro text-[11px] uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}
