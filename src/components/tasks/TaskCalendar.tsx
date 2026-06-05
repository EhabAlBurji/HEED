import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type Task } from "../../stores/tasksStore";
import { PRIORITY_HEX } from "../../lib/taskMeta";
import { cn } from "../../lib/utils";

// ── Arabic month names ────────────────────────────────────────────────────────
const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Week starts Monday (ISO): Mon=0 … Sun=6
const WEEKDAYS_AR = ["إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت", "أحد"];
const WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** 0 = Monday … 6 = Sunday (ISO weekday, 0-indexed) */
function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function isoDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Returns all Date objects that should appear in the calendar grid for a given year/month */
function buildGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  // Pad start: include trailing days from previous month
  const startPad = isoWeekday(firstDay);
  const days: Date[] = [];
  for (let i = startPad; i > 0; i--) {
    days.push(new Date(year, month, 1 - i));
  }
  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  // Pad end: fill to complete the last row (up to 6 rows × 7 = 42)
  const totalRows = Math.ceil(days.length / 7);
  const total = totalRows * 7;
  let nextDay = 1;
  while (days.length < total) {
    days.push(new Date(year, month + 1, nextDay++));
  }
  return days;
}

const MAX_VISIBLE = 3;

interface TaskCalendarProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  isAr?: boolean;
}

export function TaskCalendar({ tasks, onTaskClick, isAr = true }: TaskCalendarProps) {
  const today = new Date();
  const [displayYear,  setDisplayYear]  = useState(today.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(today.getMonth());

  const todayStr = isoDateStr(today);
  const grid = buildGrid(displayYear, displayMonth);

  // Index tasks by deadline date string
  const tasksByDate = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.deadline || task.status === "done") continue;
    const list = tasksByDate.get(task.deadline) ?? [];
    list.push(task);
    tasksByDate.set(task.deadline, list);
  }

  const prevMonth = () => {
    if (displayMonth === 0) { setDisplayYear((y) => y - 1); setDisplayMonth(11); }
    else setDisplayMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (displayMonth === 11) { setDisplayYear((y) => y + 1); setDisplayMonth(0); }
    else setDisplayMonth((m) => m + 1);
  };
  const goToday = () => {
    setDisplayYear(today.getFullYear());
    setDisplayMonth(today.getMonth());
  };

  const monthLabel = isAr
    ? `${AR_MONTHS[displayMonth]} ${displayYear}`
    : `${EN_MONTHS[displayMonth]} ${displayYear}`;

  const weekdays = isAr ? WEEKDAYS_AR : WEEKDAYS_EN;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
            aria-label={isAr ? "الشهر السابق" : "Previous month"}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
          <button
            onClick={nextMonth}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
            aria-label={isAr ? "الشهر التالي" : "Next month"}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>

        <h3 className="font-display text-base font-semibold">{monthLabel}</h3>

        <button
          onClick={goToday}
          className="rounded-lg border border-border/60 bg-card px-3 py-1 font-micro text-xs text-muted-foreground hover:bg-secondary transition-colors"
        >
          {isAr ? "اليوم" : "Today"}
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 gap-px">
        {weekdays.map((d) => (
          <div
            key={d}
            className="py-1 text-center font-micro text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden">
        {grid.map((day, idx) => {
          const dateStr      = isoDateStr(day);
          const isToday      = dateStr === todayStr;
          const isCurrentMo  = day.getMonth() === displayMonth;
          const dayTasks     = tasksByDate.get(dateStr) ?? [];
          const visible      = dayTasks.slice(0, MAX_VISIBLE);
          const overflow     = dayTasks.length - MAX_VISIBLE;

          return (
            <div
              key={idx}
              className={cn(
                "min-h-[72px] p-1.5 bg-background/60",
                !isCurrentMo && "opacity-30"
              )}
            >
              {/* Day number */}
              <div className="mb-1 flex justify-center">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full font-micro text-[11px] font-medium",
                    isToday
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1"
                      : "text-foreground/70"
                  )}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Task chips */}
              <div className="space-y-0.5">
                {visible.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    title={task.title}
                    className="w-full truncate rounded px-1 py-0.5 text-left font-micro text-[10px] font-medium leading-tight transition hover:opacity-80"
                    style={{
                      background: `${PRIORITY_HEX[task.priority]}22`,
                      color:       PRIORITY_HEX[task.priority],
                    }}
                  >
                    {task.title}
                  </button>
                ))}
                {overflow > 0 && (
                  <p className="font-micro text-[9px] text-muted-foreground/50 px-1">
                    +{overflow} {isAr ? "أكثر" : "more"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
