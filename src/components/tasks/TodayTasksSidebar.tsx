import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { useTasksStore, categorizeByDeadline } from "../../stores/tasksStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useUIStore } from "../../stores/uiStore";
import { TaskRow } from "./TaskRow";
import { AddTaskInput } from "./AddTaskInput";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { cn } from "../../lib/utils";

/**
 * Sticky right-side panel that mirrors the Tasks page "Today" column.
 * Replaces the dedicated /tasks page — meant to live next to the
 * Projects grid so today's work is always one glance away.
 */
export function TodayTasksSidebar() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const allTasks = useTasksStore((s) => s.tasks);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const tasks = useMemo(
    () =>
      allTasks.filter(
        (t) => (t.workspace_id ?? "personal") === activeWorkspaceId,
      ),
    [allTasks, activeWorkspaceId],
  );

  const grouped = useMemo(() => categorizeByDeadline(tasks), [tasks]);
  const todayTasks = grouped.today;
  const doneTasks  = grouped.done;

  const [openId, setOpenId] = useState<string | null>(null);
  const [doneCollapsed, setDoneCollapsed] = useState(true);

  // ── Resize handle (drag the left edge to grow/shrink) ──────
  const width = useUIStore((s) => s.todayPanelWidth);
  const setWidth = useUIStore((s) => s.setTodayPanelWidth);
  const draggingRef = useRef(false);
  const isRtl = i18n.language === "ar" || document.documentElement.dir === "rtl";

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      // Sidebar is on the right edge of the viewport (or left in LTR's perspective
      // — actually `start-side` in RTL means the right edge of the panel which
      // sits inside the viewport's right side). We compute width from the
      // viewport's right edge to the cursor.
      const next = isRtl ? e.clientX : window.innerWidth - e.clientX;
      setWidth(next);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setWidth, isRtl]);

  return (
    <aside
      className="sticky top-0 hidden h-[calc(100vh-44px)] shrink-0 flex-col border-s border-border bg-card lg:flex"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle — sits on the inner edge (start-side in RTL = right of panel) */}
      <button
        onMouseDown={onMouseDown}
        onDoubleClick={() => setWidth(320)}
        title={isRtl ? "اسحب لتغيير العرض · دبل كليك للإعادة" : "Drag to resize · double-click to reset"}
        className="group absolute start-0 top-0 z-20 h-full w-1.5 -translate-x-1/2 cursor-col-resize"
        aria-label="resize today panel"
      >
        <span className="block h-full w-px mx-auto bg-transparent transition group-hover:bg-primary/40 group-active:bg-primary" />
      </button>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <CalendarClock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">
              {isAr ? "مهام النهارده" : "Today's Tasks"}
            </h2>
            <p className="font-micro text-[10px] text-muted-foreground">
              {todayTasks.length > 0
                ? (isAr
                    ? `${todayTasks.length} ${todayTasks.length === 1 ? "مهمة" : "مهام"}`
                    : `${todayTasks.length} task${todayTasks.length !== 1 ? "s" : ""}`)
                : (isAr ? "كل الحاجات تمام" : "All caught up")}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 font-micro text-[11px] font-bold",
            todayTasks.length > 0
              ? "bg-primary text-white"
              : "bg-secondary text-muted-foreground",
          )}
        >
          {todayTasks.length}
        </span>
      </div>

      {/* Today list */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {todayTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8">
              <CheckCircle2 className="h-6 w-6 text-primary/50" />
            </div>
            <p className="font-micro text-xs text-muted-foreground/60">
              {isAr ? "مفيش مهام للنهارده" : "No tasks today"}
            </p>
            <p className="font-micro text-[10px] text-muted-foreground/40">
              {isAr ? "أضف واحدة من تحت" : "Add one below"}
            </p>
          </div>
        ) : (
          todayTasks.map((task) => (
            <TaskRow key={task.id} task={task} onOpen={setOpenId} />
          ))
        )}

        {/* Done collapsed section */}
        {doneTasks.length > 0 && (
          <section className="pt-3">
            <button
              onClick={() => setDoneCollapsed((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-start transition hover:bg-secondary"
              type="button"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-micro text-xs font-semibold">
                  {isAr ? "خلصت" : "Done"}
                </span>
                <span className="font-micro text-[10px] text-muted-foreground">
                  {doneTasks.length}
                </span>
              </div>
              {doneCollapsed ? (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
            {!doneCollapsed && (
              <div className="mt-2 space-y-2">
                {doneTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onOpen={setOpenId} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Quick-add */}
      <div className="border-t border-border px-3 py-3">
        <AddTaskInput defaultDeadline={todayIso()} />
      </div>

      <TaskDetailDrawer taskId={openId} onClose={() => setOpenId(null)} />
    </aside>
  );
}

function todayIso() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
