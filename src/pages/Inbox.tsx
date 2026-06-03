import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AtSign, Bell, Check, FileText, Inbox as InboxIcon, UserPlus, Users, X } from "lucide-react";
import { useNotificationsStore, type AppNotification } from "../stores/notificationsStore";
import { useTasksStore, type TaskComment } from "../stores/tasksStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useAuthStore } from "../stores/authStore";
import { acceptWorkspaceInvite, rejectWorkspaceInvite } from "../lib/inviteActions";
import { fetchRecentActivity } from "../lib/teamSync";
import { navigateToTask } from "../lib/openTask";
import { Page } from "../components/ui/grid";
import { cn } from "../lib/utils";

type FeedItem =
  | { id: string; at: string; kind: "comment"; comment: TaskComment }
  | { id: string; at: string; kind: "notif"; notif: AppNotification };

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}
function groupTitle(iso: string, isAr: boolean) {
  const d = new Date(iso);
  const today = new Date(new Date().toDateString());
  const diff = Math.round((new Date(d.toDateString()).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return isAr ? "اليوم" : "Today";
  if (diff === -1) return isAr ? "أمس" : "Yesterday";
  return d.toLocaleDateString(isAr ? "ar" : "en", { day: "numeric", month: "long" });
}
function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
// Highlight @mentions inside a snippet.
function renderSnippet(body: string) {
  return body.split(/(@[\w.-]+)/g).map((p, i) =>
    p.startsWith("@") ? <span key={i} className="font-medium text-primary">{p}</span> : <span key={i}>{p}</span>
  );
}

export default function Inbox() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();

  const comments = useTasksStore((s) => s.comments);
  const tasks = useTasksStore((s) => s.tasks);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const notifications = useNotificationsStore((s) => s.notifications);
  const remove = useNotificationsStore((s) => s.remove);
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<"all" | "mentions">("all");

  // Pull recent team activity on open + refresh periodically.
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

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    for (const c of comments) {
      if (!wsIds.has(c.workspace_id)) continue;
      items.push({ id: "c_" + c.id, at: c.created_at, kind: "comment", comment: c });
    }
    for (const n of notifications) {
      if (n.type === "mention") continue; // a mention is already shown as its comment
      items.push({ id: "n_" + n.id, at: n.created_at, kind: "notif", notif: n });
    }
    let list = items.sort((a, b) => b.at.localeCompare(a.at));
    if (filter === "mentions") list = list.filter((i) => i.kind === "comment" && mentionsMe(i.comment.body));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, notifications, wsIds, filter, myHandle]);

  const groups = useMemo(() => {
    const out: Array<{ key: string; items: FeedItem[] }> = [];
    for (const it of feed) {
      const k = dayKey(it.at);
      const g = out.find((x) => x.key === k);
      if (g) g.items.push(it);
      else out.push({ key: k, items: [it] });
    }
    return out;
  }, [feed]);

  const Tab = ({ id, label }: { id: "all" | "mentions"; label: string }) => (
    <button
      onClick={() => setFilter(id)}
      className={cn(
        "border-b-2 px-1 pb-2 text-sm font-medium transition",
        filter === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );

  return (
    <Page className="h-full overflow-y-auto">
      <div className="mb-4 flex items-center gap-2.5">
        <InboxIcon className="h-5 w-5 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-semibold">{isAr ? "البريد الوارد" : "Inbox"}</h1>
          <p className="font-micro text-xs text-muted-foreground">
            {isAr ? "المنشن والمحادثات في مهام فريقك" : "Mentions & conversations across your team's tasks"}
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-5 border-b border-border/50">
        <Tab id="all" label={isAr ? "الكل" : "All"} />
        <Tab id="mentions" label={isAr ? "المنشن" : "Mentions"} />
      </div>

      {feed.length === 0 && (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border/50 py-20 text-center">
          <InboxIcon className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {filter === "mentions"
              ? (isAr ? "مفيش منشن ليك لسه" : "No mentions yet")
              : (isAr ? "مفيش نشاط لسه" : "No activity yet")}
          </p>
          <p className="mt-1 font-micro text-xs text-muted-foreground/60">
            {isAr ? "أي رسالة أو منشن في مهام فريقك هتظهر هنا" : "Messages & mentions in your team's tasks show up here"}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.key}>
            <h3 className="mb-2 font-micro text-[11px] uppercase tracking-widest text-muted-foreground/60">
              {groupTitle(g.items[0].at, isAr)}
            </h3>
            <div className="overflow-hidden rounded-2xl border border-border/60">
              {g.items.map((it) =>
                it.kind === "comment" ? (
                  <CommentItem
                    key={it.id}
                    c={it.comment}
                    title={taskTitle(it.comment.task_id)}
                    mine={Boolean(user && it.comment.author_id === user.id)}
                    mentioned={mentionsMe(it.comment.body)}
                    isAr={isAr}
                    onOpen={() => void navigateToTask(it.comment.task_id, navigate)}
                  />
                ) : (
                  <NotifItem key={it.id} n={it.notif} isAr={isAr} onRemove={() => remove(it.notif.id)} navigate={navigate} />
                )
              )}
            </div>
          </section>
        ))}
      </div>
    </Page>
  );
}

function CommentItem({
  c, title, mine, mentioned, isAr, onOpen,
}: {
  c: TaskComment; title?: string; mine: boolean; mentioned: boolean; isAr: boolean; onOpen: () => void;
}) {
  const snippet = c.body?.trim()
    ? c.body
    : c.attachments?.length
    ? (isAr ? "📎 أرسل مرفق" : "📎 sent an attachment")
    : "";
  return (
    <button onClick={onOpen} className="group flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-start transition last:border-0 hover:bg-secondary/40">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 text-[11px] font-bold text-primary">
        {c.author_avatar ? <img src={c.author_avatar} alt="" className="h-full w-full object-cover" /> : (c.author_name[0] ?? "?").toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{mine ? (isAr ? "أنت" : "You") : c.author_name}</span>
          {mentioned && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 font-micro text-[9px] font-bold text-primary">
              <AtSign className="h-2.5 w-2.5" /> {isAr ? "منشن ليك" : "mentioned you"}
            </span>
          )}
          <span className="ms-auto shrink-0 font-micro text-[10px] text-muted-foreground/60">{hhmm(c.created_at)}</span>
        </div>
        {title && (
          <p className="flex items-center gap-1 truncate font-micro text-[11px] text-muted-foreground">
            <FileText className="h-3 w-3 shrink-0 opacity-60" />
            {title}
          </p>
        )}
        {snippet && <p className="mt-0.5 line-clamp-2 text-sm text-foreground/80">{renderSnippet(snippet)}</p>}
      </div>
    </button>
  );
}

function NotifItem({
  n, isAr, onRemove, navigate,
}: {
  n: AppNotification; isAr: boolean; onRemove: () => void; navigate: ReturnType<typeof useNavigate>;
}) {
  const icon = n.type === "assignment" ? <UserPlus className="h-4 w-4" /> : n.type === "workspace_invite" ? <Users className="h-4 w-4" /> : <Bell className="h-4 w-4" />;
  const clickable = Boolean(n.taskId);
  return (
    <div
      onClick={() => clickable && void navigateToTask(n.taskId, navigate)}
      className={cn(
        "group flex items-start gap-3 border-b border-border/40 px-4 py-3 transition last:border-0",
        clickable && "cursor-pointer hover:bg-secondary/40",
        !n.read && "bg-primary/[0.04]"
      )}
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{n.title}</p>
        {n.body && <p className="mt-0.5 font-micro text-xs text-muted-foreground">{n.body}</p>}
        {n.type === "workspace_invite" && n.workspace && (
          <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => void acceptWorkspaceInvite(n.id, n.workspace!)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 font-micro text-[11px] font-medium text-primary-foreground hover:opacity-90"
            >
              <Check className="h-3 w-3" /> {isAr ? "قبول" : "Accept"}
            </button>
            <button
              onClick={() => rejectWorkspaceInvite(n.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 font-micro text-[11px] text-muted-foreground hover:bg-secondary/70"
            >
              <X className="h-3 w-3" /> {isAr ? "رفض" : "Decline"}
            </button>
          </div>
        )}
      </div>
      <span className="shrink-0 font-micro text-[10px] text-muted-foreground/60">{hhmm(n.created_at)}</span>
      {n.type !== "workspace_invite" && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="opacity-0 transition group-hover:opacity-100" title={isAr ? "حذف" : "Dismiss"}>
          <X className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-foreground" />
        </button>
      )}
    </div>
  );
}
