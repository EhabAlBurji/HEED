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

// Normalize for matching: lowercase, strip Arabic diacritics & tatweel, and
// unify alef/hamza/yaa/taa-marbuta variants so search is forgiving of how
// Arabic is actually typed (e.g. "علي" ≈ "على", "مشروع" with/without harakat).
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "") // harakat + tatweel
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

// Order-preserving subsequence match (typo/gap tolerant): do all chars of q
// appear in t in order? Rewards longer contiguous runs. Returns 0 or 12..40.
function subseqScore(q: string, t: string): number {
  if (!q) return 0;
  let qi = 0, run = 0, best = 0, hits = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { qi++; hits++; run++; if (run > best) best = run; }
    else run = 0;
  }
  if (qi < q.length) return 0; // not all query chars matched in order
  return Math.min(40, 12 + hits * 1.5 + best * 2);
}

// Lightweight "smart" relevance: exact/prefix/substring + token overlap, with a
// normalized + fuzzy-subsequence fallback so near-misses and typos still rank.
function score(query: string, text: string): number {
  const q = norm(query);
  const t = norm(text);
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 85;
  if (t.includes(q)) return 65;
  const qTokens = q.split(" ").filter(Boolean);
  const tTokens = new Set(t.split(" "));
  let overlap = 0;
  for (const tok of qTokens) {
    if (tTokens.has(tok)) overlap += 14;
    else if (t.includes(tok)) overlap += 7;
    else overlap += subseqScore(tok, t) * 0.4;
  }
  // Whole-query subsequence fallback (scattered letters / typos).
  return Math.max(overlap, subseqScore(q.replace(/ /g, ""), t.replace(/ /g, "")));
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
