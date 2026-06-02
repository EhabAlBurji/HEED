import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutTemplate, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { useCanvasStore } from "../stores/canvasStore";
import { useTasksStore } from "../stores/tasksStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { cn } from "../lib/utils";
import { Page, Grid, Column } from "../components/ui/grid";

export default function Boards() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const boards = useCanvasStore((s) => s.boards);
  const nodes = useCanvasStore((s) => s.nodes);
  const addBoard = useCanvasStore((s) => s.addBoard);
  const removeBoard = useCanvasStore((s) => s.removeBoard);
  const renameBoard = useCanvasStore((s) => s.renameBoard);
  const projects = useTasksStore((s) => s.projects);
  const activeWs = useWorkspaceStore((s) => s.activeWorkspaceId);

  const projectById = new Map(projects.map((p) => [p.id, p]));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const visible = boards.filter(
    (b) => b.workspace_id === activeWs || b.shared_workspace_ids.includes(activeWs)
  );

  const create = () => {
    const b = addBoard();
    navigate(`/boards/${b.id}`);
  };

  const commitRename = (id: string) => {
    if (draft.trim()) renameBoard(id, draft.trim());
    setEditingId(null);
  };

  return (
    <Page className="h-full overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Workflow className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-semibold">Boards</h1>
          <span className="font-micro text-xs text-muted-foreground">· {visible.length}</span>
        </div>
        <button
          onClick={create}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t("boards.newBoard")}
        </button>
      </div>

      {visible.length === 0 ? (
        <button
          onClick={create}
          className="grid h-48 w-full place-items-center rounded-2xl border-2 border-dashed border-border/60 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          <div className="flex flex-col items-center gap-2">
            <LayoutTemplate className="h-7 w-7" />
            <span className="text-sm">{t("boards.emptyCta")}</span>
          </div>
        </button>
      ) : (
        <Grid>
          {visible.map((b) => {
            const boardNodes = nodes.filter((n) => n.space_id === b.id);
            const count = boardNodes.length;
            const isEditing = editingId === b.id;
            // Cover: the board's explicit cover, else the first image node on it.
            const cover =
              b.cover ?? boardNodes.find((n) => n.type === "image" && n.data.src)?.data.src;
            const project = b.project_id ? projectById.get(b.project_id) : null;
            return (
              <Column
                key={b.id}
                span={4}
                md={4}
                sm={4}
                className="group/board relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 transition hover:border-primary/40 hover:shadow-lg"
              >
                <button
                  onClick={() => navigate(`/boards/${b.id}`)}
                  className="relative grid aspect-square w-full place-items-center overflow-hidden bg-[radial-gradient(circle,hsl(var(--muted-foreground)/0.22)_1.4px,transparent_1.4px)] [background-size:18px_18px]"
                >
                  {cover ? (
                    <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <Workflow className="h-7 w-7 text-primary/60" />
                  )}
                  {project && (
                    <span
                      className="absolute start-2 top-2 z-10 rounded-full px-2 py-0.5 font-micro text-[9px] font-medium text-white shadow"
                      style={{ backgroundColor: project.color }}
                    >
                      {project.name}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-1 px-3 py-2.5">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitRename(b.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(b.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="min-w-0 flex-1 rounded-md border border-primary/40 bg-background px-2 py-1 text-sm outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => navigate(`/boards/${b.id}`)}
                      className="min-w-0 flex-1 truncate text-start text-sm font-medium"
                    >
                      {b.name}
                    </button>
                  )}
                  <span className="shrink-0 font-micro text-[10px] text-muted-foreground/60">{count} {t("boards.nodes")}</span>

                  {!isEditing && (
                    <div className="flex shrink-0 items-center opacity-0 transition group-hover/board:opacity-100">
                      <button
                        onClick={() => {
                          setEditingId(b.id);
                          setDraft(b.name);
                        }}
                        className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title={t("boards.rename")}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeBoard(b.id)}
                        className={cn(
                          "grid h-6 w-6 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                        )}
                        title={t("boards.delete")}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </Column>
            );
          })}
        </Grid>
      )}
    </Page>
  );
}
