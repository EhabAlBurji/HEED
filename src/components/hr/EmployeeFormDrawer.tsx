import { useState, useEffect } from "react";
import { X, User, Save, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button, Input } from "../ui/primitives";
import type { HREmployee, HRDepartment, HRPosition } from "../../stores/hrStore";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  employee?: HREmployee | null;
  departments: HRDepartment[];
  positions: HRPosition[];
  employees: HREmployee[]; // for manager select
  onClose: () => void;
  onSave: (data: Omit<HREmployee, "id" | "createdAt" | "updatedAt">) => void;
  onDelete?: (id: string) => void;
  workspaceId: string;
};

const STATUS_OPTIONS = [
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
  { value: "on_leave", label: "في إجازة" },
];

const LOCATIONS = ["الرياض","جدة","الدمام","المدينة المنورة","مكة المكرمة","أبها","تبوك","القصيم","حائل","أخرى"];

type FormState = {
  name: string;
  nameEn: string;
  employeeNo: string;
  email: string;
  phone: string;
  nationalId: string;
  departmentId: string;
  positionId: string;
  managerId: string;
  hireDate: string;
  location: string;
  status: HREmployee["status"];
  isHrAdmin: boolean;
};

const empty: FormState = {
  name: "",
  nameEn: "",
  employeeNo: "",
  email: "",
  phone: "",
  nationalId: "",
  departmentId: "",
  positionId: "",
  managerId: "",
  hireDate: "",
  location: "",
  status: "active",
  isHrAdmin: false,
};

function empToForm(e: HREmployee): FormState {
  return {
    name: e.name,
    nameEn: e.nameEn ?? "",
    employeeNo: e.employeeNo ?? "",
    email: e.email ?? "",
    phone: e.phone ?? "",
    nationalId: e.nationalId ?? "",
    departmentId: e.departmentId ?? "",
    positionId: e.positionId ?? "",
    managerId: e.managerId ?? "",
    hireDate: e.hireDate ?? "",
    location: e.location ?? "",
    status: e.status,
    isHrAdmin: e.isHrAdmin,
  };
}

export function EmployeeFormDrawer({
  open,
  mode,
  employee,
  departments,
  positions,
  employees,
  onClose,
  onSave,
  onDelete,
  workspaceId,
}: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(employee ? empToForm(employee) : empty);
      setConfirmDelete(false);
    }
  }, [open, employee]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  // Filter positions by selected department
  const filteredPositions = form.departmentId
    ? positions.filter((p) => !p.departmentId || p.departmentId === form.departmentId)
    : positions;

  // All other employees as potential managers
  const potentialManagers = employees.filter(
    (e) => e.workspaceId === workspaceId && e.id !== employee?.id
  );

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      workspaceId,
      userId: employee?.userId ?? null,
      employeeNo: form.employeeNo || null,
      name: form.name.trim(),
      nameEn: form.nameEn || null,
      email: form.email || null,
      phone: form.phone || null,
      nationalId: form.nationalId || null,
      avatarUrl: employee?.avatarUrl ?? null,
      departmentId: form.departmentId || null,
      positionId: form.positionId || null,
      managerId: form.managerId || null,
      hireDate: form.hireDate || null,
      location: form.location || null,
      status: form.status,
      isHrAdmin: form.isHrAdmin,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed inset-y-0 start-0 z-50 flex w-full max-w-md flex-col bg-card shadow-2xl"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <h2 className="text-base font-bold">
            {mode === "create" ? "إضافة موظف جديد" : "تعديل بيانات الموظف"}
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Avatar placeholder */}
        <div className="flex justify-center pt-5 pb-2">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/15 ring-4 ring-primary/10">
            {employee?.avatarUrl ? (
              <img src={employee.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-primary/60" />
            )}
          </div>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-none">

          {/* Section: البيانات الأساسية */}
          <Section title="البيانات الأساسية">
            <FormField label="الاسم الكامل *">
              <Input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="الاسم بالعربي"
              />
            </FormField>
            <FormField label="الاسم بالإنجليزية">
              <Input
                value={form.nameEn}
                onChange={(e) => set({ nameEn: e.target.value })}
                placeholder="Full name in English"
                dir="ltr"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="رقم الموظف">
                <Input
                  value={form.employeeNo}
                  onChange={(e) => set({ employeeNo: e.target.value })}
                  placeholder="مثال: 1001"
                  dir="ltr"
                />
              </FormField>
              <FormField label="رقم الهوية / الإقامة">
                <Input
                  value={form.nationalId}
                  onChange={(e) => set({ nationalId: e.target.value })}
                  placeholder="1xxxxxxxxx"
                  dir="ltr"
                />
              </FormField>
            </div>
          </Section>

          {/* Section: بيانات التواصل */}
          <Section title="بيانات التواصل">
            <FormField label="البريد الإلكتروني">
              <Input
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                placeholder="name@company.com"
                type="email"
                dir="ltr"
              />
            </FormField>
            <FormField label="رقم الجوال">
              <Input
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
                placeholder="+966 5x xxx xxxx"
                type="tel"
                dir="ltr"
              />
            </FormField>
          </Section>

          {/* Section: البيانات الوظيفية */}
          <Section title="البيانات الوظيفية">
            <FormField label="القسم">
              <select
                value={form.departmentId}
                onChange={(e) => set({ departmentId: e.target.value, positionId: "" })}
                className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-primary/50"
              >
                <option value="">اختر القسم</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="المسمى الوظيفي">
              <select
                value={form.positionId}
                onChange={(e) => set({ positionId: e.target.value })}
                className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-primary/50"
              >
                <option value="">اختر المسمى الوظيفي</option>
                {filteredPositions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="المدير المباشر">
              <select
                value={form.managerId}
                onChange={(e) => set({ managerId: e.target.value })}
                className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-primary/50"
              >
                <option value="">لا يوجد مدير مباشر</option>
                {potentialManagers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="تاريخ الالتحاق">
                <Input
                  type="date"
                  value={form.hireDate}
                  onChange={(e) => set({ hireDate: e.target.value })}
                  dir="ltr"
                />
              </FormField>
              <FormField label="الموقع">
                <select
                  value={form.location}
                  onChange={(e) => set({ location: e.target.value })}
                  className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-primary/50"
                >
                  <option value="">اختر الموقع</option>
                  {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="الحالة الوظيفية">
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set({ status: opt.value as HREmployee["status"] })}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-xs font-medium transition",
                      form.status === opt.value
                        ? "border-primary bg-primary text-white"
                        : "border-border/60 bg-background/40 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </FormField>
          </Section>

          {/* Section: الصلاحيات */}
          <Section title="الصلاحيات">
            <label className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-3 cursor-pointer select-none">
              <div>
                <p className="text-sm font-medium">مسؤول الموارد البشرية</p>
                <p className="text-[11px] text-muted-foreground">يمكنه إدارة الموظفين والموافقة على الطلبات</p>
              </div>
              <div
                dir="ltr"
                onClick={() => set({ isHrAdmin: !form.isHrAdmin })}
                className={cn(
                  "relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer",
                  form.isHrAdmin ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] duration-200",
                    form.isHrAdmin ? "left-4" : "left-0.5"
                  )}
                />
              </div>
            </label>
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 p-4 space-y-2">
          {mode === "edit" && onDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="flex-1 text-xs text-muted-foreground">حذف هذا الموظف نهائياً؟</p>
                <button
                  onClick={() => { onDelete(employee!.id); onClose(); }}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  حذف
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/70"
                >
                  تراجع
                </button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="w-full text-destructive/80 hover:text-destructive hover:bg-destructive/8"
              >
                <Trash2 className="h-3.5 w-3.5" />
                حذف الموظف
              </Button>
            )
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="md" onClick={onClose} className="flex-1">
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={!form.name.trim()}
              className="flex-1"
            >
              <Save className="h-4 w-4" />
              {mode === "create" ? "إضافة" : "حفظ"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/30 overflow-hidden">
      <div className="border-b border-border/40 bg-secondary/30 px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {title}
        </p>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground/80">{label}</label>
      {children}
    </div>
  );
}
