import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckSquare, FolderKanban, Search } from "lucide-react";
import { useTasksStore } from "../../stores/tasksStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { cn } from "../../lib/utils";

type Result =
  | { kind: "task"; id: string; title: string; sub: string; projectId: string | null; score: number }
  | { kind: "project"; id: string; title: string; sub: string; score: number };

// Lightweight "smart" relevance: token overlap + substring + prefix bonuses.
// (A true semantic/AI rank would call an LLM — see notes; this is local + instant.)
function score(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  const qTokens = q.split(/\s+/).filter(Boolean);
  const tTokens = new Set(t.split(/\s+/));
  let overlap = 0;
  for (const tok of qTokens) {
    if (tTokens.has(tok)) overlap += 12;
    else if (t.includes(tok)) overlap += 6;
  }
  return overlap;
}

export function GlobalSearch() {
  const { t: tr } = useTranslation();
  const navigate = useNavigate();
  const tasks = useTasksStore((s) => s.tasks);
  const projects = useTasksStore((s) => s.projects);
  const tags = useTasksStore((s) => s.tags);
  const activeWs = useWorkspaceStore((s) => s.activeWorkspaceId);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim();
    if (!q) return [];
    const tagName = (id: string) => tags.find((t) => t.id === id)?.name ?? "";
    const projName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "";

    const taskResults: Result[] = tasks
      .filter((t) => t.workspace_id === activeWs)
      .map((t) => {
        const hay = `${t.title} ${t.notes} ${(t.tag_ids ?? []).map(tagName).join(" ")}`;
        return {
          kind: "task" as const,
          id: t.id,
          title: t.title,
          sub: projName(t.project_id) || tr("search.noProject"),
          projectId: t.project_id,
          score: Math.max(score(q, t.title) + 5, score(q, hay)),
        };
      })
      .filter((r) => r.score > 0);

    const projResults: Result[] = projects
      .filter((p) => p.workspace_id === activeWs)
      .map((p) => ({
        kind: "project" as const,
        id: p.id,
        title: p.name,
        sub: tr("search.project"),
        score: score(q, p.name),
      }))
      .filter((r) => r.score > 0);

    return [...projResults, ...taskResults].sort((a, b) => b.score - a.score).slice(0, 12);
  }, [query, tasks, projects, tags, activeWs]);

  const choose = (r: Result) => {
    setOpen(false);
    if (r.kind === "project") navigate(`/projects/${r.id}`);
    else if (r.projectId) navigate(`/projects/${r.projectId}`);
    else navigate("/");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
              if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
              if (e.key === "Enter" && results[active]) choose(results[active]);
            }}
            placeholder={tr("search.placeholder")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          <kbd className="rounded border border-border/60 px-1.5 py-0.5 font-micro text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {query && results.length === 0 && (
            <p className="px-3 py-6 text-center font-micro text-xs text-muted-foreground/50">{tr("search.noResults")}</p>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.kind}-${r.id}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(r)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start transition",
                i === active ? "bg-primary/10" : "hover:bg-secondary"
              )}
            >
              {r.kind === "project" ? (
                <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
              <span className="shrink-0 font-micro text-[10px] text-muted-foreground/60">{r.sub}</span>
            </button>
          ))}
          {!query && (
            <p className="px-3 py-6 text-center font-micro text-xs text-muted-foreground/50">
              {tr("search.hint")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
