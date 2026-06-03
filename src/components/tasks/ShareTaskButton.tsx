import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Link2, Share2, UserPlus, Users } from "lucide-react";
import { useTasksStore, type Task } from "../../stores/tasksStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { cn } from "../../lib/utils";

// Share affordance for a task: copy a deep link, assign a teammate, or share the
// task's whole project into a team workspace.
export function ShareTaskButton({ task }: { task: Task }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const projects = useTasksStore((s) => s.projects);
  const updateTask = useTasksStore((s) => s.updateTask);
  const shareProjectTo = useTasksStore((s) => s.shareProjectTo);
  const unshareProjectFrom = useTasksStore((s) => s.unshareProjectFrom);
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  const project = projects.find((p) => p.id === task.project_id);
  const members = workspaces.find((w) => w.id === task.workspace_id)?.members ?? [];
  const teamWorkspaces = workspaces.filter((w) => w.type === "team" && w.id !== task.workspace_id);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}#/projects/${task.project_id ?? ""}?task=${task.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <Share2 className="h-3.5 w-3.5" />
        {isAr ? "مشاركة" : "Share"}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-40 mt-1 w-64 rounded-xl border border-border/60 bg-card p-2 shadow-2xl">
          {/* Copy link */}
          <button
            onClick={copyLink}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-secondary"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Link2 className="h-4 w-4 text-primary" />}
            {copied ? (isAr ? "اتنسخ ✓" : "Copied ✓") : isAr ? "نسخ رابط المهمة" : "Copy task link"}
          </button>

          {/* Assign */}
          <div className="mt-1 border-t border-border/40 pt-1">
            <p className="px-2 py-1 font-micro text-[10px] uppercase tracking-wider text-muted-foreground/60">
              <UserPlus className="me-1 inline h-3 w-3" />
              {isAr ? "تعيين لـ" : "Assign to"}
            </p>
            <div className="max-h-32 overflow-y-auto">
              <button
                onClick={() => updateTask(task.id, { assignee_id: null })}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-secondary", !task.assignee_id && "bg-secondary")}
              >
                {isAr ? "بدون" : "Unassigned"}
              </button>
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => updateTask(task.id, { assignee_id: m.id })}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-secondary", task.assignee_id === m.id && "bg-secondary")}
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    {m.name[0]?.toUpperCase()}
                  </span>
                  {m.name}
                </button>
              ))}
              {members.length === 0 && (
                <p className="px-2 py-1.5 font-micro text-[11px] text-muted-foreground/50">{isAr ? "لا أعضاء بعد" : "No members yet"}</p>
              )}
            </div>
          </div>

          {/* Share whole project into a team workspace */}
          {project && teamWorkspaces.length > 0 && (
            <div className="mt-1 border-t border-border/40 pt-1">
              <p className="px-2 py-1 font-micro text-[10px] uppercase tracking-wider text-muted-foreground/60">
                <Users className="me-1 inline h-3 w-3" />
                {isAr ? "شارك المشروع مع" : "Share project with"}
              </p>
              {teamWorkspaces.map((ws) => {
                const shared = project.shared_workspace_ids?.includes(ws.id);
                return (
                  <button
                    key={ws.id}
                    onClick={() => (shared ? unshareProjectFrom(project.id, ws.id) : shareProjectTo(project.id, ws.id))}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-secondary"
                  >
                    <span className="h-4 w-4 shrink-0 rounded" style={{ backgroundColor: ws.color }} />
                    <span className="min-w-0 flex-1 truncate">{ws.name}</span>
                    {shared && <Check className="h-4 w-4 shrink-0 text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
