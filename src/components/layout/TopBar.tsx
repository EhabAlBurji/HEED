import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import { Pause, Play, Square, Timer, LogOut, Bell, Check, X, Settings as SettingsIcon, ChevronDown, PanelLeft } from "lucide-react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useNavigate } from "react-router-dom";
import { useTimerStore } from "../../stores/timerStore";
import { useAuthStore } from "../../stores/authStore";
import { useNotificationsStore } from "../../stores/notificationsStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { acceptInviteServer, removeNotificationServer } from "../../lib/teamSync";
import { pullAll } from "../../lib/sync";
import { navigateToTask } from "../../lib/openTask";
import { useNow } from "../../hooks/useNow";
import { formatHMS } from "../../lib/utils";
import { cn } from "../../lib/utils";
import { pauseAndCommit, stopTimerAndCommit } from "../../lib/timerActions";
import { Avatar } from "../Avatar";
import { SyncStatusIndicator } from "../SyncStatusIndicator";

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const isMobile = useIsMobile();
  useNow(1000);

  const activeTask     = useTimerStore((s) => s.activeTask);
  const isRunning      = useTimerStore((s) => s.isRunning);
  const elapsedSeconds = useTimerStore((s) => s.getElapsedSeconds());
  const estimated      = activeTask?.estimatedMinutes ?? null;
  const resume         = useTimerStore((s) => s.resume);

  const overTime = estimated !== null && elapsedSeconds > estimated * 60;

  return (
    <header
      data-tauri-drag-region
      className={cn(
        "drag-region flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-5",
        "select-none",
      )}
    >
      {/* Left: sidebar toggle + drag region. ps-16 clears the macOS traffic
          lights on desktop; tighter on phones. */}
      <div
        data-tauri-drag-region
        className={cn("flex h-full flex-1 items-center", isMobile ? "ps-2" : "ps-16")}
      >
        <button
          onClick={onToggleSidebar}
          title={isAr ? "إظهار/إخفاء القائمة" : "Toggle sidebar"}
          className="no-drag grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground/70 transition hover:bg-secondary hover:text-foreground"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Right: timer + settings/notif/user */}
      <div className="no-drag flex items-center gap-2">
        {/* Active timer */}
        {activeTask && (
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 shadow-sm">
            <Timer className="h-3.5 w-3.5 text-primary" />
            <span className="max-w-[14ch] truncate text-sm leading-none">
              {activeTask.title}
            </span>
            <span className={cn("font-micro tabular-nums text-sm", overTime ? "text-orange-500" : "text-foreground")}>
              {formatHMS(elapsedSeconds)}
            </span>
            {estimated !== null && (
              <span className="font-micro text-xs text-muted-foreground">/ {estimated}m</span>
            )}
            {isRunning ? (
              <button onClick={pauseAndCommit} className="grid h-7 w-7 place-items-center rounded-full bg-secondary hover:bg-secondary/80 transition-colors" aria-label={t("timer.pause")}>
                <Pause className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={resume} className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity" aria-label={t("timer.start")}>
                <Play className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={stopTimerAndCommit} className="grid h-7 w-7 place-items-center rounded-full bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors" aria-label={t("timer.stop")}>
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Sync status pill */}
        <SyncStatusIndicator />

        {/* Round action buttons (settings + notifications) */}
        <RoundButton title={t("nav.settings")} pathOnClick="/settings">
          <SettingsIcon className="h-4 w-4" />
        </RoundButton>
        <NotificationBell />

        {/* User chip with name + avatar + dropdown */}
        <UserChip />
      </div>
    </header>
  );
}

function RoundButton({
  children,
  title,
  hasDot,
  pathOnClick,
}: {
  children: React.ReactNode;
  title: string;
  hasDot?: boolean;
  pathOnClick?: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => pathOnClick && navigate(pathOnClick)}
      title={title}
      className="relative grid h-9 w-9 place-items-center rounded-full bg-background border border-border text-foreground/70 transition hover:bg-secondary hover:text-foreground"
    >
      {children}
      {hasDot && (
        <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
      )}
    </button>
  );
}

function notifStamp(iso: string, isAr: boolean) {
  const d = new Date(iso);
  const date = d.toLocaleDateString(isAr ? "ar" : "en", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function NotificationBell() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const notifications = useNotificationsStore((s) => s.notifications);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const remove = useNotificationsStore((s) => s.remove);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const acceptInvite = async (id: string, ws: { id: string; name: string; color: string }) => {
    useWorkspaceStore.setState((s) => ({
      workspaces: s.workspaces.some((w) => w.id === ws.id)
        ? s.workspaces
        : [...s.workspaces, { id: ws.id, name: ws.name, type: "team", color: ws.color, memberCount: 1, members: [] }],
    }));
    setActiveWorkspace(ws.id);
    remove(id);
    setOpen(false);
    void removeNotificationServer(id);
    // Join server-side (grants RLS access), THEN pull so the shared workspace's
    // EXISTING tasks/projects/boards load — realtime only delivers future changes.
    await acceptInviteServer(ws.id);
    void pullAll();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) markAllRead();
        }}
        title={t("notifications.bell")}
        className="relative grid h-9 w-9 place-items-center rounded-full bg-background border border-border text-foreground/70 transition hover:bg-secondary hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 font-micro text-[9px] font-bold text-white ring-2 ring-card">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
            <span className="text-sm font-semibold">{t("notifications.title")}</span>
            <span className="font-micro text-[10px] text-muted-foreground">{notifications.length}</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-8 text-center font-micro text-xs text-muted-foreground/50">{t("notifications.none")}</p>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => { if (n.taskId) { setOpen(false); void navigateToTask(n.taskId, navigate); } }}
                className={cn(
                  "border-b border-border/30 px-4 py-3 last:border-0",
                  n.taskId && "cursor-pointer hover:bg-secondary/40"
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: n.read ? "transparent" : "hsl(var(--primary))" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 font-micro text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 font-micro text-[10px] text-muted-foreground/50">{notifStamp(n.created_at, isAr)}</p>
                    {n.type === "workspace_invite" && n.workspace && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => acceptInvite(n.id, n.workspace!)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 font-micro text-[11px] font-medium text-primary-foreground hover:opacity-90"
                        >
                          <Check className="h-3 w-3" /> {t("notifications.accept")}
                        </button>
                        <button
                          onClick={() => { void removeNotificationServer(n.id); remove(n.id); }}
                          className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 font-micro text-[11px] text-muted-foreground hover:bg-secondary/70"
                        >
                          <X className="h-3 w-3" /> {t("notifications.reject")}
                        </button>
                      </div>
                    )}
                  </div>
                  {n.type !== "workspace_invite" && (
                    <button onClick={(e) => { e.stopPropagation(); void removeNotificationServer(n.id); remove(n.id); }} className="text-muted-foreground/50 hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserChip() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isGuest = user?.id === "guest";
  const initials = user?.name
    ? user.name.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : "؟";
  const displayName = user?.name ?? (isGuest ? "زائر" : user?.email?.split("@")[0] ?? "");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-background border border-border ps-1 pe-3 py-1 transition hover:bg-secondary"
      >
        <Avatar
          value={user?.avatarUrl}
          fallback={initials}
          size="sm"
          shape="circle"
        />
        <span className="max-w-[12ch] truncate text-sm font-medium text-foreground">
          {displayName}
        </span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className="absolute end-0 top-full z-50 mt-2 w-48 rounded-2xl border border-border bg-popover p-1.5 shadow-xl"
        >
          <button
            onClick={() => { navigate("/settings"); setOpen(false); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:bg-secondary transition"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            <span>الإعدادات</span>
          </button>
          <button
            onClick={() => { signOut(); setOpen(false); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-destructive/85 hover:bg-destructive/10 hover:text-destructive transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>تسجيل خروج</span>
          </button>
        </div>
      )}
    </div>
  );
}
