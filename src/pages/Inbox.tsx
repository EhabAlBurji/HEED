import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AtSign, Bell, Check, CheckCheck, Inbox as InboxIcon, UserPlus, Users, X } from "lucide-react";
import { useNotificationsStore, type AppNotification } from "../stores/notificationsStore";
import { acceptWorkspaceInvite, rejectWorkspaceInvite } from "../lib/inviteActions";
import { navigateToTask } from "../lib/openTask";
import { Page } from "../components/ui/grid";
import { cn } from "../lib/utils";

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

const typeIcon = (type: AppNotification["type"]) => {
  switch (type) {
    case "mention": return <AtSign className="h-4 w-4" />;
    case "assignment": return <UserPlus className="h-4 w-4" />;
    case "workspace_invite": return <Users className="h-4 w-4" />;
    default: return <Bell className="h-4 w-4" />;
  }
};

export default function Inbox() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();
  const notifications = useNotificationsStore((s) => s.notifications);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const remove = useNotificationsStore((s) => s.remove);

  const unread = notifications.filter((n) => !n.read).length;

  // Group newest-first notifications by calendar day.
  const groups = useMemo(() => {
    const out: Array<{ key: string; items: AppNotification[] }> = [];
    for (const n of notifications) {
      const k = dayKey(n.created_at);
      const g = out.find((x) => x.key === k);
      if (g) g.items.push(n);
      else out.push({ key: k, items: [n] });
    }
    return out;
  }, [notifications]);

  const open = (n: AppNotification) => {
    markRead(n.id);
    if (n.taskId) void navigateToTask(n.taskId, navigate);
  };

  return (
    <Page className="h-full overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <InboxIcon className="h-5 w-5 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-semibold">{isAr ? "البريد الوارد" : "Inbox"}</h1>
            <p className="font-micro text-xs text-muted-foreground">
              {isAr ? "المنشن والإشعارات من فريقك" : "Mentions & updates from your team"}
            </p>
          </div>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {isAr ? "تعليم الكل كمقروء" : "Mark all read"}
          </button>
        )}
      </div>

      {notifications.length === 0 && (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border/50 py-20 text-center">
          <InboxIcon className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{isAr ? "مفيش إشعارات لسه" : "No notifications yet"}</p>
          <p className="mt-1 font-micro text-xs text-muted-foreground/60">
            {isAr ? "لما حد يمنشنك أو يكلّفك بمهمة هتظهرلك هنا" : "When someone @mentions or assigns you, it shows up here"}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.key}>
            <h3 className="mb-2 font-micro text-[11px] uppercase tracking-widest text-muted-foreground/60">
              {groupTitle(g.items[0].created_at, isAr)}
            </h3>
            <div className="overflow-hidden rounded-2xl border border-border/60">
              {g.items.map((n) => {
                const clickable = Boolean(n.taskId);
                return (
                  <div
                    key={n.id}
                    onClick={() => clickable && open(n)}
                    className={cn(
                      "group flex items-start gap-3 border-b border-border/40 px-4 py-3 transition last:border-0",
                      clickable && "cursor-pointer hover:bg-secondary/40",
                      !n.read && "bg-primary/[0.04]"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
                        n.read ? "bg-secondary text-muted-foreground" : "bg-primary/15 text-primary"
                      )}
                    >
                      {typeIcon(n.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
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

                    <span className="shrink-0 font-micro text-[10px] text-muted-foreground/60">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {n.type !== "workspace_invite" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                        className="opacity-0 transition group-hover:opacity-100"
                        title={isAr ? "حذف" : "Dismiss"}
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-foreground" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Page>
  );
}
