import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Share2 } from "lucide-react";
import { useCanvasStore, type Board } from "../../stores/canvasStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";

// Share a board into the user's OTHER workspaces (cross-workspace). Toggling a
// workspace adds/removes it from `shared_workspace_ids`; the board then shows
// up in that workspace's Boards list (and syncs to its members).
export function ShareBoardButton({ board }: { board: Board }) {
  const { t } = useTranslation();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const shareBoardTo = useCanvasStore((s) => s.shareBoardTo);
  const unshareBoardFrom = useCanvasStore((s) => s.unshareBoardFrom);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const targets = workspaces.filter((w) => w.id !== board.workspace_id);
  const sharedCount = board.shared_workspace_ids.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={t("boards.share")}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <Share2 className="h-4 w-4" />
        <span className="font-micro text-xs">{sharedCount > 0 ? `${t("boards.shared")} · ${sharedCount}` : t("boards.share")}</span>
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border/60 bg-popover p-2 shadow-2xl">
          <p className="px-1 pb-1.5 font-micro text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("boards.shareTo")}
          </p>
          {targets.length === 0 && (
            <p className="px-1 py-2 font-micro text-[11px] text-muted-foreground/50">{t("boards.shareNone")}</p>
          )}
          {targets.map((w) => {
            const on = board.shared_workspace_ids.includes(w.id);
            return (
              <button
                key={w.id}
                onClick={() => (on ? unshareBoardFrom(board.id, w.id) : shareBoardTo(board.id, w.id))}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm transition hover:bg-secondary"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: w.color }} />
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                {on && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
