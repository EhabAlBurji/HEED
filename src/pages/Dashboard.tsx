import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Clock, RefreshCw, Video, Users, Plus, X, ExternalLink } from "lucide-react";
import { useGoogleCalendarStore } from "../stores/googleCalendarStore";
import { syncGoogleCalendar } from "../lib/googleCalendarSync";
import { useTasksStore, isoDate } from "../stores/tasksStore";
import { useAuthStore } from "../stores/authStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useMeetingsStore } from "../stores/meetingsStore";
import { cn } from "../lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#EF4444",
  high:   "#F97316",
  medium: "#6735E1",
  low:    "#858585",
};

const TOOLTIP_STYLE = {
  background: "hsl(0 0% 100%)",
  border: "1px solid hsl(240 8% 88%)",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(210 38% 15%)",
  boxShadow: "0 4px 16px rgba(23,41,53,0.10)",
};

function isoDateStr(d: Date) {
  return isoDate(d);
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const user    = useAuthStore((s) => s.user);
  const allTasks    = useTasksStore((s) => s.tasks);
  const allProjects = useTasksStore((s) => s.projects);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  // Filter by active workspace
  const tasks    = useMemo(() => allTasks.filter((t) => (t.workspace_id ?? "personal") === activeWorkspaceId), [allTasks, activeWorkspaceId]);
  const projects = useMemo(() => allProjects.filter((p) => (p.workspace_id ?? "personal") === activeWorkspaceId), [allProjects, activeWorkspaceId]);

  const doneTasks = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);

  const todayStats = useMemo(() => {
    const todayStr = isoDateStr(new Date());
    const todayTasks = tasks.filter(
      (t) => t.column === "today" || t.deadline === todayStr
    );
    const doneToday  = todayTasks.filter((t) => t.status === "done").length;
    const totalToday = todayTasks.length;
    const pending    = totalToday - doneToday;
    return { pending, doneToday, totalToday };
  }, [tasks]);

  const stats = useMemo(() => {
    const thirtyAgo = new Date(Date.now() - 30 * 86400000);
    const recentDone = doneTasks.filter(
      (t) => t.completed_at && new Date(t.completed_at) >= thirtyAgo
    );
    const totalMins  = doneTasks.reduce((s, t) => s + t.actual_minutes, 0);
    const avgMins    = doneTasks.length > 0 ? Math.round(totalMins / doneTasks.length) : 0;
    const recentMins = recentDone.reduce((s, t) => s + t.actual_minutes, 0);

    const doneDates = new Set(
      doneTasks
        .filter((t) => t.completed_at)
        .map((t) => isoDateStr(new Date(t.completed_at!)))
    );
    let streak = 0;
    const cursor = new Date();
    if (!doneDates.has(isoDateStr(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (doneDates.has(isoDateStr(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return {
      tasksDone:   doneTasks.length,
      tasksPerDay: (recentDone.length / 30).toFixed(1),
      hoursPerDay: (recentMins / 30 / 60).toFixed(1),
      minsPerTask: avgMins,
      dayStreak:   streak,
    };
  }, [doneTasks]);

  const weeklyData = useMemo(() => {
    const result = [];
    for (let i = 7; i >= 0; i--) {
      const end   = new Date(Date.now() - i * 7 * 86400000);
      const start = new Date(Date.now() - (i + 1) * 7 * 86400000);
      const startStr = isoDateStr(start);
      const endStr   = isoDateStr(end);
      const count = doneTasks.filter((t) => {
        if (!t.completed_at) return false;
        const d = isoDateStr(new Date(t.completed_at));
        return d >= startStr && d < endStr;
      }).length;
      result.push({ label: `${start.getDate()}/${start.getMonth() + 1}`, count });
    }
    return result;
  }, [doneTasks]);

  const priorityData = useMemo(() => {
    const counts: Record<string, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
    for (const task of doneTasks) counts[task.priority] = (counts[task.priority] ?? 0) + 1;
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name:  t(`tasks.priorities.${key}`),
        value,
        color: PRIORITY_COLORS[key] ?? "#94A3B8",
      }));
  }, [doneTasks, t]);

  const projectTimeData = useMemo(() => {
    const byProject: Record<string, number> = {};
    for (const task of doneTasks) {
      const key = task.project_id ?? "__none__";
      byProject[key] = (byProject[key] ?? 0) + task.actual_minutes;
    }
    return Object.entries(byProject)
      .filter(([, m]) => m > 0)
      .map(([pid, mins]) => {
        const proj = projects.find((p) => p.id === pid);
        return {
          name:  proj?.name ?? (i18n.language === "ar" ? "بدون مشروع" : "No project"),
          hours: +(mins / 60).toFixed(1),
          color: proj?.color ?? "#94A3B8",
        };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6);
  }, [doneTasks, projects]);

  const noData = doneTasks.length === 0;

  const isAr = i18n.language === "ar";

  const greeting = () => {
    const h = new Date().getHours();
    if (isAr) {
      if (h < 12) return "صباح الخير";
      if (h < 17) return "مساء الخير";
      return "مساء النور";
    } else {
      if (h < 12) return "Good morning";
      if (h < 17) return "Good afternoon";
      return "Good evening";
    }
  };

  const displayName = user?.name ?? (user?.id === "guest" ? null : user?.email?.split("@")[0] ?? null);

  return (
    <div className="flex items-start">
    {/* ── Main scrollable content ─── */}
    <div className="min-w-0 flex-1 px-8 pt-4 pb-8">
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <header className="space-y-0.5">
        <h1 className="font-display text-3xl font-semibold">
          {greeting()}{displayName ? (isAr ? `، ${displayName}` : `, ${displayName}`) : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {todayStats.pending > 0
            ? (isAr
                ? `عندك ${todayStats.pending} مهمة للنهارده · إيه أول حاجة هتعملها؟`
                : `You have ${todayStats.pending} task${todayStats.pending === 1 ? "" : "s"} today · What's first?`)
            : (isAr ? "مفيش مهام للنهارده — استمتع بيومك 🎉" : "No tasks today — enjoy your day 🎉")}
        </p>
      </header>

      {/* Today hero card — live */}
      <TodayCard
        pending={todayStats.pending}
        done={todayStats.doneToday}
        total={todayStats.totalToday}
      />

      {/* Stat cards — ryswift pattern: round dark icon + label + huge number + spark */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: t("reports.tasksDone"),    value: stats.tasksDone  || "—", emoji: "✓" },
          { label: t("reports.tasksPerDay"),  value: stats.tasksPerDay,       emoji: "📊" },
          { label: t("reports.hoursPerDay"),  value: stats.hoursPerDay,       emoji: "⏱" },
          { label: t("reports.minsPerTask"),  value: stats.minsPerTask || "—", emoji: "⚡" },
          { label: t("reports.dayStreak"),    value: stats.dayStreak  || "—", emoji: "🔥" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl bg-card border border-border/60 p-4 shadow-[0_1px_3px_rgba(23,41,53,0.04)]"
          >
            <div className="flex items-start justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background text-sm">
                {s.emoji}
              </div>
            </div>
            <p className="mt-3 font-micro text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-foreground">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {noData ? (
        <div className="grid h-64 place-items-center rounded-2xl border border-dashed border-border/50 text-sm text-muted-foreground">
          <div className="text-center">
            <p className="text-2xl mb-2">📊</p>
            <p>
              {isAr
                ? "أكمل بعض المهام وستظهر هنا إحصائياتك مباشرةً"
                : "Complete some tasks and your stats will appear here"}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Weekly chart */}
          <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-sm">
            <p className="mb-5 font-micro text-[11px] uppercase tracking-widest text-muted-foreground/70">
              {isAr ? "مهام مكتملة — آخر 8 أسابيع" : "Completed tasks — last 8 weeks"}
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "hsl(220 14% 55%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "hsl(220 14% 55%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: "rgba(103,53,225,0.08)" }}
                />
                <Bar dataKey="count" fill="#6735E1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Priority distribution */}
            {priorityData.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-sm">
                <p className="mb-5 font-micro text-[11px] uppercase tracking-widest text-muted-foreground/70">
                  {isAr ? "توزيع الأولويات" : "Priority distribution"}
                </p>
                <div className="flex items-center gap-6">
                  <PieChart width={130} height={130}>
                    <Pie
                      data={priorityData}
                      cx={60}
                      cy={60}
                      innerRadius={36}
                      outerRadius={60}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {priorityData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                  <div className="flex-1 space-y-2.5">
                    {priorityData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2 text-sm">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: item.color }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="ms-auto font-semibold tabular-nums">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Time by project */}
            {projectTimeData.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-sm">
                <p className="mb-5 font-micro text-[11px] uppercase tracking-widest text-muted-foreground/70">
                  {t("reports.timeByList")}
                </p>
                <div className="space-y-3.5">
                  {projectTimeData.map((proj) => {
                    const maxH = projectTimeData[0].hours;
                    const pct  = maxH > 0 ? (proj.hours / maxH) * 100 : 0;
                    return (
                      <div key={proj.name}>
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span>{proj.name}</span>
                          <span className="font-micro text-xs text-muted-foreground tabular-nums">
                            {proj.hours}h
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/25">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: proj.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
    </div>

    <TodayMeetingsSidebar isAr={isAr} activeWorkspaceId={activeWorkspaceId} />
    </div>
  );
}

// ── Today hero card (live) ────────────────────────────────────────────────────
function TodayCard({
  pending,
  done,
  total,
}: {
  pending: number;
  done: number;
  total: number;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && pending === 0;

  // MeetSync hero — purple gradient when there are pending tasks
  const activeHero = !allDone && total > 0;
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 shadow-xl"
      style={{
        background: allDone
          ? "linear-gradient(135deg, #DCF5E1 0%, #BFEDC8 100%)"
          : activeHero
          ? "linear-gradient(135deg, #6735E1 0%, #8B5CF6 100%)"
          : "linear-gradient(135deg, #EFE9FB 0%, #FFFFFF 100%)",
      }}
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: activeHero
            ? "radial-gradient(ellipse 80% 60% at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 60%)"
            : "none",
        }}
      />

      <div className="relative flex items-center gap-6">
        {/* Icon + count */}
        <div className="flex flex-col items-center">
          <CalendarClock
            className="mb-1 h-5 w-5"
            style={{ color: allDone ? "#166534" : activeHero ? "rgba(255,255,255,0.9)" : "#6735E1" }}
          />
          <span
            className="font-display text-5xl font-bold tabular-nums leading-none"
            style={{ color: allDone ? "#166534" : activeHero ? "#FFFFFF" : "#6735E1" }}
          >
            {pending}
          </span>
          <span
            className="mt-2 font-micro text-sm font-semibold uppercase tracking-wide"
            style={{ color: allDone ? "rgba(22,101,52,0.75)" : activeHero ? "rgba(255,255,255,0.85)" : "rgba(103,53,225,0.7)" }}
          >
            {isAr ? "النهارده" : "Today"}
          </span>
        </div>

        {/* Divider */}
        <div
          className="h-16 w-px"
          style={{ background: activeHero ? "rgba(255,255,255,0.25)" : "rgba(103,53,225,0.18)" }}
        />

        {/* Progress */}
        <div className="flex-1 space-y-2">
          <div className="flex items-baseline justify-between">
            <span
              className="text-sm font-medium"
              style={{ color: activeHero ? "#FFFFFF" : allDone ? "#14532d" : undefined }}
            >
              {allDone
                ? (isAr ? "يوم منتج — خلصت كل حاجة!" : "Productive day — everything is done!")
                : total === 0
                ? (isAr ? "مفيش مهام للنهارده" : "No tasks today")
                : (isAr ? `${done} من ${total} مهمة منجزة` : `${done} of ${total} tasks done`)}
            </span>
            {total > 0 && (
              <span
                className="font-display text-xl font-bold tabular-nums"
                style={{ color: allDone ? "#166534" : activeHero ? "#FFFFFF" : "#6735E1" }}
              >
                {pct}%
              </span>
            )}
          </div>

          {total > 0 && (
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: activeHero ? "rgba(255,255,255,0.18)" : "rgba(103,53,225,0.12)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: allDone
                    ? "linear-gradient(90deg, #22c55e, #4ade80)"
                    : activeHero
                    ? "#FFFFFF"
                    : "linear-gradient(90deg, #6735E1, #8B5CF6)",
                }}
              />
            </div>
          )}

          {pending > 0 && (
            <UrgentTodayBadge onPurple={activeHero} />
          )}

          {/* CTA — pill button on the hero */}
          {activeHero && pending > 0 && (
            <button
              onClick={() => {
                const el = document.querySelector("a[href='/projects']") as HTMLAnchorElement | null;
                el?.click();
              }}
              className="mt-3 rounded-full bg-white px-5 py-2 text-xs font-semibold text-primary shadow-md transition hover:scale-105"
            >
              {isAr ? "ابدأ مهامك" : "Start tasks"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UrgentTodayBadge({ onPurple = false }: { onPurple?: boolean }) {
  const tasks = useTasksStore((s) => s.tasks);
  const todayStr = isoDate(new Date());
  const urgentCount = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.priority === "urgent" &&
      (t.column === "today" || t.deadline === todayStr)
  ).length;

  if (urgentCount === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 animate-pulse rounded-full", onPurple ? "bg-white" : "bg-red-500")} />
      <span
        className="font-micro text-xs"
        style={{ color: onPurple ? "rgba(255,255,255,0.9)" : "#b91c1c" }}
      >
        {urgentCount} {urgentCount === 1 ? "مهمة عاجلة" : "مهام عاجلة"} تحتاج اهتمامك فوراً
      </span>
    </div>
  );
}


// ── Today Meetings Sidebar ────────────────────────────────────────────────────

function TodayMeetingsSidebar({ isAr, activeWorkspaceId }: { isAr: boolean; activeWorkspaceId: string }) {
  const allMeetings   = useMeetingsStore((s) => s.meetings);
  const addMeeting    = useMeetingsStore((s) => s.addMeeting);
  const deleteMeeting = useMeetingsStore((s) => s.deleteMeeting);
  const gcal          = useGoogleCalendarStore();

  const todayStr = isoDate(new Date());

  const todayMeetings = useMemo(
    () =>
      allMeetings
        .filter((m) => m.date === todayStr && (m.workspace_id ?? "personal") === activeWorkspaceId)
        .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
    [allMeetings, todayStr, activeWorkspaceId]
  );

  const [showForm, setShowForm]         = useState(false);
  const [syncing, setSyncing]           = useState(false);
  const [syncMsg, setSyncMsg]           = useState<string | null>(null);
  const [title, setTitle]               = useState("");
  const [time, setTime]                 = useState("");
  const [duration, setDuration]         = useState("");
  const [attendeesRaw, setAttendeesRaw] = useState("");
  const [link, setLink]                 = useState("");

  const handleSync = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const count = await syncGoogleCalendar();
      setSyncMsg(isAr ? `تمت المزامنة — ${count} حدث` : `Synced — ${count} events`);
    } catch (e) {
      setSyncMsg(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleAdd = () => {
    if (!title.trim()) return;
    addMeeting({
      title: title.trim(),
      date: todayStr,
      time: time || null,
      duration_minutes: duration ? parseInt(duration) : null,
      location: "",
      notes: "",
      attendees: attendeesRaw.split(",").map((a) => a.trim()).filter(Boolean),
      meetingLink: link.trim() || null,
      workspace_id: activeWorkspaceId,
    });
    setTitle(""); setTime(""); setDuration(""); setAttendeesRaw(""); setLink("");
    setShowForm(false);
  };

  return (
    <aside className="sticky top-0 flex h-[calc(100vh-44px)] w-72 shrink-0 flex-col border-s border-border/40 bg-card/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
            <CalendarClock className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{isAr ? "اجتماعات اليوم" : "Today's Meetings"}</h2>
            <p className="font-micro text-[10px] text-muted-foreground/50">
              {todayMeetings.length > 0
                ? (isAr ? `${todayMeetings.length} اجتماع` : `${todayMeetings.length} meeting${todayMeetings.length !== 1 ? "s" : ""}`)
                : (isAr ? "لا يوجد اجتماعات" : "No meetings")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {gcal.isConnected && (
            <button
              onClick={handleSync}
              disabled={syncing}
              title={isAr ? "مزامنة Google Calendar" : "Sync Google Calendar"}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground/50 transition hover:bg-secondary hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            </button>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            title={isAr ? "إضافة اجتماع" : "Add meeting"}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground/50 transition hover:bg-secondary hover:text-foreground"
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="mx-3 mt-2 rounded-lg border border-border/40 bg-card/30 px-3 py-1.5">
          <p className="font-micro text-[11px] text-muted-foreground">{syncMsg}</p>
        </div>
      )}

      {/* Meetings list */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {todayMeetings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10">
              <CalendarClock className="h-5 w-5 text-violet-400/60" />
            </div>
            <p className="font-micro text-xs text-muted-foreground/40">
              {isAr ? "مفيش اجتماعات اليوم" : "No meetings today"}
            </p>
          </div>
        ) : (
          todayMeetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} isAr={isAr} onDelete={() => deleteMeeting(m.id)} />
          ))
        )}
      </div>

      {/* Add meeting form — shown when toggled from header */}
      {showForm && (
        <div className="border-t border-border/40 px-3 py-3">
          <div className="space-y-2 rounded-xl border border-border/50 bg-card/30 p-3">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={isAr ? "عنوان الاجتماع" : "Meeting title"}
              className="w-full rounded-lg border border-border/50 bg-background/50 px-2.5 py-1.5 font-micro text-xs outline-none focus:border-primary/50"
            />
            <div className="flex gap-2">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex-1 rounded-lg border border-border/50 bg-background/50 px-2 py-1.5 font-micro text-xs outline-none focus:border-primary/50"
              />
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder={isAr ? "دقيقة" : "min"}
                className="w-16 rounded-lg border border-border/50 bg-background/50 px-2 py-1.5 font-micro text-xs outline-none focus:border-primary/50"
              />
            </div>
            <input
              value={attendeesRaw}
              onChange={(e) => setAttendeesRaw(e.target.value)}
              placeholder={isAr ? "الحضور (فاصلة بينهم)" : "Attendees, comma separated"}
              className="w-full rounded-lg border border-border/50 bg-background/50 px-2.5 py-1.5 font-micro text-xs outline-none focus:border-primary/50"
            />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={isAr ? "رابط الاجتماع" : "Meeting link"}
              className="w-full rounded-lg border border-border/50 bg-background/50 px-2.5 py-1.5 font-micro text-xs outline-none focus:border-primary/50"
            />
            <div className="flex gap-1.5">
              <button onClick={handleAdd} className="flex-1 rounded-lg bg-primary/20 py-1.5 font-micro text-xs text-primary hover:bg-primary/30 transition-colors">
                {isAr ? "إضافة" : "Add"}
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg bg-secondary/40 py-1.5 font-micro text-xs text-muted-foreground hover:bg-secondary/60 transition-colors">
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function MeetingCard({
  meeting,
  isAr,
  onDelete,
}: {
  meeting: import("../stores/meetingsStore").Meeting;
  isAr: boolean;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="group relative space-y-1.5 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
      <button
        onClick={() => (confirm ? onDelete() : setConfirm(true))}
        onBlur={() => setTimeout(() => setConfirm(false), 150)}
        className={cn(
          "absolute end-2 top-2 grid h-5 w-5 place-items-center rounded-full opacity-0 transition-all group-hover:opacity-100",
          confirm ? "bg-destructive/20 text-destructive" : "text-muted-foreground/30 hover:text-destructive"
        )}
      >
        <X className="h-2.5 w-2.5" />
      </button>

      <div className="flex items-start gap-2 pe-5">
        {meeting.time && (
          <span className="shrink-0 rounded-md bg-violet-500/20 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-violet-300">
            {meeting.time}
          </span>
        )}
        <span className="text-sm font-medium leading-snug">{meeting.title}</span>
      </div>

      {meeting.duration_minutes && (
        <div className="flex items-center gap-1 text-muted-foreground/50">
          <Clock className="h-3 w-3" />
          <span className="font-micro text-[10px]">{meeting.duration_minutes}{isAr ? " دقيقة" : " min"}</span>
        </div>
      )}

      {(meeting.attendees ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <Users className="h-3 w-3 shrink-0 text-muted-foreground/40" />
          {(meeting.attendees ?? []).slice(0, 3).map((a, i) => (
            <span key={i} className="rounded-full bg-secondary/50 px-1.5 py-0.5 font-micro text-[10px] text-muted-foreground">
              {a}
            </span>
          ))}
          {(meeting.attendees ?? []).length > 3 && (
            <span className="font-micro text-[10px] text-muted-foreground/40">+{(meeting.attendees ?? []).length - 3}</span>
          )}
        </div>
      )}

      {meeting.meetingLink && (
        <a
          href={meeting.meetingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 font-micro text-[11px] font-medium text-primary transition hover:bg-primary/20"
        >
          <Video className="h-3 w-3 shrink-0" />
          <span className="flex-1">{isAr ? "انضم للاجتماع" : "Join meeting"}</span>
          <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
        </a>
      )}

      {meeting.source === "google" && (
        <span className="inline-flex items-center gap-1 font-micro text-[9px] text-muted-foreground/30">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400/50" />
          Google Calendar
        </span>
      )}
    </div>
  );
}
