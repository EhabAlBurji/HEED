import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Settings as SettingsIcon,
  Globe,
  FolderKanban,
  Moon,
  Sun,
  CalendarDays,
  ChevronDown,
  Plus,
  Users,
  Check,
  UserPlus,
  X,
  Mail,
  Crown,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
} from "lucide-react";
import { HeedLogo } from "../HeedLogo";
import { cn } from "../../lib/utils";
import { useUIStore, type FontSize } from "../../stores/uiStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useAuthStore } from "../../stores/authStore";
import { useTasksStore, isoDate } from "../../stores/tasksStore";

const navItems = [
  { to: "/",         icon: LayoutDashboard, key: "nav.dashboard",  end: true },
  { to: "/projects", icon: FolderKanban,     key: "nav.projects" },
  { to: "/schedule", icon: CalendarDays,     key: "nav.schedule" },
];

const workspaceColors = [
  "#0A4EFF", "#FDFD5F", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
];

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, fontSize, setFontSize } = useUIStore();

  const sizeOrder: FontSize[] = ["sm", "md", "lg", "xl", "2xl"];
  const sizeIdx = sizeOrder.indexOf(fontSize);
  const zoomOut = () => sizeIdx > 0 && setFontSize(sizeOrder[sizeIdx - 1]);
  const zoomIn  = () => sizeIdx < sizeOrder.length - 1 && setFontSize(sizeOrder[sizeIdx + 1]);
  const resetZoom = () => setFontSize("md");
  const { user, signOut } = useAuthStore();
  const { workspaces, activeWorkspaceId, setActiveWorkspace, addWorkspace, addMember, removeMember } =
    useWorkspaceStore();

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  const [wsOpen, setWsOpen]           = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [newWsName, setNewWsName]     = useState("");
  const [newWsColor, setNewWsColor]   = useState(workspaceColors[0]);
  const [creating, setCreating]       = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [inviteName, setInviteName]   = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const wsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) setWsOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleLang = () => {
    void i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar");
  };

  const handleCreateWorkspace = () => {
    if (!newWsName.trim()) return;
    const ws = addWorkspace({
      name: newWsName.trim(),
      type: "team",
      color: newWsColor,
      memberCount: 1,
    });
    setActiveWorkspace(ws.id);
    setNewWsName("");
    setCreating(false);
    setWsOpen(false);
  };

  const handleInviteMember = () => {
    if (!inviteName.trim() && !inviteEmail.trim()) return;
    addMember(activeWorkspaceId, {
      name: inviteName.trim() || inviteEmail.split("@")[0],
      email: inviteEmail.trim(),
      role: "member",
    });
    setInviteName("");
    setInviteEmail("");
  };

  // (user profile is now shown in the TopBar — ryswift pattern)
  void user; void userMenuOpen; void setUserMenuOpen; void signOut; void userRef;

  return (
    <aside className="relative flex h-full w-60 flex-col bg-card border-e border-border">
      {/* ── Brand logo at top (ryswift style) ──────────── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <HeedLogo className="h-9 w-9 text-primary drop-shadow-[0_4px_12px_rgba(103,53,225,0.25)]" />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            Heed
          </span>
        </div>
      </div>

      {/* ── Workspace selector ────────────────────────── */}
      <div className="relative px-3 pb-3" ref={wsRef}>
        <button
          onClick={() => setWsOpen((v) => !v)}
          className="group flex w-full items-center gap-2.5 rounded-2xl border border-border/40 bg-background/40 px-3 py-2 transition-all hover:bg-secondary hover:border-primary/30"
        >
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white shadow-sm"
            style={{ backgroundColor: activeWs?.color ?? "#0A4EFF" }}
          >
            {activeWs?.type === "team" ? (
              <Users className="h-3 w-3" />
            ) : (
              activeWs?.name?.[0] ?? "م"
            )}
          </div>
          <div className="min-w-0 flex-1 text-start">
            <p className="truncate text-xs font-medium leading-none">
              {activeWs?.name ?? "Heed"}
            </p>
            <p className="mt-0.5 font-micro text-[9px] text-muted-foreground/70">
              {activeWs?.type === "team" ? `${activeWs.memberCount} أعضاء` : "شخصي"}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform",
              wsOpen && "rotate-180"
            )}
          />
        </button>

        {wsOpen && (
          <div
            className="absolute start-3 end-3 top-full z-50 mt-1.5 rounded-2xl border border-border/60 p-2 shadow-2xl"
            style={{ background: "hsl(var(--card) / 0.98)", backdropFilter: "blur(24px)" }}
          >
            <p className="mb-1.5 px-2 font-micro text-[10px] uppercase tracking-widest text-muted-foreground/60">
              مساحات العمل
            </p>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => { setActiveWorkspace(ws.id); setWsOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-start transition-all hover:bg-secondary"
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                  style={{ backgroundColor: ws.color }}
                >
                  {ws.type === "team" ? <Users className="h-3 w-3" /> : ws.name[0]}
                </div>
                <span className="flex-1 truncate text-sm">{ws.name}</span>
                {ws.id === activeWorkspaceId && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </button>
            ))}

            {activeWs?.type === "team" && (
              <>
                <div className="my-2 h-px bg-border/40" />
                <button
                  onClick={() => setShowMembers((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-sm text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span className="flex-1">الأعضاء</span>
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-micro text-[10px] text-primary">
                    {activeWs.memberCount}
                  </span>
                  <ChevronDown className={cn("h-3 w-3 transition-transform", showMembers && "rotate-180")} />
                </button>

                {showMembers && (
                  <div className="space-y-1 px-1 pb-1">
                    {(activeWs.members ?? []).length === 0 ? (
                      <p className="py-1 text-center font-micro text-[10px] text-muted-foreground/40">لا يوجد أعضاء بعد</p>
                    ) : (
                      (activeWs.members ?? []).map((m) => (
                        <div key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 font-micro text-[10px] font-bold text-primary">
                            {m.name?.[0]?.toUpperCase() ?? "؟"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-micro text-xs font-medium">{m.name}</p>
                            {m.email && <p className="truncate font-micro text-[10px] text-muted-foreground/60" dir="ltr">{m.email}</p>}
                          </div>
                          {m.role === "owner" ? (
                            <Crown className="h-3 w-3 shrink-0 text-amber-400" />
                          ) : (
                            <button
                              onClick={() => removeMember(activeWorkspaceId, m.id)}
                              className="shrink-0 text-muted-foreground/30 hover:text-destructive transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))
                    )}

                    <div className="mt-1 space-y-1.5 rounded-xl border border-dashed border-border/40 p-2">
                      <p className="font-micro text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <UserPlus className="h-3 w-3" />دعوة عضو جديد
                      </p>
                      <input
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="الاسم"
                        className="w-full rounded-lg border border-border/40 bg-background/40 px-2 py-1.5 font-micro text-xs outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                      />
                      <div className="flex gap-1.5">
                        <input
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleInviteMember()}
                          placeholder="البريد الإلكتروني"
                          dir="ltr"
                          className="flex-1 rounded-lg border border-border/40 bg-background/40 px-2 py-1.5 font-micro text-xs outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                        />
                        <button
                          onClick={handleInviteMember}
                          className="rounded-lg bg-primary/20 px-2 py-1.5 font-micro text-xs text-primary hover:bg-primary/30 transition-colors"
                        >
                          <Mail className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="my-2 h-px bg-border/40" />

            {creating ? (
              <div className="space-y-2 px-1">
                <input
                  autoFocus
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateWorkspace();
                    if (e.key === "Escape") setCreating(false);
                  }}
                  placeholder="اسم المساحة"
                  className="w-full rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-sm outline-none focus:border-primary/50"
                />
                <div className="flex gap-1.5">
                  {workspaceColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewWsColor(c)}
                      className={cn("h-5 w-5 rounded-full transition-all", newWsColor === c && "ring-2 ring-white ring-offset-1 ring-offset-background")}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateWorkspace}
                    className="flex-1 rounded-lg bg-primary/20 py-1.5 text-xs text-primary hover:bg-primary/30"
                  >
                    إنشاء
                  </button>
                  <button
                    onClick={() => setCreating(false)}
                    className="rounded-lg bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-sm text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                مساحة عمل جديدة
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Navigation (ryswift Main / Other sections) ─── */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3 scrollbar-none">
        <NavSection label="Main">
          {navItems.map(({ to, icon: Icon, key, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary text-white shadow-[0_4px_16px_rgba(103,53,225,0.25)]"
                    : "text-foreground/70 hover:bg-secondary hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-colors",
                      isActive ? "text-white" : "text-foreground/60 group-hover:text-foreground",
                    )}
                  />
                  <span className="leading-none">{t(key)}</span>
                </>
              )}
            </NavLink>
          ))}
        </NavSection>

        <NavSection label="Other">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary text-white shadow-[0_4px_16px_rgba(103,53,225,0.25)]"
                  : "text-foreground/70 hover:bg-secondary hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <SettingsIcon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    isActive ? "text-white" : "text-foreground/60 group-hover:text-foreground",
                  )}
                />
                <span className="leading-none">{t("nav.settings")}</span>
              </>
            )}
          </NavLink>
        </NavSection>
      </nav>

      {/* ── Attention Needed card (ryswift footer pattern) ── */}
      <AttentionCard />


      {/* ── Bottom: theme + language toggles ────────────── */}
      <div className="border-t border-border/30 p-3 space-y-1.5">
        {/* Theme pill toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center justify-between rounded-full border border-border/40 bg-background/40 px-3 py-1.5 transition hover:border-primary/30"
        >
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {theme === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
            <span className="font-micro">{theme === "dark" ? "داكن" : "فاتح"}</span>
          </span>
          {/* dir="ltr" keeps the knob sliding L→R regardless of page direction */}
          <span
            dir="ltr"
            className={cn(
              "relative inline-block h-4 w-7 shrink-0 rounded-full transition-colors",
              theme === "dark" ? "bg-primary" : "bg-secondary"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-[left] duration-200",
                theme === "dark" ? "left-3.5" : "left-0.5"
              )}
            />
          </span>
        </button>

        <button
          onClick={toggleLang}
          className="flex w-full items-center justify-between rounded-full border border-border/40 bg-background/40 px-3 py-1.5 transition hover:border-primary/30"
        >
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Globe className="h-3 w-3" />
            <span className="font-micro">اللغة</span>
          </span>
          <span className="font-micro text-[11px] font-medium text-foreground/80">
            {i18n.language === "ar" ? "العربية" : "English"}
          </span>
        </button>

        {/* Zoom in / out bar */}
        <div
          dir="ltr"
          className="flex items-center justify-between rounded-full border border-border/40 bg-background/40 px-2 py-1"
        >
          <button
            onClick={zoomOut}
            disabled={sizeIdx === 0}
            title="تصغير الخط"
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>

          {/* Level dots */}
          <button
            onClick={resetZoom}
            title="إعادة الحجم الافتراضي"
            className="flex items-center gap-1 rounded-full px-2 py-0.5 transition hover:bg-secondary"
          >
            {sizeOrder.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === sizeIdx
                    ? "w-3 bg-primary"
                    : i < sizeIdx
                    ? "w-1.5 bg-primary/40"
                    : "w-1.5 bg-muted-foreground/25"
                )}
              />
            ))}
          </button>

          <button
            onClick={zoomIn}
            disabled={sizeIdx === sizeOrder.length - 1}
            title="تكبير الخط"
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Section label wrapper ────────────────────────────────────────────────────
function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 font-micro text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </p>
      {children}
    </div>
  );
}

// ── Attention Needed footer card ─────────────────────────────────────────────
function AttentionCard() {
  const navigate = useNavigate();
  const allTasks = useTasksStore((s) => s.tasks);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const todayStr = isoDate(new Date());
  const urgentToday = allTasks.filter(
    (t) =>
      (t.workspace_id ?? "personal") === activeWorkspaceId &&
      t.status !== "done" &&
      (t.priority === "urgent" || t.priority === "high") &&
      (t.column === "today" || t.deadline === todayStr),
  );

  if (urgentToday.length === 0) return null;

  return (
    <div className="mx-3 mb-3 rounded-2xl border border-border bg-secondary/60 p-3 text-center">
      <div className="relative mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-amber-500/20">
        <AlertTriangle className="h-5 w-5 text-white" strokeWidth={2.5} />
      </div>
      <p className="font-display text-sm font-bold leading-tight">
        Attention Needed
      </p>
      <p className="mt-1 font-micro text-[10px] text-muted-foreground leading-snug">
        {urgentToday.length} {urgentToday.length === 1 ? "مهمة عاجلة" : "مهام عاجلة"}
        <br />تحتاج اهتمامك
      </p>
      <button
        onClick={() => navigate("/projects")}
        className="mt-2.5 w-full rounded-full bg-primary py-2 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(103,53,225,0.3)] transition hover:opacity-95"
      >
        View Alerts
      </button>
    </div>
  );
}
