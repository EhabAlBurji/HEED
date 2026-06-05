import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckSquare, FileText, FolderKanban, MessageSquare, Search, Users } from "lucide-react";
import { useTasksStore } from "../../stores/tasksStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useHRStore } from "../../stores/hrStore";
import { fetchDmPartners, type DmPartner } from "../../lib/dmSync";
import { cn } from "../../lib/utils";

type Result =
  | { kind: "task"; id: string; title: string; sub: string; projectId: string | null; score: number }
  | { kind: "project"; id: string; title: string; sub: string; score: number }
  | { kind: "dm"; id: string; title: string; sub: string; score: number }
  | { kind: "hr-employee"; id: string; title: string; sub: string; score: number }
  | { kind: "hr-request"; id: string; title: string; sub: string; score: number };

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

const MAX_PER_SECTION = 3;

export function GlobalSearch() {
  const { t: tr } = useTranslation();
  const navigate = useNavigate();
  const tasks = useTasksStore((s) => s.tasks);
  const projects = useTasksStore((s) => s.projects);
  const tags = useTasksStore((s) => s.tags);
  const activeWs = useWorkspaceStore((s) => s.activeWorkspaceId);

  const hrEmployees = useHRStore((s) => s.employees);
  const hrRequests = useHRStore((s) => s.requests);
  const hrRequestTypes = useHRStore((s) => s.requestTypes);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [dmPartners, setDmPartners] = useState<DmPartner[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    // Lets the top-bar search box open this palette.
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("heed:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("heed:open-search", onOpen);
    };
  }, []);

  // Fetch DM partners once on mount.
  useEffect(() => {
    fetchDmPartners().then(setDmPartners).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Grouped results: projects + tasks (existing), then dm, hr-employee, hr-request.
  const { projResults, taskResults, dmResults, hrEmployeeResults, hrRequestResults } = useMemo(() => {
    const q = query.trim();
    if (!q) return { projResults: [], taskResults: [], dmResults: [], hrEmployeeResults: [], hrRequestResults: [] };

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

    const dmResults: Result[] = dmPartners
      .map((p) => ({
        kind: "dm" as const,
        id: p.id,
        title: p.name,
        sub: p.email,
        score: Math.max(score(q, p.name), score(q, p.email)),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PER_SECTION);

    const hrEmployeeResults: Result[] = hrEmployees
      .map((e) => {
        const hay = `${e.name} ${e.nameEn ?? ""} ${e.email ?? ""}`;
        return {
          kind: "hr-employee" as const,
          id: e.id,
          title: e.name,
          sub: e.email ?? e.nameEn ?? "",
          score: Math.max(score(q, e.name), score(q, hay)),
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PER_SECTION);

    const hrRequestResults: Result[] = hrRequests
      .map((r) => {
        const typeName = hrRequestTypes.find((rt) => rt.id === r.typeId)?.nameAr ?? "";
        return {
          kind: "hr-request" as const,
          id: r.id,
          title: typeName,
          sub: r.status,
          score: score(q, typeName),
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PER_SECTION);

    return { projResults, taskResults, dmResults, hrEmployeeResults, hrRequestResults };
  }, [query, tasks, projects, tags, activeWs, dmPartners, hrEmployees, hrRequests, hrRequestTypes, tr]);

  // Flat list for keyboard navigation, keeping section order.
  const results = useMemo<Result[]>(() => {
    const topTasksProjects = [...projResults, ...taskResults]
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return [...topTasksProjects, ...dmResults, ...hrEmployeeResults, ...hrRequestResults];
  }, [projResults, taskResults, dmResults, hrEmployeeResults, hrRequestResults]);

  const choose = (r: Result) => {
    setOpen(false);
    if (r.kind === "project") {
      navigate(`/projects/${r.id}`);
    } else if (r.kind === "task") {
      if (r.projectId) navigate(`/projects/${r.projectId}`);
      else navigate("/");
    } else if (r.kind === "dm") {
      navigate("/messages");
      window.dispatchEvent(new CustomEvent("heed:open-dm", { detail: { partnerId: r.id } }));
    } else if (r.kind === "hr-employee" || r.kind === "hr-request") {
      navigate("/hr");
    }
  };

  // Section divider logic: detect where a new group starts in the flat results list.
  const getSectionLabel = (r: Result, i: number): string | null => {
    const prev = i > 0 ? results[i - 1] : null;
    if (r.kind === "dm" && prev?.kind !== "dm") return tr("search.sectionDm");
    if (r.kind === "hr-employee" && prev?.kind !== "hr-employee") return tr("search.sectionEmployees");
    if (r.kind === "hr-request" && prev?.kind !== "hr-request") return tr("search.sectionRequests");
    return null;
  };

  const getKindBadge = (r: Result): string => {
    if (r.kind === "dm") return tr("search.kindDm");
    if (r.kind === "hr-employee") return tr("search.kindEmployee");
    if (r.kind === "hr-request") return tr("search.kindRequest");
    if (r.kind === "project") return tr("search.project");
    return tr("search.noProject");
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
          {results.map((r, i) => {
            const sectionLabel = getSectionLabel(r, i);
            return (
              <div key={`${r.kind}-${r.id}`}>
                {sectionLabel && (
                  <p className="px-3 pb-0.5 pt-2 font-micro text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    {sectionLabel}
                  </p>
                )}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start transition",
                    i === active ? "bg-primary/10" : "hover:bg-secondary"
                  )}
                >
                  {r.kind === "project" ? (
                    <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
                  ) : r.kind === "dm" ? (
                    <MessageSquare className="h-4 w-4 shrink-0 text-blue-500" />
                  ) : r.kind === "hr-employee" ? (
                    <Users className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : r.kind === "hr-request" ? (
                    <FileText className="h-4 w-4 shrink-0 text-orange-500" />
                  ) : (
                    <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                  <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-micro text-[10px] text-muted-foreground/70">
                    {getKindBadge(r)}
                  </span>
                </button>
              </div>
            );
          })}
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
