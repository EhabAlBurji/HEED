import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, RefreshCw, X, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import { useNotificationsStore } from "../stores/notificationsStore";

const useI = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  return <T,>(ar: T, en: T) => (isAr ? ar : en);
};

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type UpdateInfo = {
  version: string;
  notes?: string;
  downloadAndInstall: (
    onProgress: (e: { event: string; data?: { chunkLength?: number; contentLength?: number } }) => void
  ) => Promise<void>;
};

type Phase = "idle" | "available" | "downloading" | "ready" | "error";

// Checks for updates on mount and surfaces a toast in the bottom-right when
// one is available. The user opts in to downloading. No-op in browser dev.
export function UpdateChecker() {
  const tr = useI();
  const [phase, setPhase] = useState<Phase>("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;

    const checkNow = async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (cancelled || !update) return;
        setInfo(update as unknown as UpdateInfo);
        // Don't interrupt an in-progress download/install.
        setPhase((p) => (p === "downloading" || p === "ready" ? p : "available"));
        // Drop a notice in the top bell (deduped per version).
        const title = `تحديث جديد متاح · Update available v${update.version}`;
        const notifs = useNotificationsStore.getState().notifications;
        if (!notifs.some((n) => n.title === title)) {
          useNotificationsStore.getState().add({
            type: "info",
            title,
            body: "افتح الإعدادات لتثبيت التحديث · Open Settings to install",
          });
        }
      } catch (e) {
        // Updater unavailable (dev build, no signing key, offline) — silent.
        // eslint-disable-next-line no-console
        console.warn("[updater] check failed:", (e as Error).message);
      }
    };

    void checkNow();
    // Re-check periodically so a published update reaches users without a restart.
    const id = setInterval(() => void checkNow(), 20 * 60 * 1000);
    const onFocus = () => void checkNow();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const handleInstall = async () => {
    if (!info) return;
    setPhase("downloading");
    setProgress(0);
    setTotal(0);
    try {
      await info.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data?.contentLength) {
          setTotal(event.data.contentLength);
        } else if (event.event === "Progress" && event.data?.chunkLength) {
          setProgress((p) => p + (event.data?.chunkLength ?? 0));
        }
      });
      setPhase("ready");
      // Restart the app to apply the update
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  };

  if (phase === "idle") return null;

  const pct = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0;

  return (
    <div className="fixed bottom-4 end-4 z-50 w-[320px] animate-in slide-in-from-bottom-4 fade-in">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border bg-gradient-to-l from-primary/10 to-transparent px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">
              {tr("تحديث متاح", "Update available")}
            </span>
          </div>
          {phase !== "downloading" && (
            <button
              onClick={() => setPhase("idle")}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
              aria-label="dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="space-y-3 p-4">
          {info?.version && (
            <p className="text-sm text-foreground/80">
              {tr("الإصدار ", "Version ")}
              <span className="font-mono font-semibold">{info.version}</span>
              {tr(" جاهز للتثبيت", " is ready to install")}
            </p>
          )}

          {phase === "available" && (
            <button
              onClick={handleInstall}
              className="btn-cta flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
            >
              <Download className="h-4 w-4" />
              {tr("تحديث الآن", "Update now")}
            </button>
          )}

          {phase === "downloading" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-foreground/70">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  {tr("جاري التحميل…", "Downloading…")}
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full bg-primary transition-all duration-200",
                    total === 0 && "animate-pulse"
                  )}
                  style={{ width: total > 0 ? `${pct}%` : "30%" }}
                />
              </div>
            </div>
          )}

          {phase === "ready" && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {tr("جاري إعادة التشغيل…", "Restarting…")}
            </p>
          )}

          {phase === "error" && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                {tr("فشل التحديث: ", "Update failed: ")}
                {error}
              </p>
              <button
                onClick={() => setPhase("available")}
                className="text-xs text-primary hover:underline"
              >
                {tr("حاول مرة أخرى", "Try again")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
