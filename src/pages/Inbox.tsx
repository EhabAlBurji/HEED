import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AtSign, Bell, Check, ChevronRight, FileText, Inbox as InboxIcon, UserPlus, Users, X } from "lucide-react";
import { useNotificationsStore, type AppNotification } from "../stores/notificationsStore";
import { useTasksStore, type TaskComment } from "../stores/tasksStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useAuthStore } from "../stores/authStore";
import { useIsMobile } from "../hooks/useIsMobile";
import { acceptWorkspaceInvite, rejectWorkspaceInvite } from "../lib/inviteActions";
import { fetchRecentActivity } from "../lib/teamSync";
import { navigateToTask } from "../lib/openTask";
import { cn } from "../lib/utils";

// =========================================================================
// Inbox — Wrike-style two-pane: a list of activity threads on the left, the
// selected thread (defaulting to the most recent) on the right. Activity in
// the same task is grouped into one thread with a count.
// =========================================================================

type Thread = {
  id: string;
  kind: "task" | "notif";
  title: string;
  taskId?: string;
  messages: TaskComment[];
  notif?: AppNotification;
  lastAt: string;
  lastBy: string;
  snippet: string;
  count: number;
  mineLatest: boolean;
  unread: boolean;
};

function dayKey(iso: string) { return new Date(iso).toDateString(); }
function groupTitle(iso: string, isAr: boolean) {
  const d = new Date(iso);
  const today = new Date(new Date().toDateString());
  const diff = Math.round((new Date(d.toDateString()).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return isAr ? "اليوم" : "Today";
  if (diff === -1) return isAr ? "أمس" : "Yesterday";
  return d.toLocaleDateString(isAr ? "ar" : "en", { day: "numeric", month: "long" });
}
function hhmm(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function stamp(iso: string, isAr: boolean) {
  return `${new Date(iso).toLocaleDateString(isAr ? "ar" : "en", { day: "numeric", month: "short" })} · ${hhmm(iso)}`;
}
function isSystemNotif(n: AppNotification) {
  return /access request|طلب وصول|update available|تحديث/i.test(n.title);
}
function renderSnippet(body: string) {
  return body.split(/(@[\w.-]+)/g).map((p, i) =>
    p.startsWith("@") ? <span key={i} className="font-medium text-primary">{p}</span> : <span key={i}>{p}</span>
  );
}

export default function Inbox() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const comments = useTasksStore((s) => s.comments);
  const tasks = useTasksStore((s) => s.tasks);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const notifications = useNotificationsStore((s) => s.notifications);
  const remove = useNotificationsStore((s) => s.remove);
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<"incoming" | "sent" | "archive">("incoming");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listWidth, setListWidth] = useState(400);

  // Drag the divider to resize the list pane (RTL-aware).
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = listWidth;
    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const w = isAr ? startW - delta : startW + delta;
      setListWidth(Math.max(300, Math.min(560, w)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  useEffect(() => {
    void fetchRecentActivity();
    const id = window.setInterval(() => void fetchRecentActivity(), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const myHandle = useMemo(
    () => ((user?.email?.split("@")[0] || user?.name || "") ?? "").replace(/[^\w.-]+/g, "").toLowerCase(),
    [user]
  );
  const wsIds = useMemo(() => new Set(workspaces.map((w) => w.id)), [workspaces]);
  const taskTitle = (id?: string) => (id ? tasks.find((t) => t.id === id)?.title : undefined);
  const mentionsMe = (body: string) => Boolean(myHandle) && body.toLowerCase().includes("@" + myHandle);

  // Build threads: comments grouped by task, plus standalone notifications.
  const threads = useMemo<Thread[]>(() => {
    const byTask = new Map<string, TaskComment[]>();
    for (const c of comments) {
      if (!wsIds.has(c.workspace_id) && !(user && c.author_id === user.id)) continue;
      const arr = byTask.get(c.task_id) ?? [];
      arr.push(c);
      byTask.set(c.task_id, arr);
    }
    const out: Thread[] = [];
    for (const [taskId, arr] of byTask) {
      arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
      const last = arr[arr.length - 1];
      const mine = Boolean(user && last.author_id === user.id);
      out.push({
        id: "t_" + taskId, kind: "task", title: taskTitle(taskId) || (isAr ? "مهمة" : "Task"),
        taskId, messages: arr, lastAt: last.created_at,
        lastBy: mine ? (isAr ? "أنت" : "You") : last.author_name,
        snippet: last.body, count: arr.length, mineLatest: mine, unread: false,
      });
    }
    for (const n of notifications) {
      if (n.type === "mention" || isSystemNotif(n)) continue;
      out.push({
        id: "n_" + n.id, kind: "notif", title: n.title, taskId: n.taskId, messages: [], notif: n,
        lastAt: n.created_at, lastBy: "", snippet: n.body || "", count: 1, mineLatest: false, unread: !n.read,
      });
    }
    return out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, notifications, wsIds, user, isAr]);

  const visible = useMemo(
    () => tab === "sent" ? threads.filter((t) => t.kind === "task" && t.mineLatest)
        : tab === "archive" ? []
        : threads,
    [threads, tab]
  );

  const groups = useMemo(() => {
    const out: Array<{ key: string; items: Thread[] }> = [];
    for (const it of visible) {
      const k = dayKey(it.lastAt);
      const g = out.find((x) => x.key === k);
      if (g) g.items.push(it); else out.push({ key: k, items: [it] });
    }
    return out;
  }, [visible]);

  const selected = visible.find((t) => t.id === selectedId) ?? null;

  // Default to the most recent thread on desktop.
  useEffect(() => {
    if (!isMobile && visible.length && !visible.some((t) => t.id === selectedId)) {
      setSelectedId(visible[0].id);
    }
  }, [visible, selectedId, isMobile]);

  const TabBtn = ({ id, label }: { id: typeof tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={cn(
        "border-b-2 px-1 pb-2 text-sm font-medium transition",
        tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── List pane ─────────────────────────────────────────── */}
      <div style={!isMobile ? { width: listWidth } : undefined} className={cn("flex flex-col border-e border-border/60", isMobile ? (selected ? "hidden" : "w-full") : "shrink-0")}>
        <div className="px-5 pt-5">
          <div className="flex items-center gap-2">
            <InboxIcon className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-semibold">{isAr ? "البريد الوارد" : "Inbox"}</h1>
          </div>
          <div className="mt-4 flex items-center gap-5 border-b border-border/50">
            <TabBtn id="incoming" label={isAr ? "الوارد" : "Incoming"} />
            <TabBtn id="sent" label={isAr ? "المُرسَل" : "Sent"} />
            <TabBtn id="archive" label={isAr ? "الأرشيف" : "Archive"} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none">
          {visible.length === 0 ? (
            <p className="px-5 py-16 text-center text-sm text-muted-foreground">
              {tab === "archive" ? (isAr ? "الأرشيف فاضي" : "Archive is empty")
                : tab === "sent" ? (isAr ? "مفيش رسائل مُرسَلة" : "Nothing sent yet")
                : (isAr ? "مفيش نشاط لسه" : "No activity yet")}
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.key}>
                <p className="px-5 pb-1 pt-3 font-micro text-[11px] uppercase tracking-widest text-muted-foreground/60">
                  {groupTitle(g.items[0].lastAt, isAr)}
                </p>
                {g.items.map((t) => (
                  <ThreadRow key={t.id} t={t} active={t.id === selectedId} onClick={() => setSelectedId(t.id)} />
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Resize divider (desktop) */}
      {!isMobile && (
        <div
          onPointerDown={startResize}
          title={isAr ? "اسحب لتغيير العرض" : "Drag to resize"}
          className="group relative w-1.5 shrink-0 cursor-col-resize"
        >
          <div className="absolute inset-y-0 start-0 w-px bg-border/60 transition-colors group-hover:bg-primary/50" />
        </div>
      )}

      {/* ── Detail pane ───────────────────────────────────────── */}
      <div className={cn("flex min-w-0 flex-1 flex-col", isMobile && !selected && "hidden")}>
        {selected ? (
          <ThreadDetail
            t={selected}
            isAr={isAr}
            mentionsMe={mentionsMe}
            user={user}
            onBack={() => setSelectedId(null)}
            showBack={isMobile}
            onOpenTask={() => selected.taskId && void navigateToTask(selected.taskId, navigate)}
            onRemoveNotif={() => { if (selected.notif) { remove(selected.notif.id); setSelectedId(null); } }}
          />
        ) : (
          <EmptyDetail isAr={isAr} />
        )}
      </div>
    </div>
  );
}

// ── List row ────────────────────────────────────────────────────────────────
function ThreadRow({ t, active, onClick }: { t: Thread; active: boolean; onClick: () => void }) {
  const last = t.messages[t.messages.length - 1];
  const icon = t.kind === "notif"
    ? (t.notif?.type === "assignment" ? <UserPlus className="h-4 w-4" /> : t.notif?.type === "workspace_invite" ? <Users className="h-4 w-4" /> : <Bell className="h-4 w-4" />)
    : null;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 border-b border-border/30 px-5 py-3 text-start transition",
        active ? "bg-secondary/70" : "hover:bg-secondary/40",
        t.unread && !active && "bg-primary/[0.04]"
      )}
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 text-[12px] font-bold text-primary">
        {t.kind === "notif" ? icon : last?.author_avatar ? <img src={last.author_avatar} alt="" className="h-full w-full object-cover" /> : (t.lastBy[0] ?? "?").toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span dir="auto" className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
          <span className="shrink-0 font-micro text-[10px] text-muted-foreground/60">{hhmm(t.lastAt)}</span>
        </div>
        <p dir="auto" className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
          {t.lastBy && <span className="font-medium text-foreground/70">{t.lastBy}: </span>}
          {renderSnippet(t.snippet || "")}
        </p>
      </div>
      {t.count > 1 && (
        <span className="mt-0.5 grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-secondary px-1.5 font-micro text-[10px] font-bold text-muted-foreground">
          {t.count}
        </span>
      )}
    </button>
  );
}

// ── Detail pane ─────────────────────────────────────────────────────────────
function ThreadDetail({
  t, isAr, mentionsMe, user, onBack, showBack, onOpenTask, onRemoveNotif,
}: {
  t: Thread; isAr: boolean; mentionsMe: (b: string) => boolean;
  user: ReturnType<typeof useAuthStore.getState>["user"];
  onBack: () => void; showBack: boolean; onOpenTask: () => void; onRemoveNotif: () => void;
}) {
  return (
    <>
      {/* header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
        {showBack && (
          <button onClick={onBack} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary">
            <ChevronRight className={cn("h-4 w-4", !isAr && "rotate-180")} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2 dir="auto" className="truncate text-base font-semibold">{t.title}</h2>
          {t.taskId && <p className="font-micro text-[11px] text-muted-foreground">{isAr ? "مهمة" : "Task"}</p>}
        </div>
        {t.taskId && (
          <button onClick={onOpenTask} className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs transition hover:bg-secondary">
            <FileText className="h-3.5 w-3.5" /> {isAr ? "فتح المهمة" : "Open task"}
          </button>
        )}
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-none">
        {t.kind === "task" ? (
          <div className="mx-auto max-w-2xl space-y-4">
            {t.messages.map((c) => {
              const mine = Boolean(user && c.author_id === user.id);
              return (
                <div key={c.id} className="flex gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                    {c.author_avatar ? <img src={c.author_avatar} alt="" className="h-full w-full object-cover" /> : (c.author_name[0] ?? "?").toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{mine ? (isAr ? "أنت" : "You") : c.author_name}</span>
                      {mentionsMe(c.body) && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 font-micro text-[9px] font-bold text-primary">
                          <AtSign className="h-2.5 w-2.5" /> {isAr ? "منشن ليك" : "mentioned you"}
                        </span>
                      )}
                      <span className="ms-auto shrink-0 font-micro text-[10px] text-muted-foreground/60">{stamp(c.created_at, isAr)}</span>
                    </div>
                    <p dir="auto" className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{renderSnippet(c.body)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : t.notif ? (
          <div className="mx-auto max-w-2xl">
            <p className="text-sm font-medium">{t.notif.title}</p>
            {t.notif.body && <p className="mt-1 text-sm text-muted-foreground">{t.notif.body}</p>}
            <p className="mt-2 font-micro text-[11px] text-muted-foreground/60">{stamp(t.notif.created_at, isAr)}</p>
            {t.notif.type === "workspace_invite" && t.notif.workspace && (
              <div className="mt-4 flex gap-2">
                <button onClick={() => void acceptWorkspaceInvite(t.notif!.id, t.notif!.workspace!)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
                  <Check className="h-3.5 w-3.5" /> {isAr ? "قبول" : "Accept"}
                </button>
                <button onClick={() => rejectWorkspaceInvite(t.notif!.id)} className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary/70">
                  <X className="h-3.5 w-3.5" /> {isAr ? "رفض" : "Decline"}
                </button>
              </div>
            )}
            {t.notif.type !== "workspace_invite" && (
              <button onClick={onRemoveNotif} className="mt-4 inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary">
                <X className="h-3.5 w-3.5" /> {isAr ? "حذف" : "Dismiss"}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

// ── Empty detail (no thread selected) ───────────────────────────────────────
function EmptyDetail({ isAr }: { isAr: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-primary/10 text-primary">
        <Bell className="h-9 w-9" />
      </div>
      <p className="text-sm text-muted-foreground">{isAr ? "اختر محادثة لعرضها" : "Select a thread to view it"}</p>
    </div>
  );
}
