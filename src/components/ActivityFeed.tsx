import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTasksStore } from "../stores/tasksStore";
import { useNotificationsStore } from "../stores/notificationsStore";
import { useWorkspaceStore } from "../stores/workspaceStore";

// ── Relative-time helper ──────────────────────────────────────────────────────
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);

  if (diffMin < 1) return "الآن";
  if (diffMin < 60) return `منذ ${diffMin} ${diffMin === 1 ? "دقيقة" : diffMin < 11 ? "دقائق" : "دقيقة"}`;
  if (diffHr < 24) return `منذ ${diffHr} ${diffHr === 1 ? "ساعة" : diffHr < 11 ? "ساعات" : "ساعة"}`;
  if (diffHr < 48) return "أمس";
  const d = new Date(iso);
  return d.toLocaleDateString("ar", { day: "numeric", month: "short" });
}

// ── Activity item shape ───────────────────────────────────────────────────────
type ActivityItem = {
  id: string;
  icon: string;
  label: string;
  time: string; // ISO
};

// ── ActivityFeed component ────────────────────────────────────────────────────
export default function ActivityFeed() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const allTasks         = useTasksStore((s) => s.tasks);
  const notifications    = useNotificationsStore((s) => s.notifications);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces       = useWorkspaceStore((s) => s.workspaces);

  // Members of the active workspace (for "member joined" events)
  const wsMembers = useMemo(() => {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    return ws?.members ?? [];
  }, [workspaces, activeWorkspaceId]);

  const items = useMemo<ActivityItem[]>(() => {
    const cutoff = Date.now() - 48 * 3_600_000; // 48 h
    const result: ActivityItem[] = [];

    // 1. Tasks completed in the last 48 h
    const wsTasksDone = allTasks.filter(
      (t) =>
        (t.workspace_id ?? "personal") === activeWorkspaceId &&
        t.status === "done" &&
        t.completed_at &&
        new Date(t.completed_at).getTime() >= cutoff
    );
    for (const t of wsTasksDone) {
      result.push({
        id: `task_done_${t.id}`,
        icon: "✅",
        label: isAr
          ? `تم إكمال "${t.title}"`
          : `Task completed: "${t.title}"`,
        time: t.completed_at!,
      });
    }

    // 2. Tasks created in the last 48 h (non-done)
    const wsTasksNew = allTasks.filter(
      (t) =>
        (t.workspace_id ?? "personal") === activeWorkspaceId &&
        t.status !== "done" &&
        new Date(t.created_at).getTime() >= cutoff
    );
    for (const t of wsTasksNew) {
      result.push({
        id: `task_new_${t.id}`,
        icon: "➕",
        label: isAr ? `مهمة جديدة: "${t.title}"` : `New task: "${t.title}"`,
        time: t.created_at,
      });
    }

    // 3. Notifications from notificationsStore
    for (const n of notifications) {
      // DM / mention
      if (n.type === "mention") {
        result.push({
          id: `notif_${n.id}`,
          icon: "💬",
          label: isAr ? `ذُكرت في تعليق` : `You were mentioned in a comment`,
          time: n.created_at,
        });
        continue;
      }
      // Assignment
      if (n.type === "assignment") {
        result.push({
          id: `notif_${n.id}`,
          icon: "📌",
          label: isAr ? `تم تكليفك بمهمة: ${n.title}` : `You were assigned: ${n.title}`,
          time: n.created_at,
        });
        continue;
      }
      // Workspace invite (member joined)
      if (n.type === "workspace_invite") {
        result.push({
          id: `notif_${n.id}`,
          icon: "👋",
          label: isAr
            ? `دعوة للانضمام إلى ${n.workspace?.name ?? "مساحة عمل"}`
            : `Workspace invite: ${n.workspace?.name ?? "a workspace"}`,
          time: n.created_at,
        });
        continue;
      }
      // Generic info
      if (n.type === "info") {
        result.push({
          id: `notif_${n.id}`,
          icon: "🔔",
          label: n.title,
          time: n.created_at,
        });
      }
    }

    // 4. Members who joined within the last 48 h
    for (const m of wsMembers) {
      if (!m.addedAt) continue;
      if (new Date(m.addedAt).getTime() >= cutoff) {
        result.push({
          id: `member_${m.id}`,
          icon: "👋",
          label: isAr
            ? `${m.name} انضم إلى مساحة العمل`
            : `${m.name} joined the workspace`,
          time: m.addedAt,
        });
      }
    }

    // Sort descending, deduplicate ids, cap at 20
    const seen = new Set<string>();
    return result
      .sort((a, b) => b.time.localeCompare(a.time))
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, 20);
  }, [allTasks, notifications, wsMembers, activeWorkspaceId, isAr]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <span className="text-2xl">🌱</span>
        <p>
          {isAr
            ? "لا يوجد نشاط بعد — ابدأ بإنشاء مهام وتعاون مع فريقك"
            : "No activity yet — create tasks and collaborate with your team"}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-0 divide-y divide-border/30">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-3 px-4 py-3 transition hover:bg-secondary/30"
        >
          {/* Icon bubble */}
          <span
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm"
            aria-hidden
          >
            {item.icon}
          </span>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p
              dir="auto"
              className="line-clamp-2 text-sm leading-snug text-foreground/90"
            >
              {item.label}
            </p>
            <p className="mt-0.5 font-micro text-[11px] text-muted-foreground/60">
              {timeAgo(item.time)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
