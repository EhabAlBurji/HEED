import { useState, useEffect, useMemo } from "react";
import {
  Users,
  GitBranch,
  InboxIcon,
  Settings2,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Loader2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useHRStore } from "../stores/hrStore";
import { useAuthStore } from "../stores/authStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import {
  pullHRData,
  createHREmployee,
  updateHREmployee,
  deleteHREmployee,
  pushHRDepartment,
  deleteHRDepartment,
  createHRDepartment,
  createHRPosition,
  pushHRPosition,
  deleteHRPosition,
  pushHRRequestType,
  createHRRequestType,
  createHRRequest,
  reviewHRRequest,
} from "../lib/hrSync";
import { OrgChart, DeptOrgView } from "../components/hr/OrgChart";
import { EmployeeFormDrawer } from "../components/hr/EmployeeFormDrawer";
import { RequestFormDrawer } from "../components/hr/RequestFormDrawer";
import { HRSettings } from "../components/hr/HRSettings";
import type { HREmployee, HRRequest, HRRequestType } from "../stores/hrStore";
import { seedDemoData } from "../lib/demoData";

type Tab = "employees" | "org" | "requests" | "settings";
type OrgView = "hierarchy" | "departments";
type StatusFilter = "all" | "pending" | "approved" | "rejected" | "cancelled";

const TAB_ITEMS: { key: Tab; labelAr: string; icon: React.ElementType }[] = [
  { key: "employees", labelAr: "الموظفون", icon: Users },
  { key: "org", labelAr: "الهيكل التنظيمي", icon: GitBranch },
  { key: "requests", labelAr: "الطلبات", icon: InboxIcon },
  { key: "settings", labelAr: "الإعدادات", icon: Settings2 },
];

const STATUS_CONFIG = {
  pending:   { label: "في الانتظار", color: "bg-amber-100 text-amber-700 border-amber-200",   icon: Clock,        dot: "bg-amber-400" },
  approved:  { label: "موافق عليه",  color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2, dot: "bg-emerald-500" },
  rejected:  { label: "مرفوض",       color: "bg-red-100 text-red-700 border-red-200",          icon: XCircle,      dot: "bg-red-500" },
  cancelled: { label: "ملغي",        color: "bg-gray-100 text-gray-500 border-gray-200",       icon: XCircle,      dot: "bg-gray-400" },
};

const EMP_STATUS = {
  active:    { label: "نشط",       color: "bg-emerald-100 text-emerald-700" },
  inactive:  { label: "غير نشط",   color: "bg-gray-100 text-gray-500" },
  on_leave:  { label: "في إجازة",  color: "bg-blue-100 text-blue-700" },
};

export default function HR() {
  const [tab, setTab] = useState<Tab>("employees");
  const [orgView, setOrgView] = useState<OrgView>("hierarchy");
  const [empSearch, setEmpSearch] = useState("");
  const [empDeptFilter, setEmpDeptFilter] = useState("");
  const [empStatusFilter, setEmpStatusFilter] = useState<"all" | HREmployee["status"]>("all");
  const [reqStatusFilter, setReqStatusFilter] = useState<StatusFilter>("all");
  const [reqEmpFilter, setReqEmpFilter] = useState("");
  const [reqScope, setReqScope] = useState<"mine" | "all">("mine");
  const [empFormOpen, setEmpFormOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<HREmployee | null>(null);
  const [reqFormOpen, setReqFormOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<HRRequest | null>(null);

  const user = useAuthStore((s) => s.user);
  const { activeWorkspaceId } = useWorkspaceStore();
  const {
    departments, positions, employees, requestTypes, requests, loading,
    updateDepartment, deleteDepartment: deleteDeptStore,
    updatePosition, deletePosition: deletePosStore,
    updateRequestType, deleteEmployee: deleteEmpStore,
  } = useHRStore();

  // Seed demo data on first load (no-op if already seeded)
  useEffect(() => {
    if (activeWorkspaceId) {
      // Seed after a short delay so request types are populated first
      const t = setTimeout(() => seedDemoData(activeWorkspaceId), 800);
      return () => clearTimeout(t);
    }
  }, [activeWorkspaceId]);

  // Load HR data when component mounts or workspace changes
  useEffect(() => {
    if (activeWorkspaceId && user && user.id !== "guest") {
      void pullHRData(activeWorkspaceId);
    }
  }, [activeWorkspaceId, user?.id]);

  // Is the current user an HR admin?
  const currentEmployee = useMemo(
    () => employees.find((e) => e.userId === user?.id && e.workspaceId === activeWorkspaceId) ?? null,
    [employees, user?.id, activeWorkspaceId]
  );
  const isHrAdmin = currentEmployee?.isHrAdmin ?? false;
  // When no employee record is linked, workspace owner/admin can still use HR as admin
  const canUseHR = Boolean(user && user.id !== "guest");

  // Filter employees for display
  const wsEmployees = useMemo(
    () => employees.filter((e) => e.workspaceId === activeWorkspaceId),
    [employees, activeWorkspaceId]
  );
  const wsRequests = useMemo(
    () => requests.filter((r) => r.workspaceId === activeWorkspaceId),
    [requests, activeWorkspaceId]
  );

  const filteredEmployees = useMemo(() => {
    let list = wsEmployees;
    if (empDeptFilter) list = list.filter((e) => e.departmentId === empDeptFilter);
    if (empStatusFilter !== "all") list = list.filter((e) => e.status === empStatusFilter);
    if (empSearch.trim()) {
      const q = empSearch.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.email ?? "").toLowerCase().includes(q) ||
          (e.employeeNo ?? "").toLowerCase().includes(q) ||
          (e.phone ?? "").includes(q)
      );
    }
    return list;
  }, [wsEmployees, empDeptFilter, empStatusFilter, empSearch]);

  // Effective scope: fall back to "all" if no employee record is linked
  const effectiveScope = currentEmployee ? reqScope : "all";

  const filteredRequests = useMemo(() => {
    let list = wsRequests;
    if (effectiveScope === "mine" && currentEmployee) {
      list = list.filter((r) => r.employeeId === currentEmployee.id);
    }
    if (reqStatusFilter !== "all") list = list.filter((r) => r.status === reqStatusFilter);
    if (reqEmpFilter) list = list.filter((r) => r.employeeId === reqEmpFilter);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [wsRequests, reqStatusFilter, reqEmpFilter, effectiveScope, currentEmployee]);

  // Request counts for badge
  const pendingCount = wsRequests.filter(
    (r) => r.status === "pending" && (isHrAdmin || r.employeeId === currentEmployee?.id)
  ).length;

  // My requests counts per status
  const myRequests = wsRequests.filter((r) => r.employeeId === currentEmployee?.id);
  const myPending  = myRequests.filter((r) => r.status === "pending").length;

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSaveEmployee = async (
    data: Omit<HREmployee, "id" | "createdAt" | "updatedAt">
  ) => {
    if (selectedEmp) {
      await updateHREmployee(selectedEmp.id, data);
    } else {
      await createHREmployee(data);
    }
    setEmpFormOpen(false);
    setSelectedEmp(null);
  };

  const handleDeleteEmployee = async (id: string) => {
    deleteEmpStore(id);
    await deleteHREmployee(id);
  };

  const handleAddDepartment = async (name: string, color: string, parentId: string | null) => {
    await createHRDepartment({ workspaceId: activeWorkspaceId, name, color, parentId, sortOrder: departments.length });
  };

  const handleUpdateDepartment = async (id: string, patch: Partial<typeof departments[0]>) => {
    updateDepartment(id, patch);
    const dept = useHRStore.getState().departments.find((d) => d.id === id);
    if (dept) await pushHRDepartment({ ...dept, ...patch });
  };

  const handleDeleteDepartment = async (id: string) => {
    deleteDeptStore(id);
    await deleteHRDepartment(id);
  };

  const handleAddPosition = async (name: string, grade: number, departmentId: string | null) => {
    await createHRPosition({ workspaceId: activeWorkspaceId, name, grade, departmentId });
  };

  const handleUpdatePosition = async (id: string, patch: Partial<typeof positions[0]>) => {
    updatePosition(id, patch);
    const pos = useHRStore.getState().positions.find((p) => p.id === id);
    if (pos) await pushHRPosition({ ...pos, ...patch });
  };

  const handleDeletePosition = async (id: string) => {
    deletePosStore(id);
    await deleteHRPosition(id);
  };

  const handleToggleRequestType = async (id: string, isActive: boolean) => {
    updateRequestType(id, { isActive });
    const rt = useHRStore.getState().requestTypes.find((r) => r.id === id);
    if (rt) await pushHRRequestType({ ...rt, isActive });
  };

  const handleToggleHRAdmin = async (employeeId: string, isHrAdmin: boolean) => {
    await updateHREmployee(employeeId, { isHrAdmin });
  };

  const handleAddRequestType = async (input: Omit<HRRequestType, "id" | "createdAt">) => {
    await createHRRequestType(input);
  };

  const handleSubmitRequest = async (data: Omit<HRRequest, "id" | "createdAt" | "updatedAt">) => {
    await createHRRequest(data);
    setReqFormOpen(false);
  };

  const handleReview = async (id: string, status: "approved" | "rejected", notes: string) => {
    if (currentEmployee) {
      await reviewHRRequest(id, status, notes, currentEmployee.id);
    }
    setReqFormOpen(false);
    setSelectedReq(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-background" dir="rtl">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border/50 bg-card/80 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">الموارد البشرية</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {wsEmployees.filter((e) => e.status === "active").length} موظف نشط ·{" "}
            {departments.filter((d) => d.workspaceId === activeWorkspaceId).length} قسم
          </p>
        </div>
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border/50 bg-card/50 px-4">
        {TAB_ITEMS.map(({ key, labelAr, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "relative flex items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-medium transition border-b-2 -mb-px",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            )}
          >
            <Icon className="h-4 w-4" />
            {labelAr}
            {key === "requests" && pendingCount > 0 && (
              <span className="ms-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 font-micro text-[9px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">

        {/* ─── Employees tab ────────────────────────────────────────── */}
        {tab === "employees" && (
          <div className="flex h-full flex-col">
            {/* Filters bar */}
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3 bg-card/30">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <input
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="بحث بالاسم، الإيميل، رقم الموظف..."
                  className="w-full rounded-xl border border-border/50 bg-background/60 py-2 ps-9 pe-3 text-sm outline-none transition focus:border-primary/50"
                />
              </div>
              <DeptFilterSelect
                departments={departments.filter((d) => d.workspaceId === activeWorkspaceId)}
                value={empDeptFilter}
                onChange={setEmpDeptFilter}
              />
              <StatusFilterSelect value={empStatusFilter} onChange={setEmpStatusFilter} />
              {(isHrAdmin) && (
                <button
                  onClick={() => { setSelectedEmp(null); setEmpFormOpen(true); }}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  إضافة موظف
                </button>
              )}
            </div>

            {/* Employee table */}
            <div className="flex-1 overflow-auto">
              {filteredEmployees.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="لا يوجد موظفون"
                  description={empSearch || empDeptFilter ? "لا توجد نتائج للفلتر الحالي" : "ابدأ بإضافة الموظفين للمنشأة"}
                  action={isHrAdmin ? { label: "إضافة أول موظف", onClick: () => { setSelectedEmp(null); setEmpFormOpen(true); } } : undefined}
                />
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card/90 backdrop-blur-sm border-b border-border/40">
                    <tr>
                      <th className="py-3 pe-4 ps-6 text-start text-xs font-semibold text-muted-foreground/70">الموظف</th>
                      <th className="py-3 px-4 text-start text-xs font-semibold text-muted-foreground/70">القسم</th>
                      <th className="py-3 px-4 text-start text-xs font-semibold text-muted-foreground/70">المسمى الوظيفي</th>
                      <th className="py-3 px-4 text-start text-xs font-semibold text-muted-foreground/70">المدير المباشر</th>
                      <th className="py-3 px-4 text-start text-xs font-semibold text-muted-foreground/70">تاريخ الالتحاق</th>
                      <th className="py-3 px-4 text-start text-xs font-semibold text-muted-foreground/70">الموقع</th>
                      <th className="py-3 ps-4 pe-6 text-start text-xs font-semibold text-muted-foreground/70">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredEmployees.map((emp) => {
                      const dept = departments.find((d) => d.id === emp.departmentId);
                      const pos = positions.find((p) => p.id === emp.positionId);
                      const manager = wsEmployees.find((e) => e.id === emp.managerId);
                      const initials = emp.name.split(" ").slice(0, 2).map((w) => w[0]).join("");
                      const statusCfg = EMP_STATUS[emp.status];
                      return (
                        <tr
                          key={emp.id}
                          onClick={() => { setSelectedEmp(emp); setEmpFormOpen(true); }}
                          className="cursor-pointer transition hover:bg-secondary/40"
                        >
                          <td className="py-3 pe-4 ps-6">
                            <div className="flex items-center gap-3">
                              <div
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white ring-2 ring-border/30"
                                style={{ backgroundColor: dept?.color ?? "#0A4EFF" }}
                              >
                                {emp.avatarUrl ? (
                                  <img src={emp.avatarUrl} alt={emp.name} className="h-9 w-9 rounded-full object-cover" />
                                ) : (
                                  initials || <User className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium leading-tight">{emp.name}</p>
                                {emp.employeeNo && (
                                  <p className="font-mono text-[11px] text-muted-foreground">#{emp.employeeNo}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {dept ? (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                                style={{ backgroundColor: dept.color + "cc" }}
                              >
                                {dept.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {pos?.name ?? <span className="text-muted-foreground/30">—</span>}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {manager?.name ?? <span className="text-muted-foreground/30">—</span>}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground" dir="ltr">
                            {emp.hireDate
                              ? new Date(emp.hireDate).toLocaleDateString("ar-SA")
                              : <span className="text-muted-foreground/30">—</span>}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {emp.location ?? <span className="text-muted-foreground/30">—</span>}
                          </td>
                          <td className="py-3 ps-4 pe-6">
                            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", statusCfg.color)}>
                              {statusCfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ─── Org chart tab ────────────────────────────────────────── */}
        {tab === "org" && (
          <div className="flex h-full flex-col">
            {/* View toggle */}
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3 bg-card/30">
              <div className="flex rounded-xl border border-border/50 bg-background/40 p-0.5">
                <button
                  onClick={() => setOrgView("hierarchy")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    orgView === "hierarchy"
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  هيكل الإدارة
                </button>
                <button
                  onClick={() => setOrgView("departments")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    orgView === "departments"
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  الأقسام
                </button>
              </div>
              <span className="text-xs text-muted-foreground/60">
                {wsEmployees.filter((e) => e.status === "active").length} موظف نشط
              </span>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {orgView === "hierarchy" ? (
                <OrgChart
                  employees={wsEmployees}
                  departments={departments}
                  positions={positions}
                  onSelectEmployee={(emp) => { setSelectedEmp(emp); setEmpFormOpen(true); }}
                />
              ) : (
                <DeptOrgView
                  departments={departments.filter((d) => d.workspaceId === activeWorkspaceId)}
                  employees={wsEmployees}
                  positions={positions}
                  onSelectEmployee={(emp) => { setSelectedEmp(emp); setEmpFormOpen(true); }}
                />
              )}
            </div>
          </div>
        )}

        {/* ─── Requests tab ─────────────────────────────────────────── */}
        {tab === "requests" && (
          <div className="flex h-full flex-col">
            {/* Scope switcher + filters bar */}
            <div className="border-b border-border/40 bg-card/30">
              {/* Row 1: scope + new button */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                {/* طلباتي / الكل toggle — show "الكل" tab always for HR admins or when no employee record */}
                <div className="flex rounded-xl border border-border/50 bg-background/40 p-0.5">
                  {currentEmployee && (
                    <button
                      onClick={() => { setReqScope("mine"); setReqEmpFilter(""); }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                        effectiveScope === "mine"
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      طلباتي
                      {myPending > 0 && (
                        <span className={cn(
                          "grid h-4 min-w-4 place-items-center rounded-full px-1 font-micro text-[9px] font-bold",
                          effectiveScope === "mine" ? "bg-white/25 text-white" : "bg-amber-500 text-white"
                        )}>
                          {myPending}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setReqScope("all")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                      effectiveScope === "all"
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isHrAdmin ? "جميع الطلبات" : "الطلبات"}
                    {wsRequests.filter((r) => r.status === "pending").length > 0 && effectiveScope === "all" && (
                      <span className="grid h-4 min-w-4 place-items-center rounded-full px-1 font-micro text-[9px] font-bold bg-white/25 text-white">
                        {wsRequests.filter((r) => r.status === "pending").length}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex-1" />

                {/* زر "طلب جديد" يظهر لأي مستخدم مسجّل — يختار الموظف داخل النموذج */}
                {canUseHR && (
                  <button
                    onClick={() => { setSelectedReq(null); setReqFormOpen(true); }}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" />
                    طلب جديد
                  </button>
                )}
              </div>

              {/* Row 2: status filter pills + employee filter */}
              <div className="flex items-center gap-2 flex-wrap px-4 pb-3">
                <div className="flex gap-1 flex-wrap">
                  {(["all", "pending", "approved", "rejected", "cancelled"] as StatusFilter[]).map((s) => {
                    const cfg = s !== "all" ? STATUS_CONFIG[s] : null;
                    const base = effectiveScope === "mine" ? myRequests : wsRequests;
                    const count = s === "all" ? base.length : base.filter((r) => r.status === s).length;
                    return (
                      <button
                        key={s}
                        onClick={() => setReqStatusFilter(s)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition",
                          reqStatusFilter === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        )}
                      >
                        {cfg && <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />}
                        {s === "all" ? "الكل" : cfg?.label}
                        <span className="opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
                {effectiveScope === "all" && (
                  <select
                    value={reqEmpFilter}
                    onChange={(e) => setReqEmpFilter(e.target.value)}
                    className="rounded-xl border border-border/50 bg-background/60 px-3 py-1.5 text-xs outline-none focus:border-primary/50"
                  >
                    <option value="">جميع الموظفين</option>
                    {wsEmployees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                )}
              </div>
            </div>

            {/* Requests list */}
            <div className="flex-1 overflow-auto p-4">
              {filteredRequests.length === 0 ? (
                <EmptyState
                  icon={InboxIcon}
                  title="لا توجد طلبات"
                  description={reqStatusFilter !== "all" ? "لا توجد طلبات بهذه الحالة" : "لا توجد طلبات حتى الآن"}
                  action={currentEmployee ? { label: "تقديم طلب", onClick: () => { setSelectedReq(null); setReqFormOpen(true); } } : undefined}
                />
              ) : (
                <div className="space-y-2 max-w-3xl mx-auto">
                  {filteredRequests.map((req) => {
                    const emp = wsEmployees.find((e) => e.id === req.employeeId);
                    const type = requestTypes.find((rt) => rt.id === req.typeId);
                    const statusCfg = STATUS_CONFIG[req.status];
                    const initials = emp?.name.split(" ").slice(0, 2).map((w) => w[0]).join("") ?? "؟";
                    return (
                      <button
                        key={req.id}
                        onClick={() => { setSelectedReq(req); setReqFormOpen(true); }}
                        className="flex w-full items-center gap-4 rounded-2xl border border-border/50 bg-card px-4 py-3.5 text-start transition hover:border-primary/30 hover:shadow-sm"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{type?.nameAr ?? "طلب"}</span>
                            {req.status === "pending" && (
                              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                بانتظار المراجعة
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground mt-0.5">
                            {emp?.name ?? "موظف غير معروف"} ·{" "}
                            <span dir="ltr">
                              {new Date(req.createdAt).toLocaleDateString("ar-SA")}
                            </span>
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                            statusCfg.color
                          )}
                        >
                          {statusCfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Settings tab (HR admin only) ─────────────────────────── */}
        {tab === "settings" && (
          isHrAdmin ? (
            <HRSettings
              departments={departments.filter((d) => d.workspaceId === activeWorkspaceId)}
              positions={positions.filter((p) => p.workspaceId === activeWorkspaceId)}
              requestTypes={requestTypes.filter((rt) => rt.workspaceId === activeWorkspaceId)}
              employees={wsEmployees}
              workspaceId={activeWorkspaceId}
              onAddDepartment={handleAddDepartment}
              onUpdateDepartment={handleUpdateDepartment}
              onDeleteDepartment={handleDeleteDepartment}
              onAddPosition={handleAddPosition}
              onUpdatePosition={handleUpdatePosition}
              onDeletePosition={handleDeletePosition}
              onToggleRequestType={handleToggleRequestType}
              onAddRequestType={handleAddRequestType}
              onToggleHRAdmin={handleToggleHRAdmin}
            />
          ) : (
            <EmptyState
              icon={Settings2}
              title="الوصول محدود"
              description="فقط مسؤولو الموارد البشرية يمكنهم الوصول للإعدادات"
            />
          )
        )}
      </div>

      {/* ── Drawers ───────────────────────────────────────────────────── */}
      <EmployeeFormDrawer
        open={empFormOpen}
        mode={selectedEmp ? "edit" : "create"}
        employee={selectedEmp}
        departments={departments.filter((d) => d.workspaceId === activeWorkspaceId)}
        positions={positions.filter((p) => p.workspaceId === activeWorkspaceId)}
        employees={wsEmployees}
        workspaceId={activeWorkspaceId}
        onClose={() => { setEmpFormOpen(false); setSelectedEmp(null); }}
        onSave={handleSaveEmployee}
        onDelete={isHrAdmin ? handleDeleteEmployee : undefined}
      />

      <RequestFormDrawer
        open={reqFormOpen}
        requestTypes={requestTypes.filter((rt) => rt.workspaceId === activeWorkspaceId)}
        employees={wsEmployees}
        currentEmployeeId={currentEmployee?.id ?? null}
        workspaceId={activeWorkspaceId}
        editRequest={selectedReq}
        isHrAdmin={isHrAdmin}
        onClose={() => { setReqFormOpen(false); setSelectedReq(null); }}
        onSubmit={handleSubmitRequest}
        onReview={isHrAdmin ? handleReview : undefined}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-secondary/60">
        <Icon className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function DeptFilterSelect({
  departments,
  value,
  onChange,
}: {
  departments: Array<{ id: string; name: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-xs outline-none focus:border-primary/50"
    >
      <option value="">جميع الأقسام</option>
      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  );
}

function StatusFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: "all" | HREmployee["status"]) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as "all" | HREmployee["status"])}
      className="rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-xs outline-none focus:border-primary/50"
    >
      <option value="all">جميع الحالات</option>
      <option value="active">نشط</option>
      <option value="inactive">غير نشط</option>
      <option value="on_leave">في إجازة</option>
    </select>
  );
}
