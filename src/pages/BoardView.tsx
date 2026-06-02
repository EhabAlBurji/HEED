import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ImagePlus, Maximize2, Minimize2 } from "lucide-react";
import { useCanvasStore } from "../stores/canvasStore";
import { CanvasSurface } from "../components/canvas/CanvasSurface";
import { ShareBoardButton } from "../components/canvas/ShareBoardButton";
import { TaskDetailDrawer } from "../components/tasks/TaskDetailDrawer";
import { cn } from "../lib/utils";

export default function BoardView() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const boards = useCanvasStore((s) => s.boards);
  const renameBoard = useCanvasStore((s) => s.renameBoard);
  const setBoardCover = useCanvasStore((s) => s.setBoardCover);
  const board = boards.find((b) => b.id === id);

  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  if (!board) {
    return (
      <div className="grid h-full place-items-center">
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">{t("boards.notFound")}</p>
          <button onClick={() => navigate("/boards")} className="text-sm text-primary hover:underline">
            {t("boards.backToBoards")}
          </button>
        </div>
      </div>
    );
  }

  const commitRename = () => {
    if (draft.trim()) renameBoard(board.id, draft.trim());
    setEditing(false);
  };

  return (
    <div className={cn("flex h-full flex-col", fullscreen && "fixed inset-0 z-50 bg-background")}>
      <header className="flex items-center gap-3 border-b border-border/60 px-6 py-3">
        <button
          onClick={() => navigate("/boards")}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            className="rounded-md border border-primary/40 bg-background px-2 py-1 text-lg font-medium outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setDraft(board.name);
              setEditing(true);
            }}
            className="font-display text-xl font-medium hover:underline"
            title={t("boards.rename")}
          >
            {board.name}
          </button>
        )}

        <div className="ms-auto flex items-center gap-2">
          <ShareBoardButton board={board} />
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => setBoardCover(board.id, reader.result as string);
              reader.readAsDataURL(f);
            }}
          />
          <button
            onClick={() => coverRef.current?.click()}
            title={t("boards.coverTitle")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <ImagePlus className="h-4 w-4" />
            <span className="font-micro text-xs">{t("boards.cover")}</span>
          </button>
          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? t("boards.exitFullscreen") : t("boards.fullscreen")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="font-micro text-xs">{fullscreen ? t("boards.minimize") : t("boards.fullscreen")}</span>
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <CanvasSurface spaceId={board.id} projectId={null} onOpenTask={setOpenTaskId} />
      </div>

      <TaskDetailDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </div>
  );
}
