import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTasksStore } from "../stores/tasksStore";
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

function isoDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#EF4444",
  high: "#F97316",
  medium: "#3B82F6",
  low: "#94A3B8",
};

const TOOLTIP_STYLE = {
  background: "#111220",
  border: "1px solid #2a2b3d",
  borderRadius: 8,
  fontSize: 12,
  color: "#f5f6fa",
};

export default function Reports() {
  const { t } = useTranslation();
  const tasks = useTasksStore((s) => s.tasks);
  const projects = useTasksStore((s) => s.projects);

  const doneTasks = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);

  const stats = useMemo(() => {
    const thirtyAgo = new Date(Date.now() - 30 * 86400000);
    const recentDone = doneTasks.filter(
      (t) => t.completed_at && new Date(t.completed_at) >= thirtyAgo
    );
    const totalMins = doneTasks.reduce((s, t) => s + t.actual_minutes, 0);
    const avgMins = doneTasks.length > 0 ? Math.round(totalMins / doneTasks.length) : 0;
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
      tasksDone: doneTasks.length,
      tasksPerDay: (recentDone.length / 30).toFixed(1),
      hoursPerDay: (recentMins / 30 / 60).toFixed(1),
      minsPerTask: avgMins,
      dayStreak: streak,
    };
  }, [doneTasks]);

  const weeklyData = useMemo(() => {
    const result = [];
    for (let i = 7; i >= 0; i--) {
      const end = new Date(Date.now() - i * 7 * 86400000);
      const start = new Date(Date.now() - (i + 1) * 7 * 86400000);
      const startStr = isoDateStr(start);
      const endStr = isoDateStr(end);
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
        name: t(`tasks.priorities.${key}`),
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
          name: proj?.name ?? "بدون مشروع",
          hours: +(mins / 60).toFixed(1),
          color: proj?.color ?? "#94A3B8",
        };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6);
  }, [doneTasks, projects]);

  const noData = doneTasks.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-8 py-10">
      <header>
        <h1 className="font-display text-3xl font-medium">{t("reports.overview")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("reports.subtitle")}</p>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: t("reports.tasksDone"), value: stats.tasksDone || "—" },
          { label: t("reports.tasksPerDay"), value: stats.tasksPerDay },
          { label: t("reports.hoursPerDay"), value: stats.hoursPerDay },
          { label: t("reports.minsPerTask"), value: stats.minsPerTask || "—" },
          { label: t("reports.dayStreak"), value: stats.dayStreak || "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card/40 p-4">
            <p className="font-micro text-[11px] uppercase tracking-widest text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-2 font-display text-3xl">{s.value}</p>
          </div>
        ))}
      </div>

      {noData ? (
        <div className="grid h-60 place-items-center rounded-2xl border border-dashed border-border/60 text-sm text-muted-foreground">
          أكمل بعض المهام وستظهر هنا تقاريرك
        </div>
      ) : (
        <>
          {/* Weekly completed tasks */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              مهام مكتملة — آخر 8 أسابيع
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Priority distribution */}
            {priorityData.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
                <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  توزيع الأولويات
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
                  <div className="flex-1 space-y-2">
                    {priorityData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2 text-sm">
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: item.color }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="ms-auto font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Time by project */}
            {projectTimeData.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
                <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {t("reports.timeByList")}
                </p>
                <div className="space-y-3">
                  {projectTimeData.map((proj) => {
                    const maxH = projectTimeData[0].hours;
                    const pct = maxH > 0 ? (proj.hours / maxH) * 100 : 0;
                    return (
                      <div key={proj.name}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>{proj.name}</span>
                          <span className="text-muted-foreground">{proj.hours}h</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                          <div
                            className="h-full rounded-full"
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
  );
}
