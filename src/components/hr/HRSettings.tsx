import { useState } from "react";
import { Plus, Trash2, Edit3, Check, X, Shield, GripVertical } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button, Input } from "../ui/primitives";
import type { HRDepartment, HRPosition, HRRequestType, HREmployee, HRFieldDef } from "../../stores/hrStore";

type Props = {
  departments: HRDepartment[];
  positions: HRPosition[];
  requestTypes: HRRequestType[];
  employees: HREmployee[];
  workspaceId: string;
  onAddDepartment: (name: string, color: string, parentId: string | null) => void;
  onUpdateDepartment: (id: string, patch: Partial<HRDepartment>) => void;
  onDeleteDepartment: (id: string) => void;
  onAddPosition: (name: string, grade: number, departmentId: string | null) => void;
  onUpdatePosition: (id: string, patch: Partial<HRPosition>) => void;
  onDeletePosition: (id: string) => void;
  onToggleRequestType: (id: string, isActive: boolean) => void;
  onAddRequestType: (input: Omit<HRRequestType, "id" | "createdAt">) => void;
  onToggleHRAdmin: (employeeId: string, isHrAdmin: boolean) => void;
};

const DEPT_COLORS = ["#0A4EFF","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#EC4899","#84CC16"];

const GRADE_LABELS: Record<number, string> = {
  1: "تنفيذي (CEO)", 2: "مدير إدارة", 3: "مدير", 4: "أخصائي أول", 5: "موظف",
};

const FIELD_TYPES: { value: HRFieldDef["type"]; label: string }[] = [
  { value: "text",        label: "نص قصير" },
  { value: "textarea",    label: "نص طويل" },
  { value: "number",      label: "رقم" },
  { value: "date",        label: "تاريخ" },
  { value: "select",      label: "قائمة اختيار" },
  { value: "toggle",      label: "نعم / لا" },
  { value: "items_table", label: "جدول عناصر (مصاريف)" },
];

const ICONS = [
  { key: "FileText",    emoji: "📄" }, { key: "Palmtree",    emoji: "🌴" },
  { key: "ReceiptText", emoji: "🧾" }, { key: "Package",     emoji: "📦" },
  { key: "Banknote",    emoji: "💵" }, { key: "FileSignature", emoji: "📝" },
  { key: "Stamp",       emoji: "🔏" }, { key: "PlaneTakeoff", emoji: "✈️" },
  { key: "GraduationCap", emoji: "🎓" }, { key: "Briefcase", emoji: "💼" },
  { key: "Car",         emoji: "🚗" }, { key: "Star",        emoji: "⭐" },
];
const iconEmoji = (k: string) => ICONS.find((i) => i.key === k)?.emoji ?? "📄";

type SettingsTab = "departments" | "positions" | "request_types" | "hr_admins";

export function HRSettings({
  departments, positions, requestTypes, employees, workspaceId,
  onAddDepartment, onUpdateDepartment, onDeleteDepartment,
  onAddPosition, onUpdatePosition, onDeletePosition,
  onToggleRequestType, onAddRequestType, onToggleHRAdmin,
}: Props) {
  const [tab, setTab] = useState<SettingsTab>("departments");

  const TABS: { key: SettingsTab; label: string }[] = [
    { key: "departments",  label: "الأقسام" },
    { key: "positions",    label: "المسميات" },
    { key: "request_types", label: "أنواع الطلبات" },
    { key: "hr_admins",   label: "مسؤولو HR" },
  ];

  return (
    <div className="flex h-full flex-col" dir="rtl">
      <div className="flex gap-1 border-b border-border/50 bg-card/50 px-4 pt-2">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("rounded-t-lg border-b-2 -mb-px px-3 py-2.5 text-xs font-medium transition",
              tab === key ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            )}
          >{label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 scrollbar-none">
        {tab === "departments"  && <DepartmentsTab departments={departments} onAdd={onAddDepartment} onUpdate={onUpdateDepartment} onDelete={onDeleteDepartment} />}
        {tab === "positions"    && <PositionsTab positions={positions} departments={departments} onAdd={onAddPosition} onUpdate={onUpdatePosition} onDelete={onDeletePosition} />}
        {tab === "request_types" && <RequestTypesTab requestTypes={requestTypes} workspaceId={workspaceId} onToggle={onToggleRequestType} onAdd={onAddRequestType} />}
        {tab === "hr_admins"    && <HRAdminsTab employees={employees} onToggle={onToggleHRAdmin} />}
      </div>
    </div>
  );
}

// ── Departments ───────────────────────────────────────────────────────────

function DepartmentsTab({ departments, onAdd, onUpdate, onDelete }: {
  departments: HRDepartment[];
  onAdd: (n: string, c: string, p: string | null) => void;
  onUpdate: (id: string, p: Partial<HRDepartment>) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding]     = useState(false);
  const [newName, setNewName]   = useState("");
  const [newColor, setNewColor] = useState(DEPT_COLORS[0]);
  const [newParent, setNewParent] = useState("");
  const [editId, setEditId]     = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const rootDepts = departments.filter((d) => !d.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const children  = (pid: string) => departments.filter((d) => d.parentId === pid);

  const renderDept = (dept: HRDepartment, depth = 0): React.ReactNode => (
    <div key={dept.id}>
      <div className={cn("group flex items-center gap-2 rounded-xl px-3 py-2.5 transition hover:bg-secondary/60", depth > 0 && "ms-5 border-s-2 border-border/30 rounded-s-none ps-3")}>
        <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: dept.color }} />
        {editId === dept.id ? (
          <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(dept.id, { name: editName.trim() }); setEditId(null); } if (e.key === "Escape") setEditId(null); }}
            className="flex-1 rounded-lg border border-primary/50 bg-background px-2 py-1 text-sm outline-none" />
        ) : (
          <span className="flex-1 text-sm font-medium">{dept.name}</span>
        )}
        <span className="text-[10px] text-muted-foreground/40">{children(dept.id).length > 0 ? `${children(dept.id).length} فرعي` : ""}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {editId === dept.id ? (
            <>
              <button onClick={() => { onUpdate(dept.id, { name: editName.trim() }); setEditId(null); }} className="grid h-6 w-6 place-items-center rounded-md bg-primary/20 text-primary hover:bg-primary/30"><Check className="h-3 w-3" /></button>
              <button onClick={() => setEditId(null)} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary"><X className="h-3 w-3" /></button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditId(dept.id); setEditName(dept.name); }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-secondary"><Edit3 className="h-3 w-3" /></button>
              {confirmDel === dept.id ? (
                <>
                  <button onClick={() => { onDelete(dept.id); setConfirmDel(null); }} className="rounded-md bg-destructive px-2 py-0.5 text-[10px] text-white">حذف</button>
                  <button onClick={() => setConfirmDel(null)} className="rounded-md bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">تراجع</button>
                </>
              ) : (
                <button onClick={() => setConfirmDel(dept.id)} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
              )}
            </>
          )}
        </div>
      </div>
      {children(dept.id).map((c) => renderDept(c, depth + 1))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        {rootDepts.map((d) => renderDept(d))}
        {departments.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground/50">لا توجد أقسام بعد.</p>}
      </div>
      {adding ? (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-primary">قسم جديد</p>
          <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) { onAdd(newName.trim(), newColor, newParent || null); setNewName(""); setAdding(false); } if (e.key === "Escape") setAdding(false); }}
            placeholder="اسم القسم" />
          <div className="flex flex-wrap gap-1.5">
            {DEPT_COLORS.map((c) => (
              <button key={c} onClick={() => setNewColor(c)}
                className={cn("h-6 w-6 rounded-full transition-all", newColor === c && "ring-2 ring-white ring-offset-1 ring-offset-background shadow-md")}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <select value={newParent} onChange={(e) => setNewParent(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/50">
            <option value="">قسم رئيسي (بدون أب)</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => { if (newName.trim()) { onAdd(newName.trim(), newColor, newParent || null); setNewName(""); setAdding(false); } }} disabled={!newName.trim()} className="flex-1">إضافة</Button>
            <Button variant="outline" size="sm" onClick={() => setAdding(false)} className="flex-1">إلغاء</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full border-dashed"><Plus className="h-3.5 w-3.5" />إضافة قسم</Button>
      )}
    </div>
  );
}

// ── Positions ─────────────────────────────────────────────────────────────

function PositionsTab({ positions, departments, onAdd, onUpdate, onDelete }: {
  positions: HRPosition[];
  departments: HRDepartment[];
  onAdd: (n: string, g: number, d: string | null) => void;
  onUpdate: (id: string, p: Partial<HRPosition>) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGrade, setNewGrade] = useState(3);
  const [newDept, setNewDept] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const sorted = [...positions].sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, "ar"));

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {sorted.map((pos) => {
          const dept = departments.find((d) => d.id === pos.departmentId);
          return (
            <div key={pos.id} className="group flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{pos.grade}</span>
              {editId === pos.id ? (
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(pos.id, { name: editName.trim() }); setEditId(null); } if (e.key === "Escape") setEditId(null); }}
                  className="flex-1 rounded-lg border border-primary/50 bg-background px-2 py-1 text-sm outline-none" />
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{pos.name}</p>
                  {dept && <p className="text-[10px] text-muted-foreground">{dept.name}</p>}
                </div>
              )}
              <span className="shrink-0 text-[10px] text-muted-foreground/50">{GRADE_LABELS[pos.grade]}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {editId === pos.id ? (
                  <>
                    <button onClick={() => { onUpdate(pos.id, { name: editName.trim() }); setEditId(null); }} className="grid h-6 w-6 place-items-center rounded-md bg-primary/20 text-primary"><Check className="h-3 w-3" /></button>
                    <button onClick={() => setEditId(null)} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary"><X className="h-3 w-3" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditId(pos.id); setEditName(pos.name); }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-secondary"><Edit3 className="h-3 w-3" /></button>
                    {confirmDel === pos.id ? (
                      <>
                        <button onClick={() => { onDelete(pos.id); setConfirmDel(null); }} className="rounded-md bg-destructive px-2 py-0.5 text-[10px] text-white">حذف</button>
                        <button onClick={() => setConfirmDel(null)} className="rounded-md bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">تراجع</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDel(pos.id)} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {positions.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground/50">لا توجد مسميات وظيفية بعد.</p>}
      </div>
      {adding ? (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-primary">مسمى وظيفي جديد</p>
          <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم المسمى الوظيفي" />
          <select value={newGrade} onChange={(e) => setNewGrade(Number(e.target.value))}
            className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/50">
            {Object.entries(GRADE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={newDept} onChange={(e) => setNewDept(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/50">
            <option value="">لا يخص قسم محدد</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => { if (newName.trim()) { onAdd(newName.trim(), newGrade, newDept || null); setNewName(""); setAdding(false); } }} disabled={!newName.trim()} className="flex-1">إضافة</Button>
            <Button variant="outline" size="sm" onClick={() => setAdding(false)} className="flex-1">إلغاء</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full border-dashed"><Plus className="h-3.5 w-3.5" />إضافة مسمى</Button>
      )}
    </div>
  );
}

// ── Request Types ─────────────────────────────────────────────────────────

type NewFieldState = { labelAr: string; type: HRFieldDef["type"]; required: boolean; options: string };

function RequestTypesTab({ requestTypes, workspaceId, onToggle, onAdd }: {
  requestTypes: HRRequestType[];
  workspaceId: string;
  onToggle: (id: string, v: boolean) => void;
  onAdd: (input: Omit<HRRequestType, "id" | "createdAt">) => void;
}) {
  const [building, setBuilding] = useState(false);
  const [nameAr, setNameAr]     = useState("");
  const [nameEn, setNameEn]     = useState("");
  const [icon, setIcon]         = useState("FileText");
  const [needsAttach, setNeedsAttach] = useState(false);
  const [fields, setFields]     = useState<NewFieldState[]>([]);

  const addField = () => setFields((f) => [...f, { labelAr: "", type: "text", required: false, options: "" }]);
  const updateField = (i: number, patch: Partial<NewFieldState>) =>
    setFields((f) => f.map((field, idx) => (idx === i ? { ...field, ...patch } : field)));
  const removeField = (i: number) => setFields((f) => f.filter((_, idx) => idx !== i));

  const handleCreate = () => {
    if (!nameAr.trim()) return;
    const finalFields: HRFieldDef[] = fields
      .filter((f) => f.labelAr.trim())
      .map((f, i) => ({
        key: `field_${i}`,
        labelAr: f.labelAr.trim(),
        type: f.type,
        required: f.required,
        options: f.type === "select" ? f.options.split("،").map((o) => o.trim()).filter(Boolean) : undefined,
      }));
    onAdd({
      workspaceId,
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim(),
      icon,
      fields: finalFields,
      needsAttach,
      isActive: true,
      sortOrder: requestTypes.length,
      isSystem: false,
    });
    setBuilding(false); setNameAr(""); setNameEn(""); setIcon("FileText"); setFields([]); setNeedsAttach(false);
  };

  const sorted = [...requestTypes].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground/70">فعّل أو عطّل أنواع الطلبات، أو أنشئ نوعاً مخصصاً جديداً.</p>

      {/* Existing types */}
      <div className="space-y-2">
        {sorted.map((rt) => (
          <label key={rt.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-4 py-3 cursor-pointer transition hover:bg-secondary/40">
            <span className="text-xl w-7 shrink-0 text-center">{iconEmoji(rt.icon)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{rt.nameAr}</p>
              <p className="text-[10px] text-muted-foreground/60">{rt.isSystem ? "نظام" : "مخصص"} · {rt.fields.length} حقول</p>
            </div>
            <div dir="ltr" onClick={() => onToggle(rt.id, !rt.isActive)}
              className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer", rt.isActive ? "bg-primary" : "bg-muted-foreground/30")}>
              <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]", rt.isActive ? "left-4" : "left-0.5")} />
            </div>
          </label>
        ))}
      </div>

      {/* ── Build new type ─────────────────────────────────── */}
      {building ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-4">
          <p className="text-sm font-bold text-primary">إنشاء نوع طلب مخصص</p>

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">الاسم بالعربية *</label>
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: طلب نقل" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">الاسم بالإنجليزية</label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Transfer Request" dir="ltr" />
            </div>
          </div>

          {/* Icon picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">الأيقونة</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button key={ic.key} onClick={() => setIcon(ic.key)}
                  className={cn("grid h-9 w-9 place-items-center rounded-xl border text-xl transition", icon === ic.key ? "border-primary bg-primary/15 ring-2 ring-primary/30" : "border-border/50 bg-background/50 hover:border-primary/30")}>
                  {ic.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Needs attachment toggle */}
          <label className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-3 cursor-pointer">
            <span className="text-sm">يتطلب مرفقات</span>
            <div dir="ltr" onClick={() => setNeedsAttach((v) => !v)}
              className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer", needsAttach ? "bg-primary" : "bg-muted-foreground/30")}>
              <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]", needsAttach ? "left-4" : "left-0.5")} />
            </div>
          </label>

          {/* Fields builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">حقول النموذج</label>
              <button onClick={addField} className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition">
                <Plus className="h-3 w-3" /> إضافة حقل
              </button>
            </div>

            {fields.length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground/50">لا توجد حقول بعد — اضغط "إضافة حقل"</p>
            )}

            {fields.map((field, i) => (
              <div key={i} className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
                  <Input
                    value={field.labelAr}
                    onChange={(e) => updateField(i, { labelAr: e.target.value })}
                    placeholder="اسم الحقل (بالعربية)"
                    className="flex-1 text-xs py-1.5"
                  />
                  <button onClick={() => removeField(i)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={field.type}
                    onChange={(e) => updateField(i, { type: e.target.value as HRFieldDef["type"] })}
                    className="flex-1 rounded-lg border border-border/60 bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50"
                  >
                    {FIELD_TYPES.map((ft) => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={field.required} onChange={(e) => updateField(i, { required: e.target.checked })} className="accent-primary" />
                    إلزامي
                  </label>
                </div>
                {field.type === "select" && (
                  <Input
                    value={field.options}
                    onChange={(e) => updateField(i, { options: e.target.value })}
                    placeholder="الخيارات مفصولة بـ ، (فاصلة عربية)"
                    className="text-xs py-1.5"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setBuilding(false)} className="flex-1">إلغاء</Button>
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={!nameAr.trim()} className="flex-1">
              <Check className="h-3.5 w-3.5" /> حفظ النوع
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setBuilding(true)} className="w-full border-dashed border-primary/30 text-primary hover:bg-primary/5">
          <Plus className="h-3.5 w-3.5" /> إنشاء نوع طلب مخصص
        </Button>
      )}
    </div>
  );
}

// ── HR Admins ─────────────────────────────────────────────────────────────

function HRAdminsTab({ employees, onToggle }: {
  employees: HREmployee[];
  onToggle: (id: string, v: boolean) => void;
}) {
  const active  = employees.filter((e) => e.status === "active");
  const admins  = active.filter((e) => e.isHrAdmin);
  const rest    = active.filter((e) => !e.isHrAdmin);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold text-amber-600 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" /> المسؤولون الحاليون ({admins.length})
        </p>
        {admins.length === 0 && <p className="text-xs text-muted-foreground/50 py-2">لا يوجد مسؤولون بعد.</p>}
        {admins.map((emp) => <EmployeeToggleRow key={emp.id} emp={emp} isAdmin={true} onToggle={onToggle} />)}
      </div>
      {rest.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground/70">بقية الموظفين</p>
          {rest.map((emp) => <EmployeeToggleRow key={emp.id} emp={emp} isAdmin={false} onToggle={onToggle} />)}
        </div>
      )}
    </div>
  );
}

function EmployeeToggleRow({ emp, isAdmin, onToggle }: {
  emp: HREmployee; isAdmin: boolean; onToggle: (id: string, v: boolean) => void;
}) {
  const initials = emp.name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <label className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 mb-1.5 cursor-pointer hover:bg-secondary/40 transition">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{initials}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{emp.name}</p>
        {emp.email && <p className="text-[10px] text-muted-foreground truncate" dir="ltr">{emp.email}</p>}
      </div>
      <div dir="ltr" onClick={() => onToggle(emp.id, !isAdmin)}
        className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer", isAdmin ? "bg-amber-500" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]", isAdmin ? "left-4" : "left-0.5")} />
      </div>
    </label>
  );
}
