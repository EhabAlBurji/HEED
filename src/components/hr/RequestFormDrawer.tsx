import { useState, useEffect, useRef } from "react";
import { X, Send, ChevronLeft, Plus, Trash2, Paperclip, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button, Input } from "../ui/primitives";
import type {
  HRRequestType,
  HRRequest,
  HREmployee,
  HRFieldDef,
  HRRequestAttachment,
} from "../../stores/hrStore";

type Props = {
  open: boolean;
  requestTypes: HRRequestType[];
  employees: HREmployee[];
  currentEmployeeId: string | null;
  workspaceId: string;
  editRequest?: HRRequest | null;
  isHrAdmin: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<HRRequest, "id" | "createdAt" | "updatedAt">) => void;
  onReview?: (id: string, status: "approved" | "rejected", notes: string) => void;
};

const ICONS = [
  { key: "Palmtree", emoji: "🌴" }, { key: "ReceiptText", emoji: "🧾" },
  { key: "Package", emoji: "📦" },  { key: "Banknote", emoji: "💵" },
  { key: "FileSignature", emoji: "📝" }, { key: "Stamp", emoji: "🔏" },
  { key: "PlaneTakeoff", emoji: "✈️" }, { key: "GraduationCap", emoji: "🎓" },
  { key: "Briefcase", emoji: "💼" }, { key: "FileText", emoji: "📄" },
  { key: "Car", emoji: "🚗" }, { key: "Home", emoji: "🏠" },
  { key: "Heart", emoji: "❤️" }, { key: "Star", emoji: "⭐" },
];

const iconEmoji = (key: string) => ICONS.find((i) => i.key === key)?.emoji ?? "📄";

// ── Expense item row type ────────────────────────────────────────────────
type ExpenseItem = { name: string; date: string; amount: string; description: string };

const emptyItem = (): ExpenseItem => ({ name: "", date: "", amount: "", description: "" });

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700 border-amber-200",
  approved:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected:  "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "في الانتظار", approved: "موافق عليه", rejected: "مرفوض", cancelled: "ملغي",
};

export function RequestFormDrawer({
  open,
  requestTypes,
  employees,
  currentEmployeeId,
  workspaceId,
  editRequest,
  isHrAdmin,
  onClose,
  onSubmit,
  onReview,
}: Props) {
  const [step, setStep] = useState<"select" | "fill">("select");
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([emptyItem()]);
  const [attachments, setAttachments] = useState<HRRequestAttachment[]>([]);
  const [employeeId, setEmployeeId] = useState(currentEmployeeId ?? "");
  const [reviewNotes, setReviewNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTypes = requestTypes.filter((rt) => rt.isActive);
  const selectedType = activeTypes.find((rt) => rt.id === selectedTypeId);

  // Owner of this request can edit if still pending
  const isOwner = editRequest?.employeeId === currentEmployeeId;
  const isViewMode = Boolean(
    editRequest &&
    (editRequest.status !== "pending" || (!isOwner && !isHrAdmin))
  );
  const isPending = editRequest?.status === "pending";
  const canEdit = Boolean(editRequest && isPending && (isOwner || isHrAdmin));

  useEffect(() => {
    if (!open) return;
    if (editRequest) {
      setSelectedTypeId(editRequest.typeId ?? "");
      const d: Record<string, string> = {};
      for (const [k, v] of Object.entries(editRequest.data ?? {})) d[k] = String(v ?? "");
      setFormData(d);
      // Restore expense items if applicable
      try {
        const raw = editRequest.data?.expense_items;
        if (raw && Array.isArray(raw)) setExpenseItems(raw as ExpenseItem[]);
        else setExpenseItems([emptyItem()]);
      } catch { setExpenseItems([emptyItem()]); }
      setAttachments((editRequest.attachments as HRRequestAttachment[]) ?? []);
      setEmployeeId(editRequest.employeeId ?? "");
      setStep("fill");
    } else {
      setStep("select");
      setSelectedTypeId("");
      setFormData({});
      setExpenseItems([emptyItem()]);
      setAttachments([]);
      setEmployeeId(currentEmployeeId ?? "");
    }
    setReviewNotes("");
  }, [open, editRequest, currentEmployeeId]);

  const setField = (key: string, value: string) => setFormData((p) => ({ ...p, [key]: value }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newAttachments: HRRequestAttachment[] = files.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
      size: f.size,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (!selectedType) return;
    const emp = employeeId || currentEmployeeId;
    if (!emp) return;

    const finalData: Record<string, unknown> = { ...formData };
    // Merge expense items if field type is items_table
    if (selectedType.fields.some((f) => f.type === "items_table")) {
      finalData.expense_items = expenseItems.filter((i) => i.name.trim());
    }

    onSubmit({
      workspaceId,
      employeeId: emp,
      typeId: selectedType.id,
      data: finalData,
      attachments,
      status: "pending",
      notes: null,
      reviewedBy: null,
      reviewedAt: null,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 start-0 z-50 flex w-full max-w-md flex-col bg-card shadow-2xl" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/50 px-5 py-4">
          {step === "fill" && !editRequest && (
            <button onClick={() => setStep("select")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary">
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </button>
          )}
          <h2 className="flex-1 text-base font-bold">
            {editRequest ? selectedType?.nameAr ?? "طلب"
              : step === "select" ? "اختر نوع الطلب"
              : `طلب: ${selectedType?.nameAr ?? ""}`}
          </h2>
          {editRequest && (
            <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium shrink-0", STATUS_COLORS[editRequest.status])}>
              {STATUS_LABELS[editRequest.status]}
            </span>
          )}
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-none">

          {/* ── Step 1: Type selection ────────────────────────────── */}
          {step === "select" && (
            <div className="p-4">
              <p className="mb-4 text-sm text-muted-foreground">اختر نوع الطلب الذي تريد تقديمه:</p>
              <div className="grid grid-cols-2 gap-2.5">
                {activeTypes.map((rt) => (
                  <button
                    key={rt.id}
                    onClick={() => { setSelectedTypeId(rt.id); setStep("fill"); }}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-background/50 p-4 text-center transition hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm active:scale-95"
                  >
                    <span className="text-3xl">{iconEmoji(rt.icon)}</span>
                    <span className="text-xs font-medium leading-tight">{rt.nameAr}</span>
                    {rt.needsAttach && (
                      <span className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                        <Paperclip className="h-2.5 w-2.5" /> مرفق مطلوب
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Fill form ─────────────────────────────────── */}
          {step === "fill" && (
            <div className="p-5 space-y-5">
              {/* Employee selector — HR admin creating for someone */}
              {isHrAdmin && !editRequest && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">الموظف</label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="">اختر الموظف</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Employee info row when viewing */}
              {editRequest && (
                <EmployeeInfoRow employee={employees.find((e) => e.id === editRequest.employeeId)} />
              )}

              {/* Dynamic fields */}
              {selectedType?.fields.map((field) => (
                field.type === "items_table"
                  ? <ExpenseItemsTable
                      key={field.key}
                      field={field}
                      items={expenseItems}
                      onChange={setExpenseItems}
                      readOnly={isViewMode}
                    />
                  : <DynamicField
                      key={field.key}
                      field={field}
                      value={formData[field.key] ?? ""}
                      onChange={(v) => setField(field.key, v)}
                      readOnly={isViewMode && !canEdit}
                    />
              ))}

              {/* Attachments section */}
              {(selectedType?.needsAttach || attachments.length > 0) && (
                <AttachmentsSection
                  attachments={attachments}
                  onAdd={() => fileInputRef.current?.click()}
                  onRemove={(i) => setAttachments((a) => a.filter((_, idx) => idx !== i))}
                  readOnly={isViewMode && !canEdit}
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Review notes (when already reviewed) */}
              {editRequest?.notes && (
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
                  <p className="mb-1 text-[11px] font-semibold text-muted-foreground">ملاحظات المراجع:</p>
                  <p className="text-sm">{editRequest.notes}</p>
                </div>
              )}

              {/* HR Admin: review panel for pending */}
              {isHrAdmin && editRequest && isPending && (
                <div className="rounded-2xl border border-border/60 bg-background/40 p-4 space-y-3">
                  <p className="text-xs font-semibold text-foreground/80">قرار الموارد البشرية</p>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="ملاحظات على الطلب (اختياري)"
                    rows={2}
                    className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none resize-none focus:border-primary/50 placeholder:text-muted-foreground/40"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { onReview?.(editRequest.id, "rejected", reviewNotes); onClose(); }}
                      className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                    >
                      <XCircle className="h-4 w-4" /> رفض
                    </button>
                    <button
                      onClick={() => { onReview?.(editRequest.id, "approved", reviewNotes); onClose(); }}
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 shadow-sm"
                    >
                      <CheckCircle2 className="h-4 w-4" /> موافقة
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — submit for new requests */}
        {step === "fill" && !editRequest && (
          <div className="border-t border-border/50 p-4">
            <div className="flex gap-2">
              <Button variant="outline" size="md" onClick={onClose} className="flex-1">إلغاء</Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                disabled={!selectedType || (!employeeId && !currentEmployeeId)}
                className="flex-1"
              >
                <Send className="h-4 w-4" />
                إرسال الطلب
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Expense items table ───────────────────────────────────────────────────

function ExpenseItemsTable({
  field,
  items,
  onChange,
  readOnly,
}: {
  field: HRFieldDef;
  items: ExpenseItem[];
  onChange: (items: ExpenseItem[]) => void;
  readOnly: boolean;
}) {
  const updateItem = (i: number, patch: Partial<ExpenseItem>) =>
    onChange(items.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const addItem = () => onChange([...items, emptyItem()]);

  const totalAmount = items.reduce((sum, item) => {
    const n = parseFloat(item.amount);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold">{field.labelAr}</label>
        {!readOnly && (
          <button
            onClick={addItem}
            className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
          >
            <Plus className="h-3 w-3" /> إضافة عنصر
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_100px_80px_32px] gap-1 bg-secondary/50 px-3 py-2 text-[10px] font-semibold text-muted-foreground/70">
          <span>اسم العنصر</span>
          <span>التاريخ</span>
          <span>المبلغ (ر.س)</span>
          <span />
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/30">
          {items.map((item, i) => (
            <div key={i} className="space-y-1.5 p-3">
              <div className="grid grid-cols-[1fr_100px_80px_32px] gap-1 items-center">
                <input
                  value={item.name}
                  onChange={(e) => updateItem(i, { name: e.target.value })}
                  readOnly={readOnly}
                  placeholder="اسم العنصر"
                  className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-xs outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                />
                <input
                  type="date"
                  value={item.date}
                  onChange={(e) => updateItem(i, { date: e.target.value })}
                  readOnly={readOnly}
                  dir="ltr"
                  className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-xs outline-none focus:border-primary/50"
                />
                <input
                  type="number"
                  value={item.amount}
                  onChange={(e) => updateItem(i, { amount: e.target.value })}
                  readOnly={readOnly}
                  placeholder="0"
                  dir="ltr"
                  className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-xs outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                />
                {!readOnly && (
                  <button
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground/40 transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <input
                value={item.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                readOnly={readOnly}
                placeholder="وصف (اختياري)"
                className="w-full rounded-md border border-border/50 bg-background/60 px-2 py-1 text-xs outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
              />
            </div>
          ))}
        </div>

        {/* Total row */}
        {items.length > 0 && (
          <div className="flex items-center justify-between border-t border-border/40 bg-secondary/30 px-3 py-2">
            <span className="text-xs font-semibold text-muted-foreground">الإجمالي</span>
            <span className="font-mono text-sm font-bold text-primary">
              {totalAmount.toLocaleString("ar-SA")} ر.س
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Attachments section ───────────────────────────────────────────────────

function AttachmentsSection({
  attachments,
  onAdd,
  onRemove,
  readOnly,
}: {
  attachments: HRRequestAttachment[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold">المرفقات</label>
        {!readOnly && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 rounded-lg bg-secondary/80 px-2.5 py-1 text-xs font-medium text-foreground/70 transition hover:bg-secondary"
          >
            <Paperclip className="h-3 w-3" /> إرفاق ملف
          </button>
        )}
      </div>

      {attachments.length === 0 ? (
        !readOnly && (
          <button
            onClick={onAdd}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/50 py-5 text-muted-foreground/60 transition hover:border-primary/30 hover:text-primary/60"
          >
            <Paperclip className="h-5 w-5" />
            <span className="text-xs">اسحب ملفاً هنا أو اضغط لاختيار</span>
          </button>
        )
      ) : (
        <div className="space-y-1.5">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              <span className="flex-1 truncate text-xs">{att.name}</span>
              <span className="text-[10px] text-muted-foreground/50">
                {(att.size / 1024).toFixed(0)} KB
              </span>
              {!readOnly && (
                <button onClick={() => onRemove(i)} className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-muted-foreground/40 hover:text-destructive transition">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dynamic field renderer ────────────────────────────────────────────────

function DynamicField({
  field, value, onChange, readOnly,
}: {
  field: HRFieldDef; value: string; onChange: (v: string) => void; readOnly: boolean;
}) {
  const labelEl = (
    <label className="text-xs font-medium text-foreground/80">
      {field.labelAr}
      {field.required && <span className="ms-0.5 text-destructive">*</span>}
    </label>
  );

  if (field.type === "toggle") {
    const checked = value === "true";
    return (
      <div className="space-y-1">
        <label className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-3 cursor-pointer select-none">
          <span className="text-sm text-foreground/90">{field.labelAr}</span>
          <div dir="ltr" onClick={() => !readOnly && onChange(checked ? "false" : "true")}
            className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted-foreground/30", readOnly && "opacity-60 cursor-not-allowed")}
          >
            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]", checked ? "left-4" : "left-0.5")} />
          </div>
        </label>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1.5">{labelEl}
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={readOnly}
          className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/50 disabled:opacity-60">
          <option value="">اختر...</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">{labelEl}
        <textarea value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} rows={3}
          placeholder={readOnly ? "" : `ادخل ${field.labelAr}`}
          className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none resize-none focus:border-primary/50 placeholder:text-muted-foreground/40 disabled:opacity-60" />
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div className="space-y-1.5">{labelEl}
        <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} dir="ltr" />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="space-y-1.5">{labelEl}
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} dir="ltr" placeholder="0" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">{labelEl}
      <Input value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly}
        placeholder={readOnly ? "" : `ادخل ${field.labelAr}`} />
    </div>
  );
}

function EmployeeInfoRow({ employee }: { employee?: HREmployee }) {
  if (!employee) return null;
  const initials = employee.name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/30 px-4 py-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary">{initials}</div>
      <div>
        <p className="text-sm font-medium">{employee.name}</p>
        {employee.email && <p className="text-[11px] text-muted-foreground" dir="ltr">{employee.email}</p>}
      </div>
    </div>
  );
}
