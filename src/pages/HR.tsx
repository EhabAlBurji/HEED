import { useState, useEffect, useMemo, useRef } from "react";
import {
  Users,
  GitBranch,
  InboxIcon,
  Settings2,
  BarChart2,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Loader2,
  RefreshCw,
  Link,
  TrendingUp,
  FileText,
  UserCheck,
  List,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";

function downloadCsv(filename: string, rows: string[][]) {
  const bom = "﻿"; // UTF-8 BOM for Arabic in Excel
  const csv = bom + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
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
import { seedDemoData, clearDemoData, isDemoSeeded } from "../lib/demoData";

type Tab = "employees" | "org" | "requests" | "settings" | "analytics";
type OrgView = "hierarchy" | "departments";
type StatusFilter = "all" | "pending" | "approved" | "rejected" | "cancelled";

const TAB_ITEMS: { key: Tab; labelAr: string; icon: React.ElementType }[] = [
  { key: "employees", labelAr: "الموظفون", icon: Users },
  { key: "org", labelAr: "الهيكل التنظيمي", icon: GitBranch },
  { key: "requests", labelAr: "الطلبات", icon: InboxIcon },
  { key: "settings", labelAr: "الإعدادات", icon: Settings2 },
  { key: "analytics", labelAr: "التحليلات", icon: BarChart2 },
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
  const [calendarView, setCalendarView] = useState(false);
  const [calViewDate, setCalViewDate] = useState(() => new Date());
  const [empFormOpen, setEmpFormOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<HREmployee | null>(null);
  const [reqFormOpen, setReqFormOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<HRRequest | null>(null);
  const [demoSeeded, setDemoSeeded] = useState(isDemoSeeded);

  const user = useAuthStore((s) => s.user);
  const { activeWorkspaceId, workspaces } = useWorkspaceStore();
  const {
    departments, positions, employees, requestTypes, requests, loading,
    updateDepartment, deleteDepartment: deleteDeptStore,
    updatePosition, deletePosition: deletePosStore,
    updateRequestType, deleteEmployee: deleteEmpStore,
  } = useHRStore();

  // Seed demo data only if the workspace has no real employees yet.
  // This prevents overwriting production data on first HR page visit.
  useEffect(() => {
    if (!activeWorkspaceId || user?.id === "guest") return;
    const t = setTimeout(() => {
      const hasRealData = employees.some((e) => e.workspaceId === activeWorkspaceId);
      if (!hasRealData && !isDemoSeeded()) {
        seedDemoData(activeWorkspaceId);
        setDemoSeeded(true);
      }
    }, 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, user?.id]);

  const handleResetDemo = () => {
    clearDemoData();
    // Clear HR store
    const hrStore = useHRStore.getState();
    hrStore.setEmployees([]);
    hrStore.setDepartments([]);
    hrStore.setPositions([]);
    hrStore.setRequests([]);
    // Re-seed after brief delay
    setTimeout(() => {
      seedDemoData(activeWorkspaceId);
      setDemoSeeded(true);
    }, 100);
  };

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

  // Workspace owner gets full HR admin access even without an employee record
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const isWorkspaceOwner = useMemo(() => {
    if (!user?.email || !activeWs) return false;
    return activeWs.members?.some(
      (m) => m.role === "owner" && m.email?.toLowerCase() === user.email?.toLowerCase()
    ) ?? activeWs.type === "personal"; // personal workspace owner is always admin
  }, [user?.email, activeWs]);

  const isHrAdmin = (currentEmployee?.isHrAdmin ?? false) || isWorkspaceOwner;
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
    // Workspace owners without an employee record can still approve — pass null as reviewerId
    // so the status change succeeds even if no hr_employees row is linked.
    const reviewerId = currentEmployee?.id ?? null;
    await reviewHRRequest(id, status, notes, reviewerId);
    setReqFormOpen(false);
    setSelectedReq(null);
  };

  const exportEmployees = () => {
    const headers = ["الاسم", "الاسم بالإنجليزية", "الرقم الوظيفي", "الإيميل", "الهاتف", "القسم", "المنصب", "تاريخ التعيين", "الحالة"];
    const rows = wsEmployees.map(e => [
      e.name, e.nameEn ?? "", e.employeeNo ?? "", e.email ?? "", e.phone ?? "",
      departments.find(d => d.id === e.departmentId)?.name ?? "",
      positions.find(p => p.id === e.positionId)?.name ?? "",
      e.hireDate ?? "", e.status
    ]);
    downloadCsv("employees.csv", [headers, ...rows]);
  };

  const exportRequests = () => {
    const headers = ["النوع", "الموظف", "الحالة", "التاريخ", "ملاحظات"];
    const rows = filteredRequests.map(r => [
      requestTypes.find(t => t.id === r.typeId)?.nameAr ?? "",
      employees.find(e => e.id === r.employeeId)?.name ?? "",
      r.status, r.createdAt.slice(0, 10), r.notes ?? ""
    ]);
    downloadCsv("requests.csv", [headers, ...rows]);
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
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {/* Demo reset — only shown when demo data is active */}
          {demoSeeded && (
            <button
              onClick={handleResetDemo}
              title="إعادة تحميل البيانات التجريبية"
              className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              إعادة الديمو
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border/50 bg-card/50 px-4 overflow-x-auto scrollbar-none">
        {TAB_ITEMS.map(({ key, labelAr, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-medium transition border-b-2 -mb-px touch-manipulation",
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
              <button
                onClick={exportEmployees}
                className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/60 px-3 py-2 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                title="تصدير CSV"
              >
                <Download className="h-3.5 w-3.5" />
                تصدير CSV
              </button>
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

            {/* Employee list — cards on mobile, table on desktop */}
            <div className="flex-1 overflow-auto">
              {filteredEmployees.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="لا يوجد موظفون"
                  description={empSearch || empDeptFilter ? "لا توجد نتائج للفلتر الحالي" : "ابدأ بإضافة الموظفين للمنشأة"}
                  action={isHrAdmin ? { label: "إضافة أول موظف", onClick: () => { setSelectedEmp(null); setEmpFormOpen(true); } } : undefined}
                />
              ) : (
                <>
                  {/* Mobile: card grid */}
                  <div className="grid grid-cols-1 gap-3 p-4 sm:hidden">
                    {filteredEmployees.map((emp) => {
                      const dept = departments.find((d) => d.id === emp.departmentId);
                      const pos = positions.find((p) => p.id === emp.positionId);
                      const initials = emp.name.split(" ").slice(0, 2).map((w) => w[0]).join("");
                      const statusCfg = EMP_STATUS[emp.status];
                      return (
                        <button
                          key={emp.id}
                          onClick={() => { setSelectedEmp(emp); setEmpFormOpen(true); }}
                          className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3.5 text-start transition hover:border-primary/30 touch-manipulation"
                        >
                          <div
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white ring-2 ring-border/30"
                            style={{ backgroundColor: dept?.color ?? "#0A4EFF" }}
                          >
                            {emp.avatarUrl ? (
                              <img src={emp.avatarUrl} alt={emp.name} className="h-11 w-11 rounded-full object-cover" />
                            ) : (
                              initials || <User className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{emp.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{pos?.name ?? "—"}</p>
                            {dept && (
                              <span
                                className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                                style={{ backgroundColor: dept.color + "cc" }}
                              >
                                {dept.name}
                              </span>
                            )}
                          </div>
                          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium", statusCfg.color)}>
                            {statusCfg.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Desktop: table */}
                  <table className="hidden w-full text-sm sm:table">
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
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-medium leading-tight">{emp.name}</p>
                                    {emp.userId && (
                                      <span title="مرتبط بحساب Heed" className="shrink-0">
                                        <Link className="h-3 w-3 text-primary/60" />
                                      </span>
                                    )}
                                  </div>
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
                </>
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

                {/* Calendar / List toggle */}
                <button
                  onClick={() => setCalendarView((v) => !v)}
                  title={calendarView ? "عرض القائمة" : "عرض التقويم"}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-xl border transition",
                    calendarView
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 bg-background/60 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  {calendarView ? <List className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                </button>

                <button
                  onClick={exportRequests}
                  className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/60 px-3 py-2 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  title="تصدير CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  تصدير CSV
                </button>

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

            {/* Requests list / calendar */}
            {calendarView ? (
              <LeaveCalendar
                requests={wsRequests}
                employees={wsEmployees}
                calViewDate={calViewDate}
                onChangeMonth={setCalViewDate}
                onSelectRequest={(req) => { setSelectedReq(req); setReqFormOpen(true); }}
              />
            ) : (
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
            )}
          </div>
        )}

        {/* ─── Analytics tab ────────────────────────────────────────── */}
        {tab === "analytics" && (
          <HRAnalytics
            employees={wsEmployees}
            departments={departments.filter((d) => d.workspaceId === activeWorkspaceId)}
            requests={wsRequests}
          />
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

// ── Leave Calendar Component ──────────────────────────────────────────────

const CAL_ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const CAL_DAY_SHORT = ["أح", "إث", "ثل", "أر", "خم", "جم", "سب"];

// Pill colours cycling through a palette for different employees
const PILL_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-pink-500",
];

function getLeaveRange(req: HRRequest): { start: Date; end: Date } | null {
  const d = req.data as Record<string, unknown>;
  // Support both snake_case (start_date) and camelCase (startDate)
  const startStr = (d.start_date ?? d.startDate) as string | undefined;
  const endStr   = (d.end_date   ?? d.endDate)   as string | undefined;
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end   = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { start, end };
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function LeaveCalendar({
  requests,
  employees,
  calViewDate,
  onChangeMonth,
  onSelectRequest,
}: {
  requests: HRRequest[];
  employees: HREmployee[];
  calViewDate: Date;
  onChangeMonth: (d: Date) => void;
  onSelectRequest: (req: HRRequest) => void;
}) {
  const [popoverDay, setPopoverDay] = useState<Date | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverDay(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const year  = calViewDate.getFullYear();
  const month = calViewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  // Calendar starts on Sunday (0); offset = day-of-week of 1st
  const startOffset = firstDay.getDay(); // 0=Sun … 6=Sat
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build 6-row × 7-col grid of Date | null
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  // Only approved leave requests with a date range
  const leaveRequests = requests.filter((r) => r.status === "approved" && getLeaveRange(r) !== null);

  // Map employeeId -> colour index (stable per unique employee)
  const empColorMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const req of leaveRequests) {
      if (req.employeeId && !map.has(req.employeeId)) {
        map.set(req.employeeId, idx % PILL_COLORS.length);
        idx++;
      }
    }
    return map;
  }, [leaveRequests]);

  // Which requests fall on a given day
  function requestsOnDay(day: Date): HRRequest[] {
    return leaveRequests.filter((req) => {
      const range = getLeaveRange(req);
      if (!range) return false;
      // Normalise to midnight for comparison
      const start = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
      const end   = new Date(range.end.getFullYear(),   range.end.getMonth(),   range.end.getDate());
      const d     = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      return d >= start && d <= end;
    });
  }

  const today = new Date();
  const popoverRequests = popoverDay ? requestsOnDay(popoverDay) : [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/20">
        <button
          onClick={() => onChangeMonth(new Date(year, month - 1, 1))}
          className="grid h-8 w-8 place-items-center rounded-xl border border-border/50 bg-background/60 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold">
          {CAL_ARABIC_MONTHS[month]} {year}
        </h3>
        <button
          onClick={() => onChangeMonth(new Date(year, month + 1, 1))}
          className="grid h-8 w-8 place-items-center rounded-xl border border-border/50 bg-background/60 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-border/30 bg-secondary/20 text-center">
        {CAL_DAY_SHORT.map((d) => (
          <div key={d} className="py-2 text-[10px] font-semibold text-muted-foreground/70">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 divide-x divide-y divide-border/20 rtl:divide-x-reverse" style={{ gridAutoRows: "minmax(72px, 1fr)" }}>
          {cells.map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} className="bg-secondary/10" />;
            }
            const isToday = sameDay(day, today);
            const dayRequests = requestsOnDay(day);
            const isPopoverOpen = popoverDay ? sameDay(day, popoverDay) : false;

            return (
              <div
                key={day.toISOString()}
                onClick={() => {
                  if (dayRequests.length > 0) {
                    setPopoverDay(isPopoverOpen ? null : day);
                  }
                }}
                className={cn(
                  "relative flex flex-col gap-0.5 p-1.5 transition",
                  dayRequests.length > 0 ? "cursor-pointer hover:bg-primary/5" : "cursor-default",
                  isPopoverOpen && "ring-2 ring-inset ring-primary/30 bg-primary/5"
                )}
              >
                {/* Day number */}
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium self-end leading-none",
                    isToday ? "bg-primary text-white font-bold" : "text-foreground/80"
                  )}
                >
                  {day.getDate()}
                </span>

                {/* Leave pills */}
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {dayRequests.slice(0, 3).map((req) => {
                    const emp = employees.find((e) => e.id === req.employeeId);
                    const initials = emp?.name.split(" ").slice(0, 2).map((w) => w[0]).join("") ?? "؟";
                    const colorCls = PILL_COLORS[empColorMap.get(req.employeeId ?? "") ?? 0];
                    return (
                      <span
                        key={req.id}
                        className={cn(
                          "truncate rounded px-1 text-[9px] font-semibold text-white leading-4",
                          colorCls
                        )}
                        title={emp?.name}
                      >
                        {initials}
                      </span>
                    );
                  })}
                  {dayRequests.length > 3 && (
                    <span className="text-[9px] text-muted-foreground ps-0.5">+{dayRequests.length - 3}</span>
                  )}
                </div>

                {/* Popover */}
                {isPopoverOpen && (
                  <div
                    ref={popoverRef}
                    className="absolute top-full start-0 z-50 mt-1 w-52 rounded-2xl border border-border/60 bg-card shadow-xl p-3 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                      {day.toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    {popoverRequests.map((req) => {
                      const emp = employees.find((e) => e.id === req.employeeId);
                      const colorCls = PILL_COLORS[empColorMap.get(req.employeeId ?? "") ?? 0];
                      const range = getLeaveRange(req);
                      return (
                        <button
                          key={req.id}
                          onClick={() => { setPopoverDay(null); onSelectRequest(req); }}
                          className="flex w-full items-center gap-2 rounded-xl border border-border/40 bg-background/60 px-2.5 py-2 text-start transition hover:border-primary/30 hover:bg-primary/5"
                        >
                          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white", colorCls)}>
                            {emp?.name.split(" ").slice(0, 2).map((w) => w[0]).join("") ?? "؟"}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium leading-tight">{emp?.name ?? "موظف"}</p>
                            {range && (
                              <p className="text-[9px] text-muted-foreground leading-tight" dir="ltr">
                                {range.start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                {" → "}
                                {range.end.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {leaveRequests.length === 0 && (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          لا توجد إجازات موافق عليها هذا الشهر
        </div>
      )}
    </div>
  );
}

// ── Analytics Component ───────────────────────────────────────────────────

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const STATUS_BAR_COLORS: Record<string, string> = {
  pending:   "#f59e0b",
  approved:  "#10b981",
  rejected:  "#ef4444",
  cancelled: "#9ca3af",
};

const STATUS_LABELS_AR: Record<string, string> = {
  pending:   "في الانتظار",
  approved:  "موافق",
  rejected:  "مرفوض",
  cancelled: "ملغي",
};

function HRAnalytics({
  employees,
  departments,
  requests,
}: {
  employees: import("../stores/hrStore").HREmployee[];
  departments: import("../stores/hrStore").HRDepartment[];
  requests: import("../stores/hrStore").HRRequest[];
}) {
  // ── Chart 1: Employees by Department ──────────────────────────────────
  const deptPieData = useMemo(() => {
    return departments
      .map((d) => ({
        name: d.name,
        value: employees.filter((e) => e.departmentId === d.id).length,
        color: d.color,
      }))
      .filter((d) => d.value > 0);
  }, [departments, employees]);

  // ── Chart 2: Requests by Status ────────────────────────────────────────
  const statusBarData = useMemo(() => {
    return (["pending", "approved", "rejected", "cancelled"] as const).map((s) => ({
      status: STATUS_LABELS_AR[s],
      count: requests.filter((r) => r.status === s).length,
      fill: STATUS_BAR_COLORS[s],
    }));
  }, [requests]);

  // ── Chart 3: Requests over last 6 months ──────────────────────────────
  const lineData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const count = requests.filter((r) => {
        const rd = new Date(r.createdAt);
        return rd.getFullYear() === year && rd.getMonth() === month;
      }).length;
      return { month: ARABIC_MONTHS[month], count };
    });
  }, [requests]);

  // ── Key stats ─────────────────────────────────────────────────────────
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === "active").length;
  const pendingRequests = requests.filter((r) => r.status === "pending").length;
  const now = new Date();
  const thisMonthRequests = requests.filter((r) => {
    const d = new Date(r.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const statCards = [
    { label: "إجمالي الموظفين", value: totalEmployees, icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: "الموظفون النشطون", value: activeEmployees, icon: UserCheck, color: "bg-emerald-50 text-emerald-600" },
    { label: "الطلبات المعلقة", value: pendingRequests, icon: Clock, color: "bg-amber-50 text-amber-600" },
    { label: "طلبات هذا الشهر", value: thisMonthRequests, icon: FileText, color: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* ── Stats cards row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-border/50 bg-card px-5 py-4 flex items-center gap-4"
          >
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two charts side by side ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie: Employees by Department */}
        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">الموظفون حسب القسم</h3>
          </div>
          {deptPieData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              لا توجد بيانات
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={deptPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  labelLine={false}
                >
                  {deptPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar: Requests by Status */}
        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">الطلبات حسب الحالة</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusBarData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="status"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {statusBarData.map((entry, index) => (
                  <Cell key={`cell-bar-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Line chart: Requests over time ──────────────────────────── */}
      <div className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">الطلبات خلال آخر 6 أشهر</h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={lineData} margin={{ top: 4, right: 16, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#0A4EFF"
              strokeWidth={2}
              dot={{ r: 4, fill: "#0A4EFF" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
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
