import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import { Pause, Play, Square, Timer, LogOut, Bell, Settings as SettingsIcon, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTimerStore } from "../../stores/timerStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useAuthStore } from "../../stores/authStore";
import { useNow } from "../../hooks/useNow";
import { formatHMS } from "../../lib/utils";
import { cn } from "../../lib/utils";
import { pauseAndCommit, stopTimerAndCommit } from "../../lib/timerActions";
import { Avatar } from "../Avatar";
import { SyncStatusIndicator } from "../SyncStatusIndicator";

async function toggleMaximize() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("toggle_maximize");
  } catch {}
}

export function TopBar() {
  const { t } = useTranslation();
  useNow(1000);

  const activeTask     = useTimerStore((s) => s.activeTask);
  const isRunning      = useTimerStore((s) => s.isRunning);
  const elapsedSeconds = useTimerStore((s) => s.getElapsedSeconds());
  const estimated      = activeTask?.estimatedMinutes ?? null;
  const resume         = useTimerStore((s) => s.resume);

  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  const overTime = estimated !== null && elapsedSeconds > estimated * 60;

  return (
    <header
      onDoubleClick={toggleMaximize}
      className={cn(
        "drag-region flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-5",
        "select-none",
      )}
    >
      {/* Left: workspace chip (the brand logo lives in the sidebar) */}
      <div className="flex items-center gap-3 ps-16">
        {activeWs && (
          <div className="flex items-center gap-2 rounded-full bg-secondary/60 px-3 py-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: activeWs.color }}
            />
            <span className="font-micro text-xs font-medium text-foreground/80">
              {activeWs.name}
            </span>
          </div>
        )}
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
        <RoundButton title="إشعارات" hasDot>
          <Bell className="h-4 w-4" />
        </RoundButton>

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
