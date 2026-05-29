import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Plus, X, Search } from "lucide-react";
import type { ScheduleColumn as ColType, ScheduledPost } from "../../stores/scheduleStore";
import { useScheduleStore } from "../../stores/scheduleStore";
import { useTasksStore } from "../../stores/tasksStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { ScheduleCard } from "./ScheduleCard";
import { cn } from "../../lib/utils";
import {
  MONTHS_AR,
  QUICK_TIMES,
  daysInMonth,
  formatScheduleDate,
  quickScheduleDates,
  scheduleDateFromParts,
} from "../../lib/scheduleDates";

const colConfig: Record<
  ColType,
  { arLabel: string; enLabel: string; headerCls: string; countCls: string; placeholder: string }
> = {
  content: {
    arLabel: "المحتوى",
    enLabel: "Content",
    headerCls: "bg-secondary/20 border-border/40",
    countCls: "text-muted-foreground",
    placeholder: "اسحب محتوى هنا",
  },
  this_week: {
    arLabel: "الأسبوع دا",
    enLabel: "This Week",
    headerCls: "bg-blue-500/8 border-blue-500/25",
    countCls: "text-blue-400",
    placeholder: "محتوى الأسبوع",
  },
  today: {
    arLabel: "للنشر اليوم",
    enLabel: "Publish Today",
    headerCls: "bg-primary/8 border-primary/30",
    countCls: "text-primary",
    placeholder: "للنشر اليوم",
  },
  published: {
    arLabel: "تم النشر",
    enLabel: "Published",
    headerCls: "bg-emerald-500/8 border-emerald-500/25",
    countCls: "text-emerald-400",
    placeholder: "المنشورات المكتملة",
  },
};

const PLATFORMS = ["YouTube", "Instagram", "TikTok", "Twitter", "Facebook", "LinkedIn", "Snapchat", "Other"];

export function ScheduleColumn({
  column,
  posts,
  onOpenPost,
}: {
  column: ColType;
  posts: ScheduledPost[];
  onOpenPost?: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { setNodeRef, isOver } = useDroppable({ id: column });
  const addPost = useScheduleStore((s) => s.addPost);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const allTasks = useTasksStore((s) => s.tasks);
  const doneTasks = useMemo(
    () => allTasks.filter((t) => t.status === "done" && (t.workspace_id ?? "personal") === activeWorkspaceId),
    [allTasks, activeWorkspaceId]
  );

  const [showForm, setShowForm] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");

  const cfg = colConfig[column];

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function buildScheduledDate(): string | null {
    return scheduleDateFromParts(month, day);
  }

  function handleAdd() {
    const t = newTitle.trim();
    if (!t) return;
    addPost({
      title: t,
      notes: "",
      platforms: selectedPlatforms,
      scheduledDate: buildScheduledDate(),
      scheduledTime: time || null,
      tags: [],
      column,
      position: posts.length * 100,
      taskId: linkedTaskId,
      links: [],
      previewImageUrl: null,
      workspace_id: activeWorkspaceId,
    });
    resetForm();
  }

  // Fill the form with the selected task — don't add yet
  function handlePickTask(taskTitle: string, taskId: string) {
    setNewTitle(taskTitle);
    setLinkedTaskId(taskId);
    setShowTaskPicker(false);
    setTaskSearch("");
    setShowForm(true);
  }

  function resetForm() {
    setNewTitle("");
    setSelectedPlatforms([]);
    setMonth("");
    setDay("");
    setTime("");
    setLinkedTaskId(null);
    setShowForm(false);
  }

  const maxDay = month ? daysInMonth(parseInt(month)) : 31;
  const selectedDate = buildScheduledDate();
  const dateLabel = formatScheduleDate(selectedDate, time || null);
  const quickDates = quickScheduleDates();

  return (
    <div className={cn("flex w-72 shrink-0 flex-col rounded-2xl border", cfg.headerCls)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{isAr ? cfg.arLabel : cfg.enLabel}</h3>
          <span className="font-micro text-[11px] text-muted-foreground">
            · {isAr ? cfg.enLabel : cfg.arLabel}
          </span>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 font-micro text-xs font-medium", cfg.countCls)}>
          {posts.length}
        </span>
      </div>

      {/* Droppable list */}
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[120px] flex-1 space-y-2 overflow-y-auto px-3 pb-3 transition-colors",
          isOver && "rounded-xl bg-primary/5"
        )}
      >
        <SortableContext items={posts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {posts.map((post) => (
            <ScheduleCard key={post.id} post={post} onOpen={onOpenPost} />
          ))}
        </SortableContext>
        {posts.length === 0 && !isOver && (
          <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-border/30">
            <span className="font-micro text-xs text-muted-foreground/40">{cfg.placeholder}</span>
          </div>
        )}
      </div>

      {/* Task picker — done tasks from projects */}
      {showTaskPicker && (
        <div className="mx-3 mb-2 overflow-hidden rounded-xl border border-emerald-500/20 bg-card/90 shadow-lg">
          {/* Picker header */}
          <div className="flex items-center gap-2 border-b border-border/30 bg-emerald-500/8 px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="flex-1 font-micro text-xs font-medium text-emerald-400">
              المهام المنتهية — جاهزة للنشر
            </span>
            <button
              onClick={() => { setShowTaskPicker(false); setTaskSearch(""); }}
              className="text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-2 py-1.5 border-b border-border/20">
            <div className="flex items-center gap-1.5 rounded-lg bg-background/40 px-2 py-1">
              <Search className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              <input
                autoFocus
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="ابحث في المهام..."
                className="min-w-0 flex-1 bg-transparent font-micro text-[11px] outline-none placeholder:text-muted-foreground/30"
              />
            </div>
          </div>

          {/* Task list */}
          {doneTasks.length === 0 ? (
            <div className="py-5 text-center">
              <p className="font-micro text-xs text-muted-foreground/40">لا توجد مهام منتهية بعد</p>
            </div>
          ) : (
            <div className="max-h-44 overflow-y-auto p-1.5 space-y-0.5">
              {doneTasks
                .filter((t) => !taskSearch.trim() || t.title.toLowerCase().includes(taskSearch.toLowerCase()))
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handlePickTask(t.title, t.id)}
                    className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start transition-all hover:bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400/60 group-hover:text-emerald-400 transition-colors" />
                    <span className="min-w-0 flex-1 truncate font-micro text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      {t.title}
                    </span>
                    <span className="font-micro text-[9px] text-muted-foreground/30 group-hover:text-emerald-400/60 transition-colors">
                      اختر ←
                    </span>
                  </button>
                ))}
              {taskSearch && doneTasks.filter((t) => t.title.toLowerCase().includes(taskSearch.toLowerCase())).length === 0 && (
                <p className="py-3 text-center font-micro text-xs text-muted-foreground/40">لا نتائج</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add form */}
      <div className="border-t border-border/30 px-3 py-2">
        {showForm ? (
          <div className="space-y-2">
            {/* Title */}
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="عنوان المحتوى"
              className="w-full rounded-lg bg-background/40 px-2 py-1.5 font-micro text-sm outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/40"
            />

            {/* Platforms - multi-select checkboxes */}
            <div className="rounded-lg border border-border/30 bg-background/20 p-2">
              <p className="mb-1.5 font-micro text-[10px] text-muted-foreground">المنصات</p>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const active = selectedPlatforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={cn(
                        "rounded-full px-2 py-0.5 font-micro text-[10px] transition-colors border",
                        active
                          ? "bg-primary/20 text-primary border-primary/40"
                          : "bg-secondary/30 text-muted-foreground border-border/30 hover:border-primary/30"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date (no year) + Time */}
            <div className="grid grid-cols-3 gap-1">
              {quickDates.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => { setMonth(option.month); setDay(option.day); }}
                  className={cn(
                    "rounded-lg border px-1.5 py-1 font-micro text-[10px] transition-colors",
                    selectedDate === option.value
                      ? "border-primary/45 bg-primary/15 text-primary"
                      : "border-border/25 bg-background/20 text-muted-foreground/70 hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <select
                value={month}
                onChange={(e) => { setMonth(e.target.value); setDay(""); }}
                className="flex-1 rounded-lg bg-background/40 px-2 py-1.5 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="">الشهر</option>
                {MONTHS_AR.map((m, i) => (
                  <option key={i} value={String(i + 1)}>{m}</option>
                ))}
              </select>

              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                disabled={!month}
                className="w-16 rounded-lg bg-background/40 px-2 py-1.5 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-40"
              >
                <option value="">يوم</option>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>{d}</option>
                ))}
              </select>

              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-24 rounded-lg bg-background/40 px-2 py-1.5 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {QUICK_TIMES.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 font-micro text-[10px] transition-colors",
                    time === slot
                      ? "border-primary/45 bg-primary/15 text-primary"
                      : "border-border/25 bg-background/20 text-muted-foreground/70 hover:border-primary/30 hover:text-foreground"
                  )}
                  dir="ltr"
                >
                  {slot}
                </button>
              ))}
            </div>
            {dateLabel && (
              <div className="rounded-lg border border-primary/15 bg-primary/8 px-2.5 py-1.5 font-micro text-[11px] text-primary">
                تاريخ النشر: {dateLabel}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-1.5">
              {/* Linked task indicator — shows if a task is already selected */}
              {linkedTaskId && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-2.5 py-1.5">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                  <span className="min-w-0 flex-1 truncate font-micro text-xs text-emerald-400">
                    {newTitle}
                  </span>
                  <button
                    onClick={() => { setLinkedTaskId(null); setNewTitle(""); }}
                    className="shrink-0 text-emerald-400/50 hover:text-emerald-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Pick from done tasks button */}
              {!linkedTaskId && (
                <button
                  onClick={() => setShowTaskPicker((v) => !v)}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-lg border py-2 font-micro text-xs font-medium transition-all",
                    showTaskPicker
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                      : "border-emerald-500/20 bg-emerald-500/8 text-emerald-500/70 hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:text-emerald-400"
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  جاهز للنشر — اختر مهمة منجزة
                </button>
              )}

              <div className="flex gap-1.5">
                <button
                  onClick={handleAdd}
                  className="flex-1 rounded-lg bg-primary/20 py-1.5 font-micro text-xs text-primary hover:bg-primary/30 transition-colors"
                >
                  إضافة
                </button>
                <button
                  onClick={resetForm}
                  className="flex-1 rounded-lg bg-secondary/40 py-1.5 font-micro text-xs text-muted-foreground hover:bg-secondary/60 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowForm(true)}
              className="flex-1 rounded-lg px-2 py-1.5 font-micro text-sm text-muted-foreground/50 hover:bg-background/30 hover:text-muted-foreground text-start flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              محتوى جديد
            </button>
            <button
              onClick={() => { setShowTaskPicker((v) => !v); }}
              title="من المهام المنتهية"
              className={cn(
                "rounded-lg px-2 py-1.5 transition-colors",
                showTaskPicker
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-muted-foreground/40 hover:bg-background/30 hover:text-emerald-400"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
