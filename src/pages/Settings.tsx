import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle, Camera, Download, Eye, EyeOff, LogOut, Pencil, Plus, RefreshCw,
  Trash2, Unlink, X, Check, Save, ChevronDown, Sparkles, CheckCircle2,
} from "lucide-react";
import { getNotifPrefs, setNotifPrefs, type NotifPrefs } from "../lib/notifPrefs";
import { toast } from "sonner";
import { useGoogleCalendarStore } from "../stores/googleCalendarStore";
import { useMeetingsStore } from "../stores/meetingsStore";
import {
  startOAuthFlow,
  listenForOAuthCode,
  cancelOAuthListen,
  syncGoogleCalendar,
} from "../lib/googleCalendarSync";
import {
  useTasksStore,
  type Category,
  type Tag,
} from "../stores/tasksStore";
import { useAuthStore } from "../stores/authStore";
import { cn } from "../lib/utils";
import { Avatar, AvatarPickerModal } from "../components/Avatar";
import { resetAllStores } from "../lib/resetStores";
import { downloadBackup } from "../lib/backup";

// ── Color palette swatches ─────────────────────────────────────────────────
const COLOR_SWATCHES = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4",
  "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7",
  "#EC4899", "#F43F5E", "#78716C", "#94A3B8",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "h-5 w-5 rounded-full transition-transform hover:scale-110",
            value === c && "ring-2 ring-offset-2 ring-offset-background ring-white scale-110"
          )}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

// ── Collapsible section wrapper ────────────────────────────────────────────
function CollapsibleSection({
  title,
  subtitle,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-start hover:bg-white/3 transition-colors"
      >
        {icon && <span className="shrink-0 text-xl">{icon}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium">{title}</p>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {badge}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border/40 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </section>
  );
}

// ── Category management ──────────────────────────────────────────────────────
function CategorySection() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const categories = useTasksStore((s) => s.categories);
  const addCategory = useTasksStore((s) => s.addCategory);
  const updateCategory = useTasksStore((s) => s.updateCategory);
  const deleteCategory = useTasksStore((s) => s.deleteCategory);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#A78BFA");
  const [editType, setEditType] = useState<Category["type"]>("general");
  const [editDesc, setEditDesc] = useState("");

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#A78BFA");
  const [newType, setNewType] = useState<Category["type"]>("general");
  const [newDesc, setNewDesc] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  function startEdit(cat: Category) {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
    setEditType(cat.type);
    setEditDesc(cat.description ?? "");
  }

  function saveEdit() {
    if (!editId || !editName.trim()) return;
    updateCategory(editId, {
      name: editName.trim(),
      color: editColor,
      type: editType,
      description: editDesc.trim() || undefined,
    });
    setEditId(null);
  }

  function handleAdd() {
    if (!newName.trim()) return;
    addCategory({
      name: newName.trim(),
      color: newColor,
      type: newType,
      description: newDesc.trim() || undefined,
    });
    setNewName("");
    setNewColor("#A78BFA");
    setNewType("general");
    setNewDesc("");
    setShowAddForm(false);
  }

  const typeLabels: Record<Category["type"], string> = {
    general: isAr ? "عام" : t("settings.generalType"),
    video: isAr ? "فيديو" : t("projects.video"),
    design: isAr ? "تصميم" : t("projects.design"),
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-1.5 text-sm text-primary hover:bg-primary/25 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {isAr ? "فئة جديدة" : t("settings.newCategory")}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-xl border border-border/50 bg-background/30 p-3 space-y-2.5">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={isAr ? "اسم الفئة" : t("settings.categoryName")}
              className="flex-1 rounded-lg bg-background/50 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as Category["type"])}
              className="rounded-lg bg-background/50 px-2 py-1.5 text-sm text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40"
            >
              {(["general", "video", "design"] as const).map((tp) => (
                <option key={tp} value={tp}>{typeLabels[tp]}</option>
              ))}
            </select>
          </div>
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder={isAr ? "تعريف (اختياري) — ايه معنى الفئة دي؟" : t("settings.descriptionPlaceholder")}
            className="w-full rounded-lg bg-background/50 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 rounded-lg bg-primary/20 py-1.5 text-sm text-primary hover:bg-primary/30"
            >
              {isAr ? "إضافة" : t("common.add")}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 rounded-lg bg-secondary/40 py-1.5 text-sm text-muted-foreground hover:bg-secondary/60"
            >
              {isAr ? "إلغاء" : t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Category list */}
      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="group rounded-xl border border-border/40 bg-background/20 px-3 py-2"
          >
            {editId === cat.id ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    className="flex-1 rounded-lg bg-background/50 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as Category["type"])}
                    className="rounded-lg bg-background/50 px-2 py-1.5 text-sm text-muted-foreground outline-none"
                  >
                    {(["general", "video", "design"] as const).map((tp) => (
                      <option key={tp} value={tp}>{typeLabels[tp]}</option>
                    ))}
                  </select>
                </div>
                <input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder={isAr ? "تعريف (اختياري)" : t("settings.descriptionPlaceholder")}
                  className="w-full rounded-lg bg-background/50 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
                />
                <ColorPicker value={editColor} onChange={setEditColor} />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="flex items-center gap-1 rounded-lg bg-primary/20 px-3 py-1 text-xs text-primary hover:bg-primary/30">
                    <Check className="h-3 w-3" /> {isAr ? "حفظ" : t("common.save")}
                  </button>
                  <button onClick={() => setEditId(null)} className="rounded-lg bg-secondary/40 px-3 py-1 text-xs text-muted-foreground hover:bg-secondary/60">
                    {isAr ? "إلغاء" : t("common.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-3 w-3 rounded-full shrink-0" style={{ background: cat.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cat.name}</span>
                    <span className="font-micro text-[10px] text-muted-foreground/60 rounded-full bg-secondary/30 px-2 py-0.5">
                      {typeLabels[cat.type]}
                    </span>
                  </div>
                  {cat.description && (
                    <p className="mt-0.5 font-micro text-xs text-muted-foreground/60 truncate">
                      {cat.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(cat)} className="rounded p-1 text-muted-foreground/50 hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteCategory(cat.id)} className="rounded p-1 text-muted-foreground/50 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {categories.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground/50">
            {isAr ? "لا توجد فئات بعد" : t("settings.noCategories")}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Tag management ────────────────────────────────────────────────────────────
function TagSection() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const tags = useTasksStore((s) => s.tags);
  const addTag = useTasksStore((s) => s.addTag);
  const updateTag = useTasksStore((s) => s.updateTag);
  const deleteTag = useTasksStore((s) => s.deleteTag);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#F59E0B");
  const [editDesc, setEditDesc] = useState("");

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#F59E0B");
  const [newDesc, setNewDesc] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  function startEdit(tag: Tag) {
    setEditId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditDesc(tag.description ?? "");
  }

  function saveEdit() {
    if (!editId || !editName.trim()) return;
    updateTag(editId, {
      name: editName.trim(),
      color: editColor,
      description: editDesc.trim() || undefined,
    });
    setEditId(null);
  }

  function handleAdd() {
    if (!newName.trim()) return;
    addTag({
      name: newName.trim(),
      color: newColor,
      description: newDesc.trim() || undefined,
    });
    setNewName("");
    setNewColor("#F59E0B");
    setNewDesc("");
    setShowAddForm(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-1.5 text-sm text-primary hover:bg-primary/25 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {isAr ? "وسم جديد" : t("settings.newTag")}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-xl border border-border/50 bg-background/30 p-3 space-y-2.5">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={isAr ? "اسم الوسم" : t("settings.tagName")}
            className="w-full rounded-lg bg-background/50 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder={isAr ? "تعريف (اختياري) — ايه معنى الوسم ده؟" : t("settings.descriptionPlaceholder")}
            className="w-full rounded-lg bg-background/50 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 rounded-lg bg-primary/20 py-1.5 text-sm text-primary hover:bg-primary/30">
              {isAr ? "إضافة" : t("common.add")}
            </button>
            <button onClick={() => setShowAddForm(false)} className="flex-1 rounded-lg bg-secondary/40 py-1.5 text-sm text-muted-foreground hover:bg-secondary/60">
              {isAr ? "إلغاء" : t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Tag list */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="group relative rounded-2xl border border-border/40 bg-background/20 px-3 py-2 min-w-[100px]"
          >
            {editId === tag.id ? (
              <div className="space-y-2 min-w-[180px]">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }}
                  className="w-full rounded bg-background/50 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/40"
                />
                <input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder={isAr ? "تعريف (اختياري)" : t("settings.descriptionPlaceholder")}
                  className="w-full rounded bg-background/50 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
                />
                <ColorPicker value={editColor} onChange={setEditColor} />
                <div className="flex gap-1">
                  <button onClick={saveEdit} className="flex items-center gap-1 rounded bg-primary/20 px-2 py-1 text-xs text-primary hover:bg-primary/30">
                    <Check className="h-3 w-3" />
                  </button>
                  <button onClick={() => setEditId(null)} className="rounded bg-secondary/40 px-2 py-1 text-xs text-muted-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ background: tag.color }} />
                  <span className="text-xs font-medium">{tag.name}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ms-auto">
                    <button onClick={() => startEdit(tag)} className="text-muted-foreground/50 hover:text-foreground">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => deleteTag(tag.id)} className="text-muted-foreground/50 hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {tag.description && (
                  <p className="mt-1 font-micro text-[10px] text-muted-foreground/60 leading-tight">
                    {tag.description}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
        {tags.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground/50">
            {isAr ? "لا توجد وسوم بعد" : t("settings.noTags")}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Google Calendar section ───────────────────────────────────────────────────

type ConnectStatus = "idle" | "waiting" | "syncing" | "success" | "error";

function GoogleCalendarContent() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const {
    clientId, clientSecret, isConnected, lastSyncAt, syncedCount,
    setCredentials, clearConnection,
  } = useGoogleCalendarStore();

  const [localClientId,     setLocalClientId]     = useState(clientId);
  const [localClientSecret, setLocalClientSecret] = useState(clientSecret);
  const [showSecret,        setShowSecret]        = useState(false);
  const [status,            setStatus]            = useState<ConnectStatus>("idle");
  const [errorMsg,          setErrorMsg]          = useState("");

  async function handleConnect() {
    const id  = localClientId.trim();
    const sec = localClientSecret.trim();
    if (!id || !sec) return;
    setCredentials(id, sec);
    setStatus("waiting");
    setErrorMsg("");

    try {
      await listenForOAuthCode(
        id, sec,
        (_count) => { setStatus("success"); void setTimeout(() => setStatus("idle"), 3000); },
        (msg)   => { setStatus("error"); setErrorMsg(msg); }
      );
      await startOAuthFlow(id);
    } catch (err) {
      setStatus("error");
      setErrorMsg(String(err));
    }
  }

  async function handleSync() {
    setStatus("syncing");
    setErrorMsg("");
    try {
      await syncGoogleCalendar();
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(String(err));
    }
  }

  function handleDisconnect() {
    cancelOAuthListen();
    clearConnection();
    useMeetingsStore.getState().removeGoogleMeetings(new Set());
    setStatus("idle");
    setErrorMsg("");
  }

  const formatSyncDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString(isAr ? "ar-EG" : "en-US")} ${d.toLocaleTimeString(isAr ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="space-y-4">
      {isConnected ? (
        <div className="space-y-3">
          {lastSyncAt && (
            <div className="rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                {isAr ? "آخر مزامنة:" : t("settings.lastSync") + ":"}{" "}
                <span className="text-foreground">{formatSyncDate(lastSyncAt)}</span>
              </p>
              <p className="text-muted-foreground">
                {isAr ? "الاجتماعات المستوردة:" : t("settings.syncedMeetings") + ":"}{" "}
                <span className="text-foreground">{syncedCount}</span>
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={status === "syncing"}
              className="flex items-center gap-2 rounded-xl bg-primary/15 px-4 py-2 font-micro text-sm text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", status === "syncing" && "animate-spin")} />
              {status === "syncing"
                ? (isAr ? "جاري المزامنة..." : t("settings.syncing"))
                : (isAr ? "مزامنة الآن" : t("settings.syncNow"))}
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-2 font-micro text-sm text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Unlink className="h-3.5 w-3.5" />
              {isAr ? "قطع الاتصال" : t("settings.disconnect")}
            </button>
          </div>
          {status === "success" && (
            <p className="font-micro text-xs text-green-400">
              {isAr ? "✓ تمت المزامنة بنجاح" : t("settings.syncSuccess")}
            </p>
          )}
          {status === "error" && (
            <p className="font-micro text-xs text-destructive">{errorMsg}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Setup guide */}
          <div className="rounded-xl border border-border/30 bg-secondary/10 p-4 space-y-3">
            <p className="font-micro text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {isAr ? "خطوات الإعداد" : t("settings.setupSteps")}
            </p>
            <ol className="space-y-2 text-sm text-foreground/80">
              {[
                <>
                  {isAr ? "اذهب إلى" : "Go to"}{" "}
                  <a
                    href="#"
                    className="text-primary underline"
                    onClick={(e) => {
                      e.preventDefault();
                      void import("@tauri-apps/plugin-opener").then((m) =>
                        m.openUrl("https://console.cloud.google.com/apis/library/calendar-json.googleapis.com")
                      );
                    }}
                  >
                    console.cloud.google.com
                  </a>{" "}
                  {isAr ? "وفعّل Google Calendar API" : "and enable Google Calendar API"}
                </>,
                isAr
                  ? <>من القائمة: APIs & Services → OAuth consent screen → External → أضف إيميلك كـ Test User</>
                  : <>Go to: APIs & Services → OAuth consent screen → External → Add your email as Test User</>,
                isAr
                  ? <>من القائمة: Credentials → Create Credentials → OAuth Client ID → اختر <strong>Desktop app</strong></>
                  : <>Go to: Credentials → Create Credentials → OAuth Client ID → choose <strong>Desktop app</strong></>,
                isAr
                  ? <>انسخ الـ Client ID والـ Client Secret والصقهم أدناه</>
                  : <>Copy the Client ID and Client Secret and paste them below</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 font-micro text-xs text-primary font-medium">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Credentials */}
          <div className="space-y-2">
            <div>
              <label className="mb-1 block font-micro text-xs text-muted-foreground">Client ID</label>
              <input
                value={localClientId}
                onChange={(e) => setLocalClientId(e.target.value)}
                placeholder="xxxxxxxxx.apps.googleusercontent.com"
                dir="ltr"
                className="w-full rounded-xl border border-border/30 bg-background/40 px-3 py-2 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/30"
              />
            </div>
            <div className="relative">
              <label className="mb-1 block font-micro text-xs text-muted-foreground">Client Secret</label>
              <input
                type={showSecret ? "text" : "password"}
                value={localClientSecret}
                onChange={(e) => setLocalClientSecret(e.target.value)}
                placeholder="GOCSPX-..."
                dir="ltr"
                className="w-full rounded-xl border border-border/30 bg-background/40 px-3 py-2 pe-10 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/30"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute top-[26px] end-3 text-muted-foreground/40 hover:text-muted-foreground"
              >
                {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={!localClientId.trim() || !localClientSecret.trim() || status === "waiting"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/20 py-2.5 font-micro text-sm text-primary hover:bg-primary/30 transition-colors disabled:opacity-40"
          >
            {status === "waiting" ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {isAr ? "في انتظار التفويض..." : "Waiting for authorization..."}
              </>
            ) : (
              isAr ? "ربط Google Calendar" : "Connect Google Calendar"
            )}
          </button>

          {status === "waiting" && (
            <p className="text-center font-micro text-xs text-muted-foreground/60">
              {isAr
                ? "سيفتح المتصفح — وافق على الصلاحيات ثم عد لـ Heed تلقائياً"
                : "Your browser will open — approve permissions then return to Heed automatically"}
            </p>
          )}
          {status === "error" && (
            <p className="font-micro text-xs text-destructive">{errorMsg}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── MCP / Claude integration ──────────────────────────────────────────────────
function McpContent() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [copied, setCopied] = useState(false);

  const configSnippet = JSON.stringify(
    {
      mcpServers: {
        heed: {
          command: "node",
          args: ["<مسار المشروع>/mcp/server.mjs"],
        },
      },
    },
    null,
    2
  );

  async function copy() {
    await navigator.clipboard.writeText(configSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-3 text-sm text-foreground/80">
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs text-primary font-medium">
            {isAr ? "١" : "1"}
          </span>
          <span>
            {isAr
              ? <>افتح ملف إعدادات Claude Desktop:</>
              : <>Open Claude Desktop config file:</>}
            <br />
            <code className="mt-1 block rounded bg-secondary/40 px-2 py-1 font-mono text-xs">
              ~/Library/Application Support/Claude/claude_desktop_config.json
            </code>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs text-primary font-medium">
            {isAr ? "٢" : "2"}
          </span>
          <span>
            {isAr
              ? <>أضف هذا الكود داخل <code className="rounded bg-secondary/40 px-1 font-mono text-xs">mcpServers</code>:</>
              : <>Add this config inside <code className="rounded bg-secondary/40 px-1 font-mono text-xs">mcpServers</code>:</>}
          </span>
        </li>
      </ol>

      <div className="relative rounded-xl bg-secondary/30 p-3">
        <pre className="overflow-x-auto font-mono text-xs text-muted-foreground whitespace-pre-wrap">
          {configSnippet}
        </pre>
        <button
          onClick={copy}
          className="absolute top-2 start-2 rounded-lg bg-background/60 px-2.5 py-1 font-micro text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (isAr ? "✓ تم النسخ" : "✓ Copied") : (isAr ? "نسخ" : "Copy")}
        </button>
      </div>

      <ol className="space-y-2 text-sm text-foreground/80" start={3}>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs text-primary font-medium">
            {isAr ? "٣" : "3"}
          </span>
          <span>
            {isAr
              ? <>استبدل <code className="rounded bg-secondary/40 px-1 font-mono text-xs">&lt;مسار المشروع&gt;</code> بالمسار الكامل لمجلد Heed على جهازك.</>
              : <>Replace <code className="rounded bg-secondary/40 px-1 font-mono text-xs">&lt;مسار المشروع&gt;</code> with the full path to your Heed folder.</>}
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs text-primary font-medium">
            {isAr ? "٤" : "4"}
          </span>
          <span>
            {isAr
              ? "أعد تشغيل Claude Desktop — ستجد أدوات Heed في قائمة الأدوات المتاحة."
              : "Restart Claude Desktop — you'll find Heed tools in the available tools list."}
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs text-primary font-medium">
            {isAr ? "٥" : "5"}
          </span>
          <span>
            {isAr ? "للاستخدام مع Claude Code CLI، شغّل:" : "For Claude Code CLI, run:"}
            <code className="mt-1 block rounded bg-secondary/40 px-2 py-1 font-mono text-xs">
              claude mcp add heed node &lt;path&gt;/mcp/server.mjs
            </code>
          </span>
        </li>
      </ol>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-sm text-primary/80">
          {isAr
            ? <>بعد الربط، تقدر تقول لـ Claude مثلاً: <em>"أضف مهمة: مراجعة الفيديو — أولوية عالية"</em></>
            : <>After connecting, you can tell Claude: <em>"Add task: Review video — high priority"</em></>}
        </p>
      </div>
    </div>
  );
}

// ── Toggle switch (knob sliding, dir=ltr) ─────────────────────────────────────
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      dir="ltr"
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
        checked ? "bg-primary" : "bg-secondary"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ── Notifications section ─────────────────────────────────────────────────────
function NotificationsSection() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [prefs, setPrefsState] = useState<NotifPrefs>(() => getNotifPrefs());

  function toggle(key: keyof NotifPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefsState(next);
    setNotifPrefs(next);
  }

  const rows: { key: keyof NotifPrefs; labelAr: string; labelEn: string; descAr: string; descEn: string }[] = [
    { key: "dms",      labelAr: "الرسائل",                    labelEn: "Messages",            descAr: "الرسائل المباشرة ورسائل المجموعات",     descEn: "Direct messages & group chats" },
    { key: "tasks",    labelAr: "المهام المُسندة",              labelEn: "Task assignments",    descAr: "عند إسناد مهمة إليك",                   descEn: "When a task is assigned to you" },
    { key: "mentions", labelAr: "الإشارات",                   labelEn: "Mentions",            descAr: "عند ذكر اسمك في تعليق",                 descEn: "When someone mentions you" },
    { key: "invites",  labelAr: "دعوات الانضمام",              labelEn: "Workspace invites",   descAr: "عند دعوتك لمساحة عمل",                  descEn: "When you're invited to a workspace" },
    { key: "hr",       labelAr: "طلبات الموارد البشرية",        labelEn: "HR requests",         descAr: "تحديثات طلبات HR",                       descEn: "HR request updates" },
    { key: "email",    labelAr: "البريد الإلكتروني",           labelEn: "Email notifications", descAr: "إشعارات عبر البريد الإلكتروني",          descEn: "Receive notifications by email" },
  ];

  return (
    <CollapsibleSection
      title={isAr ? "الإشعارات" : "Notifications"}
      subtitle={isAr ? "تحكّم في الإشعارات التي تصلك" : "Control which notifications you receive"}
      icon="🔔"
    >
      <div className="divide-y divide-border/30">
        {rows.map(({ key, labelAr, labelEn, descAr, descEn }) => (
          <div key={key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{isAr ? labelAr : labelEn}</span>
              <span className="text-xs text-muted-foreground">{isAr ? descAr : descEn}</span>
            </div>
            <ToggleSwitch checked={prefs[key]} onChange={() => toggle(key)} />
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

// ── Profile section ───────────────────────────────────────────────────────────
function ProfileSection() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { user, updateProfile } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(user?.name ?? "");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const isGuest = user?.id === "guest";

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : "؟";

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void updateProfile({ avatarUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const doSaveName = async () => {
    if (!nameVal.trim()) return;
    setSaving(true);
    await updateProfile({ name: nameVal.trim() });
    setSaving(false);
    setSaved(true);
    setEditingName(false);
    setConfirmOpen(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="rounded-2xl border border-border/55 bg-card/40 p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-medium">
            {isAr ? "الملف الشخصي" : t("settings.profile")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isAr ? "بياناتك وصورتك الشخصية" : t("settings.profileDesc")}
          </p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 font-micro text-xs text-emerald-400">
            <Check className="h-3 w-3" />
            {isAr ? "تم الحفظ" : "Saved"}
          </span>
        )}
      </div>

      {/* Avatar picker modal */}
      <AvatarPickerModal
        open={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        onSelect={(v) => void updateProfile({ avatarUrl: v })}
        currentValue={user?.avatarUrl}
        variant="people"
        title={isAr ? "اختر صورتك الشخصية" : "Pick your avatar"}
      />

      {/* Avatar + basic info */}
      <div className="flex items-center gap-5">
        {/* Avatar */}
        <div className="relative">
          <button
            disabled={isGuest}
            onClick={() => setAvatarPickerOpen(true)}
            className="block group/avatar disabled:cursor-not-allowed"
          >
            <Avatar
              value={user?.avatarUrl}
              fallback={initials}
              size="xl"
              shape="square"
              className="ring-2 ring-primary/30 group-hover/avatar:ring-primary transition"
            />
          </button>
          {!isGuest && (
            <>
              <button
                onClick={() => setAvatarPickerOpen(true)}
                className="absolute -bottom-1.5 -end-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-white shadow-md transition-transform hover:scale-105"
                title={isAr ? "اختر صورة" : "Choose avatar"}
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              {/* Hidden file input for legacy "upload" option (kept for power users) */}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -top-1.5 -end-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-secondary text-muted-foreground shadow-sm transition-transform hover:scale-105 hover:text-foreground"
                title={isAr ? "ارفع صورة من جهازك" : "Upload from device"}
              >
                <Plus className="h-3 w-3" />
              </button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* Name + email */}
        <div className="flex-1 space-y-1.5">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setConfirmOpen(true);
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="flex-1 rounded-xl border border-primary/50 bg-background/60 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={isAr ? "اسمك الكامل" : "Full name"}
              />
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={saving}
                className="flex items-center gap-1 rounded-lg bg-primary/20 px-3 py-1.5 text-xs text-primary hover:bg-primary/30"
              >
                <Save className="h-3 w-3" />
                {saving ? "…" : (isAr ? "حفظ" : t("common.save"))}
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="rounded-lg bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
              >
                {isAr ? "إلغاء" : t("common.cancel")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-base font-medium">
                {user?.name ?? (isGuest ? (isAr ? "زائر" : "Guest") : "—")}
              </p>
              {!isGuest && (
                <button
                  onClick={() => { setNameVal(user?.name ?? ""); setEditingName(true); }}
                  className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {user?.email && !isGuest && (
            <p className="font-micro text-sm text-muted-foreground" dir="ltr">
              {user.email}
            </p>
          )}

          {isGuest && (
            <p className="font-micro text-xs text-amber-400/80">
              {isAr
                ? "أنت تستخدم التطبيق كزائر — سجّل دخولك للحفظ على السحابة"
                : "You're using the app as a guest — sign in to save to the cloud"}
            </p>
          )}
        </div>
      </div>

      {/* Confirm save dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-2xl mx-4">
            <h3 className="text-base font-semibold">
              {isAr ? "هل تحفظ التعديلات؟" : t("settings.confirmSave")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {isAr
                ? `هتعدّل اسمك من "${user?.name ?? "—"}" إلى "${nameVal}"`
                : `Change your name from "${user?.name ?? "—"}" to "${nameVal}"`}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => void doSaveName()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
              >
                {isAr ? "نعم، احفظ" : t("settings.yes")}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-xl bg-secondary py-2.5 text-sm text-secondary-foreground hover:bg-secondary/80 transition"
              >
                {isAr ? "لا، إلغاء" : t("settings.no")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Reset / clear local cache ──────────────────────────────────────────────
// Destructive action: wipes all on-device data and reloads from the cloud.
// Guarded by a confirmation dialog with a short countdown + a backup option.
function ResetSection() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Restart a short countdown each time the dialog opens, so the user can't
  // reflexively confirm a destructive action — it pauses them for a moment.
  useEffect(() => {
    if (!confirmOpen) return;
    setCountdown(3);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [confirmOpen]);

  const doReset = () => {
    [
      "heed:tasks", "heed:canvas", "heed:schedule", "heed:meetings",
      "heed:workspaces", "heed:notifications", "heed:chat",
    ].forEach((k) => localStorage.removeItem(k));
    resetAllStores();
    location.reload();
  };

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-4">
      <p className="text-sm font-medium text-destructive">{isAr ? "إعادة الضبط" : "Reset"}</p>
      <p className="mt-1 font-micro text-xs text-muted-foreground">
        {isAr
          ? "بيمسح كل البيانات المحلية على الجهاز ويعيد التحميل من السحابة. خُد نسخة احتياطية الأول للأمان."
          : "Wipes all on-device data and reloads from the cloud. Download a backup first to be safe."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => downloadBackup()}
          className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          {isAr ? "نسخة احتياطية" : "Download backup"}
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm text-destructive transition hover:border-destructive/60 hover:bg-destructive/20"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {isAr ? "إعادة الضبط" : "Reset"}
        </button>
      </div>

      {/* Confirm reset dialog — red, with backup + countdown guard */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmOpen(false)}
          />
          <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-2.5 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h3 className="text-base font-semibold">
                {isAr ? "تأكيد إعادة الضبط" : "Confirm reset"}
              </h3>
            </div>
            <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {isAr
                ? "⚠️ ده هيمسح كل البيانات المحلية على الجهاز. لو مأخدتش نسخة احتياطية ومفيش نسخة على السحابة، البيانات هتضيع."
                : "⚠️ This deletes all local data on this device. If you haven't backed up and there's no cloud copy, it will be lost."}
            </p>
            <button
              onClick={() => downloadBackup()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              {isAr ? "تحميل نسخة احتياطية أولاً" : "Download backup first"}
            </button>
            <div className="mt-5 flex gap-2">
              <button
                onClick={doReset}
                disabled={countdown > 0}
                className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-medium text-destructive-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {countdown > 0
                  ? (isAr ? `استنى… ${countdown}` : `Wait… ${countdown}`)
                  : (isAr ? "نعم، امسح كل حاجة" : "Yes, wipe everything")}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-xl bg-secondary py-2.5 text-sm text-secondary-foreground transition hover:bg-secondary/80"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Settings page ────────────────────────────────────────────────────────
// Build-time app version (kept in sync with package.json / tauri.conf.json).
const APP_VERSION = "0.1.52";
const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function AboutSection() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const tr = <T,>(ar: T, en: T) => (isAr ? ar : en);

  const [version, setVersion] = useState(APP_VERSION);
  const [phase, setPhase] = useState<"idle" | "checking" | "latest" | "available" | "downloading">("idle");
  const [pending, setPending] = useState<{ version: string; downloadAndInstall: (cb: (e: { event: string; data?: { chunkLength?: number; contentLength?: number } }) => void) => Promise<void> } | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    void import("@tauri-apps/api/app").then(({ getVersion }) => getVersion().then(setVersion).catch(() => {}));
  }, []);

  const check = async () => {
    if (!isTauri()) {
      toast.message(tr("التحديثات متاحة في تطبيق سطح المكتب فقط", "Updates are available in the desktop app only"));
      return;
    }
    setPhase("checking");
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) {
        setPhase("latest");
        toast.success(tr("إنت على آخر إصدار 🎉", "You're on the latest version 🎉"));
        return;
      }
      setPending(update as unknown as typeof pending);
      setPhase("available");
      toast.message(tr(`تحديث جديد متاح: v${(update as { version?: string }).version ?? ""}`, `Update available: v${(update as { version?: string }).version ?? ""}`));
    } catch (e) {
      toast.error(tr("تعذّر فحص التحديثات", "Couldn't check for updates") + ": " + (e as Error).message);
      setPhase("idle");
    }
  };

  const install = async () => {
    if (!pending) return;
    setPhase("downloading");
    try {
      await pending.downloadAndInstall(() => {});
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      toast.error(tr("فشل التثبيت", "Install failed") + ": " + (e as Error).message);
      setPhase("available");
    }
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-medium">{tr("حول التطبيق", "About")}</h2>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-foreground/80">
            Heed <span className="font-mono">v{version}</span>
          </p>
          <p className="mt-0.5 font-micro text-[11px] text-muted-foreground">
            {phase === "latest"
              ? tr("إنت على آخر إصدار ✓", "You're on the latest version ✓")
              : phase === "available" && pending
              ? tr(`تحديث جديد متاح: v${pending.version}`, `Update available: v${pending.version}`)
              : tr("النسخة الحالية المثبّتة", "Currently installed version")}
          </p>
        </div>

        {phase === "available" ? (
          <button
            onClick={() => void install()}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Download className="h-4 w-4" /> {tr("حدّث الآن", "Update now")}
          </button>
        ) : phase === "downloading" ? (
          <span className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> {tr("بحمّل…", "Downloading…")}
          </span>
        ) : (
          <button
            onClick={() => void check()}
            disabled={phase === "checking"}
            className="flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm transition hover:bg-secondary disabled:opacity-50"
          >
            {phase === "checking" ? <RefreshCw className="h-4 w-4 animate-spin" /> : phase === "latest" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <RefreshCw className="h-4 w-4" />}
            {phase === "checking" ? tr("بفحص…", "Checking…") : tr("فحص التحديثات", "Check for updates")}
          </button>
        )}
      </div>
    </section>
  );
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { isConnected } = useGoogleCalendarStore();
  const { signOut } = useAuthStore();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-10">
      <h1 className="font-display text-3xl font-medium">{t("nav.settings")}</h1>

      {/* Profile */}
      <ProfileSection />

      {/* Language */}
      <section className="rounded-2xl border border-border/60 bg-card/40 p-5">
        <h2 className="text-lg font-medium">{t("common.language")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAr
            ? "غيّر اللغة بين العربية والإنجليزية. اتجاه الواجهة (RTL/LTR) يتغير تلقائياً."
            : t("settings.languageDesc")}
        </p>
        <div className="mt-4 flex gap-2">
          {(["en", "ar"] as const).map((lng) => (
            <button
              key={lng}
              onClick={() => void i18n.changeLanguage(lng)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                i18n.language === lng
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {lng === "en" ? "English" : "العربية"}
            </button>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <NotificationsSection />

      {/* Categories — collapsible */}
      <CollapsibleSection
        title={isAr ? "الفئات" : t("settings.categories")}
        subtitle={isAr ? "صنّف مهامك بفئات ملوّنة" : t("settings.categoriesDesc")}
      >
        <CategorySection />
      </CollapsibleSection>

      {/* Tags — collapsible */}
      <CollapsibleSection
        title={isAr ? "الوسوم (Tags)" : t("settings.tags")}
        subtitle={isAr ? "أضف وسوم لتصنيف المهام بشكل أدق" : t("settings.tagsDesc")}
      >
        <TagSection />
      </CollapsibleSection>

      {/* Google Calendar — collapsible */}
      <CollapsibleSection
        title="Google Calendar"
        subtitle={
          isAr
            ? "استورد اجتماعاتك من Google Calendar تلقائياً"
            : t("settings.googleCalendarDesc")
        }
        icon="📅"
        badge={
          isConnected ? (
            <span className="shrink-0 rounded-full bg-green-500/15 px-3 py-1 font-micro text-xs text-green-400">
              {isAr ? "متصل ✓" : t("settings.connected")}
            </span>
          ) : undefined
        }
      >
        <GoogleCalendarContent />
      </CollapsibleSection>

      {/* MCP / Claude — collapsible */}
      <CollapsibleSection
        title={isAr ? "ربط Claude عبر MCP" : t("settings.claudeMcp")}
        subtitle={
          isAr
            ? "تحكّم في مهامك من محادثة Claude مباشرة"
            : t("settings.claudeMcpDesc")
        }
        icon="🤖"
      >
        <McpContent />
      </CollapsibleSection>

      {/* About — version + check for updates */}
      <AboutSection />

      {/* Reset — wipes local data, re-pulls from the cloud (with backup + confirm) */}
      <ResetSection />

      {/* Sign out — always at the bottom */}
      <div className="pb-4">
        <button
          onClick={() => signOut()}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/8 py-3 text-sm text-destructive transition-all hover:bg-destructive/15 hover:border-destructive/50"
        >
          <LogOut className="h-4 w-4" />
          {isAr ? "تسجيل الخروج" : t("auth.logout")}
        </button>
      </div>
    </div>
  );
}
