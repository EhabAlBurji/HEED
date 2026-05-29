import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FolderOpen, Plus, Share2, Check, Users, Link2,
  Trash2, X, MoreHorizontal, Camera, GripVertical, ArrowUpRight,
} from "lucide-react";
import { useTasksStore, type Project, type Task } from "../stores/tasksStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useAuthStore } from "../stores/authStore";
import { cn } from "../lib/utils";
import { Avatar, AvatarPickerModal } from "../components/Avatar";
import { isAvatarValue } from "../lib/avatars";
import { TodayTasksSidebar } from "../components/tasks/TodayTasksSidebar";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PROJECT_COLORS = [
  "#A78BFA", "#F472B6", "#34D399", "#60A5FA",
  "#FBBF24", "#F87171", "#38BDF8", "#FB923C",
  "#EF4444", "#10B981", "#6366F1", "#EC4899",
];

function fmtMins(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}


// ── Edit project modal ────────────────────────────────────────────────────────
export function EditProjectModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const updateProject = useTasksStore((s) => s.updateProject);
  const deleteProject = useTasksStore((s) => s.deleteProject);
  const navigate      = useNavigate();

  const [name,    setName]    = useState(project.name);
  const [color,   setColor]   = useState(project.color);
  const [type,    setType]    = useState(project.type);
  const [iconUrl, setIconUrl] = useState<string | null>(project.iconUrl ?? null);
  const [confirm, setConfirm] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef               = useRef<HTMLInputElement>(null);

  const typeLabel = (tp: "general" | "video" | "design") => {
    if (tp === "video")  return isAr ? "فيديو"  : t("projects.video");
    if (tp === "design") return isAr ? "تصميم" : t("projects.design");
    return isAr ? "عام" : t("projects.general");
  };

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setIconUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleSave() {
    if (!name.trim()) return;
    updateProject(project.id, {
      name: name.trim(),
      color,
      type,
      icon: Array.from(name.trim())[0].toUpperCase(),
      iconUrl,
    });
    onClose();
  }

  function handleDelete() {
    deleteProject(project.id);
    navigate("/projects");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <AvatarPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(v) => setIconUrl(v)}
        currentValue={iconUrl}
        variant="projects"
        title={isAr ? "اختر أيقونة المشروع" : "Choose project icon"}
      />
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-3xl border border-border/60 bg-card shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Clickable icon — opens avatar picker */}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="relative group/icon"
              title={isAr ? "اختر أيقونة" : "Choose icon"}
            >
              {isAvatarValue(iconUrl) ? (
                <Avatar value={iconUrl} size="md" shape="square" />
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl font-display text-lg font-bold text-white"
                  style={{ backgroundColor: iconUrl ? undefined : color }}
                >
                  {iconUrl ? (
                    <img src={iconUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    Array.from(name.trim() || project.name)[0]?.toUpperCase() ?? "?"
                  )}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition group-hover/icon:opacity-100">
                <Camera className="h-3.5 w-3.5 text-white" />
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

            <div>
              <h2 className="font-display text-base font-semibold">
                {isAr ? "إعدادات المشروع" : "Project Settings"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => setPickerOpen(true)}
                  className="font-micro text-[10px] text-primary/80 hover:text-primary transition-colors"
                >
                  {isAr ? "تغيير الأيقونة" : "Change icon"}
                </button>
                <span className="text-[10px] text-muted-foreground/40">·</span>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="font-micro text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isAr ? "رفع صورة" : "Upload"}
                </button>
                {iconUrl && (
                  <>
                    <span className="text-[10px] text-muted-foreground/40">·</span>
                    <button
                      onClick={() => setIconUrl(null)}
                      className="font-micro text-[10px] text-destructive/60 hover:text-destructive transition-colors"
                    >
                      {isAr ? "إزالة" : "Remove"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground/60 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="mb-1.5 block font-micro text-xs text-muted-foreground">
            {isAr ? "الاسم" : t("projects.name")}
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
        </div>

        {/* Color */}
        <div>
          <label className="mb-1.5 block font-micro text-xs text-muted-foreground">
            {isAr ? "اللون" : t("projects.color")}
          </label>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "h-6 w-6 rounded-full transition-all",
                  color === c && "ring-2 ring-white/60 ring-offset-1 ring-offset-background scale-110"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Type */}
        <div>
          <label className="mb-1.5 block font-micro text-xs text-muted-foreground">
            {isAr ? "النوع" : t("projects.type")}
          </label>
          <div className="flex gap-2">
            {(["general", "video", "design"] as const).map((tp) => (
              <button
                key={tp}
                onClick={() => setType(tp)}
                className={cn(
                  "flex-1 rounded-full border py-1.5 font-micro text-xs transition",
                  type === tp
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground hover:border-primary/30"
                )}
              >
                {typeLabel(tp)}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition disabled:opacity-40"
          >
            {isAr ? "حفظ" : t("common.save")}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-secondary px-4 py-2.5 text-sm text-secondary-foreground hover:bg-secondary/80 transition"
          >
            {isAr ? "إلغاء" : t("common.cancel")}
          </button>
        </div>

        {/* Delete zone */}
        <div className="border-t border-border/30 pt-3">
          {confirm ? (
            <div className="space-y-2">
              <p className="text-xs text-destructive/80">
                {isAr ? "هيتحذف المشروع وكل مهامه — متوقفش؟" : "Delete project and all its tasks? Can't undo!"}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="flex-1 rounded-xl bg-destructive/15 py-2 text-xs text-destructive hover:bg-destructive/25 transition"
                >
                  {isAr ? "نعم، احذف" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  className="rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
                >
                  {isAr ? "لا" : "No"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 py-2 text-xs text-destructive/70 hover:border-destructive/40 hover:text-destructive transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isAr ? "حذف المشروع" : "Delete project"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Share/sync project popover ────────────────────────────────────────────────
function ShareProjectButton({ project }: { project: Project }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { workspaces } = useWorkspaceStore();
  const shareProjectTo     = useTasksStore((s) => s.shareProjectTo);
  const unshareProjectFrom = useTasksStore((s) => s.unshareProjectFrom);

  const otherWorkspaces = workspaces.filter((w) => w.id !== project.workspace_id);
  const sharedIds = project.shared_workspace_ids ?? [];
  const isSharedAnywhere = sharedIds.length > 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggleShare(wsId: string) {
    if (sharedIds.includes(wsId)) {
      unshareProjectFrom(project.id, wsId);
    } else {
      shareProjectTo(project.id, wsId);
    }
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
          isSharedAnywhere
            ? "bg-primary/15 text-primary opacity-100"
            : "bg-transparent text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary/10"
        )}
        title={isAr ? "مشاركة المشروع" : t("tasks.shareProject")}
      >
        {isSharedAnywhere
          ? <Link2 className="h-3.5 w-3.5" />
          : <Share2 className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div
          className="absolute top-full mt-1.5 z-50 w-64 rounded-2xl border border-border/60 bg-card shadow-2xl p-3 space-y-2"
          style={{ insetInlineEnd: 0, backdropFilter: "blur(16px)" }}
        >
          <div className="flex items-center gap-2 pb-1 border-b border-border/30">
            <Link2 className="h-3.5 w-3.5 text-primary/70" />
            <p className="font-micro text-xs font-medium text-muted-foreground">
              {isAr ? "مشاركة ومزامنة المشروع" : "Share & Sync project"}
            </p>
          </div>

          <p className="font-micro text-[10px] text-muted-foreground/60 leading-relaxed">
            {isAr
              ? "المشروع يفضل في مكانه ويتشاف في المساحة التانية — أي تعديل يتزامن تلقائياً"
              : "Project stays here and appears in the other workspace — edits sync automatically"}
          </p>

          {otherWorkspaces.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground/50">
              {isAr ? "مفيش مساحات عمل أخرى" : "No other workspaces"}
            </p>
          ) : (
            <div className="space-y-1">
              {otherWorkspaces.map((ws) => {
                const isShared = sharedIds.includes(ws.id);
                return (
                  <button
                    key={ws.id}
                    onClick={() => toggleShare(ws.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-start text-sm transition",
                      isShared ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-white/5"
                    )}
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                      style={{ backgroundColor: ws.color }}
                    >
                      {ws.type === "team" ? <Users className="h-3 w-3" /> : ws.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm">{ws.name}</p>
                      <p className="font-micro text-[10px] text-muted-foreground/50">
                        {ws.type === "team" ? (isAr ? "فريق" : "Team") : (isAr ? "شخصي" : "Personal")}
                      </p>
                    </div>
                    {isShared ? (
                      <div className="flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5">
                        <Check className="h-3 w-3 text-primary" />
                        <span className="font-micro text-[10px] text-primary">
                          {isAr ? "مشترك" : "Shared"}
                        </span>
                      </div>
                    ) : (
                      <span className="font-micro text-[10px] text-muted-foreground/40">
                        {isAr ? "اضغط للمشاركة" : "tap to share"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {isSharedAnywhere && (
            <p className="border-t border-border/30 pt-2 font-micro text-[10px] text-muted-foreground/50">
              {isAr ? "اضغط مرة ثانية على المساحة لإلغاء المشاركة" : "Tap again to unshare from a workspace"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Projects() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const allProjects = useTasksStore((s) => s.projects);
  const allTasks    = useTasksStore((s) => s.tasks);
  const addProject  = useTasksStore((s) => s.addProject);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const navigate = useNavigate();

  const projects = useMemo(
    () => allProjects.filter((p) =>
      (p.workspace_id ?? "personal") === activeWorkspaceId ||
      (p.shared_workspace_ids ?? []).includes(activeWorkspaceId)
    ),
    [allProjects, activeWorkspaceId]
  );

  const tasks = useMemo(
    () => allTasks.filter((task) =>
      (task.workspace_id ?? "personal") === activeWorkspaceId ||
      projects.some((p) => p.id === task.project_id)
    ),
    [allTasks, activeWorkspaceId, projects]
  );

  const [creating,    setCreating]    = useState(false);
  const [newName,     setNewName]     = useState("");
  const [newColor,    setNewColor]    = useState(PROJECT_COLORS[0]);
  const [newType,     setNewType]     = useState<"general" | "video" | "design">("general");
  const [newIconUrl,  setNewIconUrl]  = useState<string | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const newFileRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const p = addProject({
      name,
      color: newColor,
      icon: Array.from(name)[0].toUpperCase(),
      iconUrl: newIconUrl,
      type: newType,
      workspace_id: activeWorkspaceId,
    });
    setCreating(false);
    setNewName("");
    setNewIconUrl(null);
    navigate(`/projects/${p.id}`);
  };

  function handleNewImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewIconUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  const typeLabel = (type: "general" | "video" | "design") => {
    if (type === "video")  return isAr ? "فيديو"  : t("projects.video");
    if (type === "design") return isAr ? "تصميم" : t("projects.design");
    return isAr ? "عام" : t("projects.general");
  };

  return (
    <div className="flex items-start">
    <div className="min-w-0 flex-1 px-8 py-8 space-y-6">
      {/* Greeting header */}
      <ProjectsGreeting isAr={isAr} />

      {/* Section label row */}
      <div className="flex items-end justify-between pb-1">
        <h2 className="font-display text-xl font-bold tracking-tight">
          {isAr ? "قوائمك" : "Your Lists"}
        </h2>
        <p className="font-micro text-xs text-muted-foreground">
          {isAr ? "قوائم بمهامك القادمة" : "Lists with your upcoming tasks"}
        </p>
      </div>

      {/* Create form */}
      {creating && (
        <div className="rounded-2xl border border-primary/30 bg-card/60 p-5 space-y-4">
          <h2 className="font-medium">{isAr ? "إنشاء مشروع جديد" : t("projects.new")}</h2>

          {/* Icon preview + upload */}
          <div className="flex items-center gap-3">
            <div
              className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl group/newicon"
              style={{ backgroundColor: newIconUrl ? undefined : newColor }}
              onClick={() => newFileRef.current?.click()}
            >
              {newIconUrl ? (
                <img src={newIconUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-display text-xl font-bold text-white">
                  {newName.trim() ? Array.from(newName.trim())[0].toUpperCase() : "+"}
                </span>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover/newicon:opacity-100">
                <Camera className="h-4 w-4 text-white" />
              </div>
            </div>
            <input ref={newFileRef} type="file" accept="image/*" className="hidden" onChange={handleNewImageUpload} />
            <div className="flex-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder={isAr ? "اسم المشروع..." : t("projects.name") + "..."}
                className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
              {newIconUrl && (
                <button
                  onClick={() => setNewIconUrl(null)}
                  className="mt-1 font-micro text-[10px] text-destructive/60 hover:text-destructive transition-colors"
                >
                  {isAr ? "إزالة الصورة" : "Remove image"}
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 font-micro text-[11px] uppercase tracking-widest text-muted-foreground">
              {isAr ? "اللون" : t("projects.color")}
            </p>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full transition-all",
                    newColor === c && "ring-2 ring-white/60 ring-offset-2 ring-offset-background scale-110"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-micro text-[11px] uppercase tracking-widest text-muted-foreground">
              {isAr ? "النوع" : t("projects.type")}
            </p>
            <div className="flex gap-2">
              {(["general", "video", "design"] as const).map((tp) => (
                <button
                  key={tp}
                  onClick={() => setNewType(tp)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-micro text-xs transition",
                    newType === tp
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border/60 text-muted-foreground hover:border-primary/30"
                  )}
                >
                  {typeLabel(tp)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              {isAr ? "إنشاء" : t("projects.create")}
            </button>
            <button
              onClick={() => { setCreating(false); setNewName(""); setNewIconUrl(null); }}
              className="rounded-lg bg-secondary px-4 py-2 text-sm text-secondary-foreground transition hover:bg-secondary/80"
            >
              {isAr ? "إلغاء" : t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Projects grid */}
      {projects.length === 0 && !creating ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <FolderOpen className="h-14 w-14 opacity-20" />
          <p className="text-sm">{isAr ? "مفيش مشاريع لسه — ابدأ بإنشاء الأول" : t("projects.empty")}</p>
        </div>
      ) : (
        <ProjectsGrid
          projects={projects}
          tasks={tasks}
          activeWorkspaceId={activeWorkspaceId}
          onOpen={(id) => navigate(`/projects/${id}`)}
          onEdit={setEditProject}
          onCreate={() => setCreating(true)}
          isAr={isAr}
        />
      )}

      {/* Edit project modal */}
      {editProject && (
        <EditProjectModal
          project={editProject}
          onClose={() => setEditProject(null)}
        />
      )}
    </div>
    <TodayTasksSidebar />
    </div>
  );
}

// ── Sortable grid ─────────────────────────────────────────────────────────────
function ProjectsGrid({
  projects,
  tasks,
  activeWorkspaceId,
  onOpen,
  onEdit,
  onCreate,
  isAr,
}: {
  projects: Project[];
  tasks: Task[];
  activeWorkspaceId: string;
  onOpen: (id: string) => void;
  onEdit: (p: Project) => void;
  onCreate: () => void;
  isAr: boolean;
}) {
  const reorderProjects = useTasksStore((s) => s.reorderProjects);
  const allProjects = useTasksStore((s) => s.projects);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = projects.map((p) => p.id);
    const from = ids.indexOf(String(active.id));
    const to   = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const newVisibleOrder = arrayMove(ids, from, to);
    // Build a full ordering: visible projects in new order, then any others (other workspaces)
    const visibleSet = new Set(ids);
    const restIds = allProjects.filter((p) => !visibleSet.has(p.id)).map((p) => p.id);
    reorderProjects([...newVisibleOrder, ...restIds]);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={projects.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 auto-rows-fr">
          {projects.map((project) => (
            <SortableProjectCard
              key={project.id}
              project={project}
              tasks={tasks}
              activeWorkspaceId={activeWorkspaceId}
              onOpen={onOpen}
              onEdit={onEdit}
              isAr={isAr}
            />
          ))}
          {/* + CREATE LIST dashed card */}
          <button
            onClick={onCreate}
            className="group/create flex aspect-[5/4] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/70 bg-transparent text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full border border-current">
              <Plus className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-xs font-bold tracking-widest uppercase">
              {isAr ? "إنشاء قائمة" : "Create List"}
            </span>
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableProjectCard({
  project,
  tasks,
  activeWorkspaceId,
  onOpen,
  onEdit,
  isAr,
}: {
  project: Project;
  tasks: Task[];
  activeWorkspaceId: string;
  onOpen: (id: string) => void;
  onEdit: (p: Project) => void;
  isAr: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const projectTasks = tasks.filter((t) => t.project_id === project.id);
  const pendingTasks = projectTasks.filter((t) => t.status !== "done" && t.column !== "done");
  const isSharedHere = project.workspace_id !== activeWorkspaceId;
  const isEmpty      = pendingTasks.length === 0;

  // Show up to 5 task rows
  const visible = pendingTasks.slice(0, 5);

  const firstChar = (project.name || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/proj relative flex aspect-[5/4] flex-col overflow-hidden rounded-2xl bg-card border border-border shadow-[0_1px_2px_rgba(23,41,53,0.04)] transition hover:border-primary/30 hover:shadow-[0_8px_24px_rgba(23,41,53,0.08)] cursor-pointer",
        isDragging && "ring-2 ring-primary/50 shadow-2xl z-10",
      )}
      onClick={() => onOpen(project.id)}
    >
      {/* Drag handle — start corner, hover-visible */}
      <button
        {...attributes}
        {...listeners}
        className="absolute start-2 top-2 z-10 grid h-5 w-5 cursor-grab place-items-center rounded-md text-muted-foreground/30 opacity-0 transition group-hover/proj:opacity-100 hover:text-foreground active:cursor-grabbing"
        title={isAr ? "اسحب لإعادة الترتيب" : "Drag to reorder"}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3 w-3" />
      </button>

      {/* ── Header ────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 ps-6">
        <LetterBadge letter={firstChar} color={project.color} iconUrl={project.iconUrl} />
        <h3 className="min-w-0 flex-1 truncate font-display text-xs font-bold tracking-wide uppercase">
          {project.name}
        </h3>
        <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {!isSharedHere && <ShareProjectButton project={project} />}
          {isSharedHere ? (
            <span className="flex items-center gap-0.5 rounded-full bg-primary/12 px-1.5 py-0.5 font-micro text-[9px] text-primary">
              <Link2 className="h-2.5 w-2.5" />
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(project); }}
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground/40 opacity-0 transition group-hover/proj:opacity-100 hover:text-foreground"
              title={isAr ? "إعدادات المشروع" : "Project settings"}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Body: task list OR all-clear ──────────────── */}
      <div className="min-h-0 flex-1 px-2 pb-2">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <div className="grid h-7 w-7 place-items-center rounded-full border border-emerald-500/25 bg-emerald-500/10">
              <Check className="h-3 w-3 text-emerald-500" strokeWidth={3} />
            </div>
            <p className="font-micro text-[9px] font-semibold uppercase tracking-widest text-emerald-500/80">
              {isAr ? "كله تمام" : "All Clear"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {visible.map((task, i) => (
              <div
                key={task.id}
                className="flex items-center gap-1.5 rounded-md border border-border/40 bg-background/40 px-2 py-1"
              >
                <span className="w-3 shrink-0 text-end font-micro text-[9px] text-muted-foreground/60 tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/85">
                  {task.title}
                </span>
                <span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground/60">
                  {fmtMins(task.actual_minutes)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────── */}
      <div className="border-t border-border/50 px-3 py-1.5">
        <p className="font-micro text-[10px] font-semibold text-muted-foreground">
          {pendingTasks.length === 0
            ? (isAr ? "٠ مهمة معلقة" : "0 pending tasks")
            : (isAr
                ? `${pendingTasks.length} مهمة معلقة`
                : `${pendingTasks.length} pending tasks`)}
        </p>
      </div>

      {/* ── Hover "Open" floating pill ────────────────── */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover/proj:opacity-100">
        <span className="rounded-full bg-gradient-to-l from-emerald-400 to-teal-500 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(16,185,129,0.4)] flex items-center gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5" />
          {isAr ? "فتح" : "Open"}
        </span>
      </div>
    </div>
  );
}

// ── Letter badge used in the project card header ─────────────────────────────
function LetterBadge({
  letter,
  color,
  iconUrl,
}: {
  letter: string;
  color: string;
  iconUrl?: string | null;
}) {
  if (isAvatarValue(iconUrl)) {
    return <Avatar value={iconUrl} size="sm" shape="square" />;
  }
  if (iconUrl) {
    return (
      <div className="h-6 w-6 shrink-0 overflow-hidden rounded-md">
        <img src={iconUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md font-display text-[11px] font-bold text-white"
      style={{ background: color }}
    >
      {letter}
    </div>
  );
}

// ── Greeting header at the top of Projects page ─────────────────────────────
function ProjectsGreeting({ isAr }: { isAr: boolean }) {
  const user = useAuthStore((s) => s.user);
  const name = user?.name?.split(" ")[0]
    ?? (user?.id === "guest" ? null : user?.email?.split("@")[0])
    ?? null;

  const hour = new Date().getHours();
  const part =
    hour < 12 ? (isAr ? "صباح الخير" : "Good Morning") :
    hour < 17 ? (isAr ? "مساء الخير" : "Good Afternoon") :
                (isAr ? "مساء النور" : "Good Evening");
  const subtitle =
    hour < 12 ? (isAr ? "جاهز للصباح؟"   : "Ready to start your morning?") :
    hour < 17 ? (isAr ? "جاهز لنصف اليوم؟" : "Ready to blitz through your afternoon?") :
                (isAr ? "أنهِ يومك بتركيز"  : "Wrap up your day with focus");

  return (
    <header>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {part}{name ? `، ${name}` : ""}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </header>
  );
}
