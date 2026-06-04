import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Types ──────────────────────────────────────────────────────────────────

export type HRDepartment = {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
};

export type HRPosition = {
  id: string;
  workspaceId: string;
  name: string;
  grade: number; // 1=executive 2=director 3=manager 4=senior 5=staff
  departmentId: string | null;
  createdAt: string;
};

export type HREmployee = {
  id: string;
  workspaceId: string;
  userId: string | null;
  employeeNo: string | null;
  name: string;
  nameEn: string | null;
  email: string | null;
  phone: string | null;
  nationalId: string | null;
  avatarUrl: string | null;
  departmentId: string | null;
  positionId: string | null;
  managerId: string | null;
  hireDate: string | null;
  location: string | null;
  status: "active" | "inactive" | "on_leave";
  isHrAdmin: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HRFieldDef = {
  key: string;
  labelAr: string;
  type: "text" | "date" | "date_range" | "select" | "number" | "textarea" | "toggle" | "items_table";
  required: boolean;
  options?: string[];
};

export type HRRequestType = {
  id: string;
  workspaceId: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  fields: HRFieldDef[];
  needsAttach: boolean;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
  createdAt: string;
};

export type HRRequestAttachment = {
  name: string;
  url: string;
  size: number;
};

export type HRRequest = {
  id: string;
  workspaceId: string;
  employeeId: string | null;
  typeId: string | null;
  data: Record<string, unknown>;
  attachments: HRRequestAttachment[];
  status: "pending" | "approved" | "rejected" | "cancelled";
  notes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── Default request types (seeded on first workspace use) ─────────────────

export const DEFAULT_REQUEST_TYPES: Omit<HRRequestType, "id" | "workspaceId" | "createdAt">[] = [
  {
    nameAr: "طلب إجازة",
    nameEn: "Leave Request",
    icon: "Palmtree",
    isSystem: true,
    isActive: true,
    sortOrder: 0,
    needsAttach: false,
    fields: [
      { key: "leave_type", labelAr: "النوع", type: "select", required: true, options: ["سنوية","مرضية","طارئة","بدون راتب","أمومة","أبوة"] },
      { key: "start_date", labelAr: "تبدأ الإجازة في", type: "date", required: true },
      { key: "end_date", labelAr: "تنتهي الإجازة في", type: "date", required: true },
      { key: "exit_reentry", labelAr: "تأشيرة خروج وعودة", type: "toggle", required: false },
      { key: "reason", labelAr: "السبب", type: "textarea", required: false },
    ],
  },
  {
    nameAr: "طلب مصاريف مالية",
    nameEn: "Expense Request",
    icon: "ReceiptText",
    isSystem: true,
    isActive: true,
    sortOrder: 1,
    needsAttach: true,
    fields: [
      { key: "expense_items", labelAr: "عناصر المصاريف", type: "items_table", required: true },
      { key: "reason", labelAr: "السبب", type: "textarea", required: false },
    ],
  },
  {
    nameAr: "طلب عُهدة",
    nameEn: "Equipment Request",
    icon: "Package",
    isSystem: true,
    isActive: true,
    sortOrder: 2,
    needsAttach: false,
    fields: [
      { key: "request_subtype", labelAr: "نوع الطلب", type: "select", required: true, options: ["طلب عُهدة","إعادة عُهدة","صيانة"] },
      { key: "equipment_type", labelAr: "نوع العهدة", type: "select", required: true, options: ["حاسوب","هاتف","سيارة","مكتب","أخرى"] },
      { key: "reason", labelAr: "السبب", type: "textarea", required: false },
    ],
  },
  {
    nameAr: "طلب سلفة",
    nameEn: "Advance Request",
    icon: "Banknote",
    isSystem: true,
    isActive: true,
    sortOrder: 3,
    needsAttach: false,
    fields: [
      { key: "advance_type", labelAr: "النوع", type: "select", required: true, options: ["سلفة راتب","سلفة أخرى"] },
      { key: "amount", labelAr: "المبلغ", type: "number", required: true },
      { key: "deduction_start", labelAr: "بداية إستقطاع الخصم (شهر)", type: "date", required: true },
      { key: "guarantors", labelAr: "أسماء الضامنين", type: "text", required: false },
      { key: "installment", labelAr: "القسط الشهري", type: "number", required: false },
      { key: "reason", labelAr: "السبب", type: "textarea", required: false },
    ],
  },
  {
    nameAr: "طلب خطاب",
    nameEn: "Letter Request",
    icon: "FileSignature",
    isSystem: true,
    isActive: true,
    sortOrder: 4,
    needsAttach: false,
    fields: [
      { key: "letter_type", labelAr: "نوع الخطاب", type: "text", required: true },
      { key: "recipient", labelAr: "اسم الجهة الموجه لها (اختياري)", type: "text", required: false },
      { key: "needs_certification", labelAr: "هل يحتاج تصديق", type: "select", required: true, options: ["نعم","لا"] },
      { key: "notes", labelAr: "ملاحظات (اختياري)", type: "textarea", required: false },
    ],
  },
  {
    nameAr: "طلب تصديق معاملة / مستند",
    nameEn: "Document Authentication",
    icon: "Stamp",
    isSystem: true,
    isActive: true,
    sortOrder: 5,
    needsAttach: true,
    fields: [
      { key: "request_type", labelAr: "نوع الطلب", type: "text", required: true },
      { key: "transaction_no", labelAr: "رقم المعاملة إن وجد (اختياري)", type: "text", required: false },
    ],
  },
  {
    nameAr: "طلب خروج وعودة",
    nameEn: "Exit & Re-entry",
    icon: "PlaneTakeoff",
    isSystem: true,
    isActive: true,
    sortOrder: 6,
    needsAttach: false,
    fields: [
      { key: "visa_type", labelAr: "نوعها", type: "select", required: true, options: ["فردية","متعددة","عائلية"] },
      { key: "duration", labelAr: "مدتها", type: "text", required: true },
      { key: "payment_status", labelAr: "حالة السداد (اختياري)", type: "select", required: false, options: ["مسدد","لم يُسدد بعد"] },
      { key: "travel_date", labelAr: "تاريخ السفر (اختياري)", type: "date", required: false },
    ],
  },
  {
    nameAr: "طلب الالتحاق بتدريب",
    nameEn: "Training Request",
    icon: "GraduationCap",
    isSystem: true,
    isActive: true,
    sortOrder: 7,
    needsAttach: false,
    fields: [
      { key: "training_name", labelAr: "اسم التدريب", type: "text", required: true },
      { key: "location", labelAr: "مكان انعقاد التدريب - حضوري (اختياري)", type: "text", required: false },
      { key: "start_date", labelAr: "تاريخ بداية التدريب", type: "date", required: true },
      { key: "end_date", labelAr: "تاريخ نهاية التدريب", type: "date", required: true },
      { key: "cost", labelAr: "التكلفة", type: "number", required: false },
      { key: "notes", labelAr: "ملاحظات اضافية (اختياري)", type: "textarea", required: false },
    ],
  },
  {
    nameAr: "طلب مهمة عمل",
    nameEn: "Work Assignment",
    icon: "Briefcase",
    isSystem: true,
    isActive: true,
    sortOrder: 8,
    needsAttach: false,
    fields: [
      { key: "destination", labelAr: "الوجهة", type: "text", required: true },
      { key: "start_date", labelAr: "تاريخ البداية", type: "date", required: true },
      { key: "end_date", labelAr: "تاريخ النهاية", type: "date", required: true },
      { key: "purpose", labelAr: "الغرض من المهمة", type: "textarea", required: true },
      { key: "notes", labelAr: "ملاحظات (اختياري)", type: "textarea", required: false },
    ],
  },
];

// ── Store ─────────────────────────────────────────────────────────────────

type HRState = {
  departments: HRDepartment[];
  positions: HRPosition[];
  employees: HREmployee[];
  requestTypes: HRRequestType[];
  requests: HRRequest[];
  loading: boolean;

  setLoading: (v: boolean) => void;
  setDepartments: (d: HRDepartment[]) => void;
  setPositions: (p: HRPosition[]) => void;
  setEmployees: (e: HREmployee[]) => void;
  setRequestTypes: (rt: HRRequestType[]) => void;
  setRequests: (r: HRRequest[]) => void;

  addDepartment: (d: HRDepartment) => void;
  updateDepartment: (id: string, patch: Partial<HRDepartment>) => void;
  deleteDepartment: (id: string) => void;

  addPosition: (p: HRPosition) => void;
  updatePosition: (id: string, patch: Partial<HRPosition>) => void;
  deletePosition: (id: string) => void;

  addEmployee: (e: HREmployee) => void;
  updateEmployee: (id: string, patch: Partial<HREmployee>) => void;
  deleteEmployee: (id: string) => void;

  addRequestType: (rt: HRRequestType) => void;
  updateRequestType: (id: string, patch: Partial<HRRequestType>) => void;
  deleteRequestType: (id: string) => void;

  addRequest: (r: HRRequest) => void;
  updateRequest: (id: string, patch: Partial<HRRequest>) => void;
  deleteRequest: (id: string) => void;
};

export const useHRStore = create<HRState>()(
  persist(
    (set) => ({
      departments: [],
      positions: [],
      employees: [],
      requestTypes: [],
      requests: [],
      loading: false,

      setLoading: (loading) => set({ loading }),
      setDepartments: (departments) => set({ departments }),
      setPositions: (positions) => set({ positions }),
      setEmployees: (employees) => set({ employees }),
      setRequestTypes: (requestTypes) => set({ requestTypes }),
      setRequests: (requests) => set({ requests }),

      addDepartment: (d) => set((s) => ({ departments: [...s.departments, d] })),
      updateDepartment: (id, patch) =>
        set((s) => ({ departments: s.departments.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
      deleteDepartment: (id) =>
        set((s) => ({ departments: s.departments.filter((d) => d.id !== id) })),

      addPosition: (p) => set((s) => ({ positions: [...s.positions, p] })),
      updatePosition: (id, patch) =>
        set((s) => ({ positions: s.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePosition: (id) =>
        set((s) => ({ positions: s.positions.filter((p) => p.id !== id) })),

      addEmployee: (e) => set((s) => ({ employees: [...s.employees, e] })),
      updateEmployee: (id, patch) =>
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
          ),
        })),
      deleteEmployee: (id) =>
        set((s) => ({ employees: s.employees.filter((e) => e.id !== id) })),

      addRequestType: (rt) => set((s) => ({ requestTypes: [...s.requestTypes, rt] })),
      updateRequestType: (id, patch) =>
        set((s) => ({
          requestTypes: s.requestTypes.map((rt) => (rt.id === id ? { ...rt, ...patch } : rt)),
        })),
      deleteRequestType: (id) =>
        set((s) => ({ requestTypes: s.requestTypes.filter((rt) => rt.id !== id) })),

      addRequest: (r) => set((s) => ({ requests: [...s.requests, r] })),
      updateRequest: (id, patch) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
          ),
        })),
      deleteRequest: (id) =>
        set((s) => ({ requests: s.requests.filter((r) => r.id !== id) })),
    }),
    { name: "heed-hr" }
  )
);

// ── Selectors ─────────────────────────────────────────────────────────────

export const selectDeptEmployees = (employees: HREmployee[], deptId: string) =>
  employees.filter((e) => e.departmentId === deptId && e.status === "active");

export const selectDirectReports = (employees: HREmployee[], managerId: string) =>
  employees.filter((e) => e.managerId === managerId);

export const selectTopLevel = (employees: HREmployee[], workspaceId: string) =>
  employees.filter((e) => e.workspaceId === workspaceId && !e.managerId && e.status === "active");
