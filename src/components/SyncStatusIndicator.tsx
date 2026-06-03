import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useSyncStatusStore } from "../stores/syncStatusStore";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import { pullAll } from "../lib/sync";

const useI = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  return <T,>(ar: T, en: T) => (isAr ? ar : en);
};

function timeAgo(ts: number, isAr: boolean): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return isAr ? "الآن" : "just now";
  if (s < 60) return isAr ? `منذ ${s}ث` : `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return isAr ? `منذ ${m}د` : `${m}m ago`;
  const h = Math.floor(m / 60);
  return isAr ? `منذ ${h}س` : `${h}h ago`;
}

export function SyncStatusIndicator() {
  const tr = useI();
  const { state, pending, lastSyncedAt, lastError } = useSyncStatusStore();
  const [, force] = useState(0);

  // Re-render every 30s so "x minutes ago" stays fresh
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const ui = (() => {
    switch (state) {
      case "offline":
        return {
          icon: <CloudOff className="h-3.5 w-3.5" />,
          label: tr("بدون مزامنة", "Offline"),
          dot: "bg-muted-foreground/40",
          tone: "text-muted-foreground",
        };
      case "syncing":
        return {
          icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
          label: tr(
            pending > 1 ? `جاري المزامنة (${pending})` : "جاري المزامنة",
            pending > 1 ? `Syncing (${pending})` : "Syncing"
          ),
          dot: "bg-amber-500 animate-pulse",
          tone: "text-amber-600 dark:text-amber-400",
        };
      case "synced":
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          label: lastSyncedAt
            ? tr(`مُحدّث ${timeAgo(lastSyncedAt, true)}`, `Synced ${timeAgo(lastSyncedAt, false)}`)
            : tr("مُحدّث", "Synced"),
          dot: "bg-emerald-500",
          tone: "text-emerald-600 dark:text-emerald-400",
        };
      case "error":
        return {
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          label: tr("خطأ في المزامنة", "Sync error"),
          dot: "bg-destructive",
          tone: "text-destructive",
        };
      default:
        return {
          icon: <Cloud className="h-3.5 w-3.5" />,
          label: tr("جاهز", "Ready"),
          dot: "bg-muted-foreground/40",
          tone: "text-muted-foreground",
        };
    }
  })();

  return (
    <button
      onClick={() => void pullAll().catch(() => {})}
      title={lastError ?? tr("اضغط للمزامنة الآن", "Click to sync now")}
      className={cn(
        "hidden md:flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 transition hover:bg-secondary",
        ui.tone
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ui.dot)} />
      {ui.icon}
      <span className="font-micro text-[11px] font-medium whitespace-nowrap">{ui.label}</span>
    </button>
  );
}
