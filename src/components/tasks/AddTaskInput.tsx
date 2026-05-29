import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { FolderKanban, Plus } from "lucide-react";
import { useTasksStore } from "../../stores/tasksStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { cn } from "../../lib/utils";
import { quickTaskDates } from "../../lib/taskDateShortcuts";

export function AddTaskInput({ defaultDeadline = null }: { defaultDeadline?: string | null }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [value, setValue] = useState("");
  const [deadline, setDeadline] = useState<string | null>(defaultDeadline);
  // undefined = not chosen yet; null = "no project"; string = project id
  const [projectId, setProjectId] = useState<string | null | undefined>(undefined);
  const addTask = useTasksStore((s) => s.addTask);
  const projects = useTasksStore((s) => s.projects);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const visibleProjects = projects.filter(
    (p) =>
      p.workspace_id === activeWorkspaceId ||
      (p.shared_workspace_ids ?? []).includes(activeWorkspaceId)
  );

  const hasTitle = value.trim().length > 0;
  const canSubmit = hasTitle && projectId !== undefined;

  const submit = () => {
    if (!canSubmit) return;
    addTask({
      title: value.trim(),
      deadline,
      workspace_id: activeWorkspaceId,
      project_id: projectId ?? null,
    });
    setValue("");
    setDeadline(defaultDeadline);
    setProjectId(undefined);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/40 transition-all focus-within:border-primary/50",
        hasTitle && "border-primary/30"
      )}
    >
      {/* Title row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={t("tasks.newTask") + (isAr ? " — اضغط Enter للحفظ" : " — press Enter to save")}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Project picker — shown only while typing */}
      {hasTitle && (
        <div className="space-y-2 border-t border-border/40 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-micro text-[11px] text-muted-foreground/60">
              {isAr ? "الديدلاين:" : "Deadline:"}
            </span>
            {quickTaskDates().map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDeadline(option.value)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 font-micro text-[10px] transition",
                  deadline === option.value
                    ? "border-primary/45 bg-primary/15 text-primary"
                    : "border-border/40 bg-background/40 text-muted-foreground hover:border-primary/35"
                )}
              >
                {isAr ? option.labelAr : option.labelEn}
              </button>
            ))}
            {deadline && (
              <button
                type="button"
                onClick={() => setDeadline(null)}
                className="rounded-full border border-border/30 bg-secondary/30 px-2.5 py-0.5 font-micro text-[10px] text-muted-foreground hover:bg-secondary/60"
              >
                {isAr ? "بدون تاريخ" : "No date"}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 shrink-0">
              <FolderKanban className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="font-micro text-[11px] text-muted-foreground/60">
                {isAr ? "المشروع:" : "Project:"}
              </span>
            </div>

            <div className="flex flex-1 flex-wrap gap-1.5">
              <button
                onClick={() => setProjectId(null)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 font-micro text-[10px] transition",
                  projectId === null
                    ? "border-border/60 bg-secondary/60 text-foreground"
                    : "border-border/40 bg-background/40 text-muted-foreground hover:border-border/60"
                )}
              >
                {isAr ? "بدون مشروع" : "No project"}
              </button>

              {visibleProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => setProjectId(p.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-micro text-[10px] transition",
                  projectId === p.id ? "opacity-100" : "opacity-60 hover:opacity-90"
                )}
                style={
                  projectId === p.id
                    ? { borderColor: p.color, backgroundColor: `${p.color}25`, color: p.color }
                    : { borderColor: `${p.color}40`, backgroundColor: `${p.color}10`, color: p.color }
                }
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </button>
              ))}
            </div>

            {canSubmit && (
              <button
                onClick={submit}
                className="shrink-0 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                {t("common.add")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
