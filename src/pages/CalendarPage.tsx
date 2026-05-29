import { useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useTasksStore } from "../stores/tasksStore";
import { useMeetingsStore } from "../stores/meetingsStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { MeetingsPanel } from "../components/calendar/MeetingsPanel";
import { cn } from "../lib/utils";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

// Sun=ح, Mon=ن, Tue=ث, Wed=ر, Thu=خ, Fri=ج, Sat=س
const WEEKDAYS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

const priorityDot: Record<string, string> = {
  urgent: "bg-red-500",
  high:   "bg-orange-400",
  medium: "bg-blue-400",
  low:    "bg-muted-foreground/40",
};

const priorityBorder: Record<string, string> = {
  urgent: "border-red-500/30 bg-red-500/5",
  high:   "border-orange-400/30 bg-orange-400/5",
  medium: "border-blue-400/30 bg-blue-400/5",
  low:    "border-border/40 bg-secondary/10",
};

const priorityLabel: Record<string, string> = {
  urgent: "عاجلة",
  high:   "عالية",
  medium: "متوسطة",
  low:    "منخفضة",
};

export default function CalendarPage() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const allTasks    = useTasksStore((s) => s.tasks);
  const allMeetings = useMeetingsStore((s) => s.meetings);
  const tasks    = useMemo(() => allTasks.filter((t) => (t.workspace_id ?? "personal") === activeWorkspaceId), [allTasks, activeWorkspaceId]);
  const meetings = useMemo(() => allMeetings.filter((m) => (m.workspace_id ?? "personal") === activeWorkspaceId), [allMeetings, activeWorkspaceId]);

  const today   = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based
  const [selected,  setSelected]  = useState<string | null>(todayStr);

  // ── Grid cells for current month ─────────────────────────────────────────
  const cells = useMemo(() => {
    const firstDow    = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const result: (number | null)[] = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [viewYear, viewMonth]);

  // ── Tasks indexed by date ─────────────────────────────────────────────────
  const tasksByDate = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    for (const t of tasks) {
      if (t.deadline && t.status !== "done") {
        (map[t.deadline] ??= []).push(t);
      }
    }
    return map;
  }, [tasks]);

  // ── Meetings indexed by date ──────────────────────────────────────────────
  const meetingsByDate = useMemo(() => {
    const map: Record<string, typeof meetings> = {};
    for (const m of meetings) {
      (map[m.date] ??= []).push(m);
    }
    return map;
  }, [meetings]);

  function toDateStr(day: number) {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${viewYear}-${mm}-${dd}`;
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  // ── Selected day data ─────────────────────────────────────────────────────
  const selTasks = useMemo(
    () =>
      selected
        ? [...(tasksByDate[selected] ?? [])].sort(
            (a, b) =>
              ({ urgent: 0, high: 1, medium: 2, low: 3 }[a.priority] ?? 2) -
              ({ urgent: 0, high: 1, medium: 2, low: 3 }[b.priority] ?? 2)
          )
        : [],
    [selected, tasksByDate]
  );

  const selMeetings = useMemo(
    () =>
      selected
        ? [...(meetingsByDate[selected] ?? [])].sort((a, b) =>
            (a.time ?? "").localeCompare(b.time ?? "")
          )
        : [],
    [selected, meetingsByDate]
  );

  // ── Month task count summary ──────────────────────────────────────────────
  const monthTaskCount = useMemo(() => {
    let total = 0;
    for (let d = 1; d <= new Date(viewYear, viewMonth + 1, 0).getDate(); d++) {
      total += (tasksByDate[toDateStr(d)] ?? []).length;
    }
    return total;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksByDate, viewYear, viewMonth]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
          <CalendarRange className="h-4 w-4 text-violet-400" />
        </div>
        <div>
          <h1 className="font-display text-xl font-medium">التقويم</h1>
        </div>
        {monthTaskCount > 0 && (
          <span className="ms-auto rounded-full bg-primary/10 px-3 py-1 font-micro text-xs text-primary">
            {monthTaskCount} مهمة هذا الشهر
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── Meetings panel (right in RTL) ─────────────────────────────── */}
        <MeetingsPanel />

        {/* ── Calendar (left in RTL, flex-1) ───────────────────────────── */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            {/* In RTL flex: first item = right side → next month */}
            <button
              onClick={nextMonth}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="text-center">
              <h2 className="font-display text-lg font-semibold">
                {MONTHS_AR[viewMonth]} {viewYear}
              </h2>
            </div>

            {/* In RTL flex: last item = left side → previous month */}
            <button
              onClick={prevMonth}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/20">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-border/30 bg-secondary/10">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="py-2 text-center font-micro text-[11px] font-medium text-muted-foreground/60"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (!day) {
                  return (
                    <div
                      key={`e-${idx}`}
                      className="h-[88px] border-b border-e border-border/15 last:border-e-0 bg-secondary/5"
                    />
                  );
                }

                const ds        = toDateStr(day);
                const dayTasks  = tasksByDate[ds] ?? [];
                const dayMeets  = meetingsByDate[ds] ?? [];
                const isToday   = ds === todayStr;
                const isSel     = ds === selected;

                // Show up to 3 priority dots + overflow count
                const dots      = dayTasks.map((t) => t.priority).slice(0, 3);
                const extra     = dayTasks.length > 3 ? dayTasks.length - 3 : 0;
                const hasItems  = dayTasks.length > 0 || dayMeets.length > 0;

                return (
                  <button
                    key={ds}
                    onClick={() => setSelected(isSel ? null : ds)}
                    className={cn(
                      "group relative flex h-[88px] flex-col gap-1 border-b border-e border-border/15 p-2 text-right transition-colors last:border-e-0",
                      "hover:bg-secondary/20",
                      isSel && "bg-primary/8 ring-1 ring-inset ring-primary/20",
                      isToday && !isSel && "bg-violet-500/5",
                    )}
                  >
                    {/* Day number */}
                    <span
                      className={cn(
                        "ms-auto flex h-6 w-6 items-center justify-center rounded-full font-micro text-xs font-medium",
                        isToday && "bg-violet-500 text-white",
                        !isToday && isSel && "bg-primary/25 text-primary",
                        !isToday && !isSel && hasItems && "text-foreground",
                        !isToday && !isSel && !hasItems && "text-muted-foreground/50",
                      )}
                    >
                      {day}
                    </span>

                    {/* Indicators */}
                    {hasItems && (
                      <div className="mt-auto flex flex-wrap items-center justify-end gap-0.5">
                        {dayMeets.length > 0 && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-violet-500"
                            title={`${dayMeets.length} اجتماع`}
                          />
                        )}
                        {dots.map((p, i) => (
                          <span
                            key={i}
                            className={cn("h-1.5 w-1.5 rounded-full", priorityDot[p])}
                          />
                        ))}
                        {extra > 0 && (
                          <span className="font-micro text-[9px] text-muted-foreground/60">
                            +{extra}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {selected && (selTasks.length > 0 || selMeetings.length > 0) && (
            <div className="rounded-2xl border border-border/40 bg-card/20 p-4 space-y-3">
              <h3 className="font-display text-sm font-semibold">
                {(() => {
                  const [y, m, d] = selected.split("-");
                  const isToday_ = selected === todayStr;
                  const label = `${parseInt(d, 10)} ${MONTHS_AR[parseInt(m, 10) - 1]} ${y}`;
                  return isToday_ ? `اليوم — ${label}` : label;
                })()}
              </h3>

              {selMeetings.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-micro text-[10px] font-medium uppercase tracking-wider text-violet-400/70">
                    الاجتماعات
                  </p>
                  {selMeetings.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                      <span className="flex-1 font-micro text-xs font-medium">{m.title}</span>
                      {m.time && (
                        <span className="flex items-center gap-1 font-micro text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {m.time}
                        </span>
                      )}
                      {m.duration_minutes && (
                        <span className="font-micro text-[10px] text-muted-foreground/50">
                          {m.duration_minutes}د
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selTasks.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-micro text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    المهام
                  </p>
                  {selTasks.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2",
                        priorityBorder[t.priority]
                      )}
                    >
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", priorityDot[t.priority])} />
                      <span className="flex-1 font-micro text-xs font-medium">{t.title}</span>
                      <span className="font-micro text-[10px] text-muted-foreground/60">
                        {priorityLabel[t.priority]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 font-micro text-[10px] text-muted-foreground/50">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              اجتماع
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              عاجل
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-400" />
              عالي
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              متوسط
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              منخفض
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
