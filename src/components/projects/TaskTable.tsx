import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Paperclip, Plus } from "lucide-react";
import { useTasksStore, type Task } from "../../stores/tasksStore";
import { WORKFLOW_STATUSES, workflowStatusById } from "../../lib/taskMeta";
import { cn } from "../../lib/utils";

type Member = { id: string; name: string };

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOut]);
}

// Wrike-style table view of a project's tasks: Name · Assignee · Status ·
// Start date · Due date, with inline editing. Clicking a row opens the detail.
export function TaskTable({
  tasks,
  members,
  projectId,
  onOpen,
}: {
  tasks: Task[];
  members: Member[];
  projectId: string;
  onOpen: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const updateTask = useTasksStore((s) => s.updateTask);
  const addTask = useTasksStore((s) => s.addTask);
  const [newTitle, setNewTitle] = useState("");

  const create = () => {
    const title = newTitle.trim();
    if (!title) return;
    const tk = addTask({ title, project_id: projectId, column: "backlog" });
    setNewTitle("");
    onOpen(tk.id);
  };

  const th = "px-3 py-2 text-start font-medium";
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          <tr className="border-b border-border/60 text-xs text-muted-foreground">
            <th className={th}>{isAr ? "الاسم" : "Name"}</th>
            <th className={cn(th, "w-44")}>{isAr ? "المسؤول" : "Assignee"}</th>
            <th className={cn(th, "w-44")}>{isAr ? "الحالة" : "Status"}</th>
            <th className={cn(th, "w-32")}>{isAr ? "البداية" : "Start date"}</th>
            <th className={cn(th, "w-32")}>{isAr ? "التسليم" : "Due date"}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} members={members} onOpen={onOpen} updateTask={updateTask} isAr={isAr} />
          ))}
          <tr className="border-b border-border/40">
            <td colSpan={5} className="px-3 py-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") create();
                    if (e.key === "Escape") setNewTitle("");
                  }}
                  placeholder={isAr ? "أضف مهمة…" : "Add item…"}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                />
                {newTitle.trim() && (
                  <>
                    <button
                      onClick={create}
                      className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                    >
                      {isAr ? "إنشاء" : "Create"}
                    </button>
                    <button
                      onClick={() => setNewTitle("")}
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-secondary"
                    >
                      {isAr ? "إلغاء" : "Cancel"}
                    </button>
                  </>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TaskRow({
  task,
  members,
  onOpen,
  updateTask,
  isAr,
}: {
  task: Task;
  members: Member[];
  onOpen: (id: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  isAr: boolean;
}) {
  const today = new Date(new Date().toDateString());
  const overdue = Boolean(task.deadline && task.status !== "done" && new Date(task.deadline) < today);
  const assignee = members.find((m) => m.id === task.assignee_id);
  return (
    <tr className="group border-b border-border/40 transition hover:bg-secondary/40">
      <td className="px-3 py-2">
        <button onClick={() => onOpen(task.id)} className="flex w-full items-center gap-2 text-start">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <span className={cn("min-w-0 flex-1 truncate", task.status === "done" && "text-muted-foreground line-through")}>
            {task.title}
          </span>
          {(task.links?.length ?? 0) > 0 && <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
        </button>
      </td>
      <td className="px-3 py-1.5">
        <AssigneeCell members={members} assignee={assignee} onChange={(id) => updateTask(task.id, { assignee_id: id })} isAr={isAr} />
      </td>
      <td className="px-3 py-1.5">
        <StatusCell value={task.workflow_status} onChange={(id) => updateTask(task.id, { workflow_status: id })} />
      </td>
      <td className="px-3 py-1.5">
        <DateCell value={task.start_date ?? null} onChange={(v) => updateTask(task.id, { start_date: v })} isAr={isAr} />
      </td>
      <td className="px-3 py-1.5">
        <DateCell value={task.deadline} onChange={(v) => updateTask(task.id, { deadline: v })} isAr={isAr} overdue={overdue} />
      </td>
    </tr>
  );
}

function StatusCell({ value, onChange }: { value?: string | null; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const cur = workflowStatusById(value);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
        style={{ backgroundColor: `${cur.color}22`, color: cur.color }}
      >
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: cur.color }} />
        {cur.label}
      </button>
      {open && (
        <div className="absolute start-0 top-full z-30 mt-1 max-h-72 w-52 overflow-y-auto rounded-xl border border-border/60 bg-card p-1 shadow-2xl">
          {WORKFLOW_STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => { onChange(s.id); setOpen(false); }}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-secondary", s.id === cur.id && "bg-secondary")}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AssigneeCell({
  members,
  assignee,
  onChange,
  isAr,
}: {
  members: Member[];
  assignee?: Member;
  onChange: (id: string | null) => void;
  isAr: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5">
        {assignee ? (
          <>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              {assignee.name[0]?.toUpperCase()}
            </span>
            <span className="truncate text-xs">{assignee.name}</span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground/50">{isAr ? "فارغ" : "Empty"}</span>
        )}
      </button>
      {open && (
        <div className="absolute start-0 top-full z-30 mt-1 max-h-56 w-48 overflow-y-auto rounded-xl border border-border/60 bg-card p-1 shadow-2xl">
          <button onClick={() => { onChange(null); setOpen(false); }} className="w-full rounded-md px-2 py-1.5 text-start text-sm text-muted-foreground hover:bg-secondary">
            {isAr ? "فارغ" : "Empty"}
          </button>
          {members.map((m) => (
            <button key={m.id} onClick={() => { onChange(m.id); setOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-secondary">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{m.name[0]?.toUpperCase()}</span>
              {m.name}
            </button>
          ))}
          {members.length === 0 && (
            <p className="px-2 py-2 font-micro text-[11px] text-muted-foreground/50">{isAr ? "لا أعضاء" : "No members"}</p>
          )}
        </div>
      )}
    </div>
  );
}

function DateCell({
  value,
  onChange,
  isAr,
  overdue,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  isAr: boolean;
  overdue?: boolean;
}) {
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "w-full cursor-pointer rounded-md bg-transparent px-1 py-0.5 text-xs outline-none [color-scheme:dark] hover:bg-secondary/60",
        value ? (overdue ? "text-red-400" : "text-foreground") : "text-muted-foreground/40"
      )}
      title={isAr ? "غيّر التاريخ" : "Change date"}
    />
  );
}
