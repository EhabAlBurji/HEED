import { useState } from "react";
import { ChevronDown, ChevronLeft, User, Building2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { HREmployee, HRDepartment, HRPosition } from "../../stores/hrStore";

type Props = {
  employees: HREmployee[];
  departments: HRDepartment[];
  positions: HRPosition[];
  onSelectEmployee?: (emp: HREmployee) => void;
};

export function OrgChart({ employees, departments, positions, onSelectEmployee }: Props) {
  const activeEmployees = employees.filter((e) => e.status === "active");
  const topLevel = activeEmployees.filter((e) => !e.managerId);

  if (topLevel.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Building2 className="h-12 w-12 opacity-20" />
        <p className="text-sm">لا يوجد موظفون بعد. أضف موظفين لعرض الهيكل التنظيمي.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-8" dir="rtl">
      <div className="inline-flex flex-col items-center gap-0 min-w-full">
        {/* Company root */}
        <CompanyRoot employeeCount={activeEmployees.length} />
        <div className="w-px h-6 bg-border/60" />
        {/* Top-level row */}
        <OrgRow
          employees={topLevel}
          allEmployees={activeEmployees}
          departments={departments}
          positions={positions}
          depth={0}
          onSelect={onSelectEmployee}
        />
      </div>
    </div>
  );
}

function CompanyRoot({ employeeCount }: { employeeCount: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2.5 rounded-2xl border-2 border-primary/30 bg-primary/8 px-5 py-3 shadow-sm">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">المنشأة</p>
          <p className="text-[11px] text-muted-foreground">{employeeCount} موظف</p>
        </div>
      </div>
    </div>
  );
}

function OrgRow({
  employees,
  allEmployees,
  departments,
  positions,
  depth,
  onSelect,
}: {
  employees: HREmployee[];
  allEmployees: HREmployee[];
  departments: HRDepartment[];
  positions: HRPosition[];
  depth: number;
  onSelect?: (emp: HREmployee) => void;
}) {
  if (employees.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-4 px-4">
      {employees.map((emp) => (
        <OrgNode
          key={emp.id}
          employee={emp}
          allEmployees={allEmployees}
          departments={departments}
          positions={positions}
          depth={depth}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function OrgNode({
  employee,
  allEmployees,
  departments,
  positions,
  depth,
  onSelect,
}: {
  employee: HREmployee;
  allEmployees: HREmployee[];
  departments: HRDepartment[];
  positions: HRPosition[];
  depth: number;
  onSelect?: (emp: HREmployee) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  // Guard against hierarchy cycles (A manages B manages A) by capping depth.
  const MAX_DEPTH = 12;
  const reports = depth < MAX_DEPTH ? allEmployees.filter((e) => e.managerId === employee.id) : [];
  const dept = departments.find((d) => d.id === employee.departmentId);
  const pos = positions.find((p) => p.id === employee.positionId);
  const hasReports = reports.length > 0;

  const initials = employee.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <div className="flex flex-col items-center">
      {/* Vertical connector from parent */}
      {depth > 0 && <div className="w-px h-4 bg-border/60" />}

      <div className="flex flex-col items-center">
        {/* Employee card */}
        <button
          onClick={() => onSelect?.(employee)}
          className="group relative flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 min-w-[140px] max-w-[160px] text-center"
        >
          {/* Avatar */}
          <div className="relative">
            {employee.avatarUrl ? (
              <img
                src={employee.avatarUrl}
                alt={employee.name}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-border/40"
              />
            ) : (
              <div
                className="grid h-12 w-12 place-items-center rounded-full text-sm font-bold text-white ring-2 ring-border/40"
                style={{ backgroundColor: dept?.color ?? "#0A4EFF" }}
              >
                {initials || <User className="h-5 w-5" />}
              </div>
            )}
            {employee.isHrAdmin && (
              <span className="absolute -bottom-0.5 -end-0.5 grid h-4 w-4 place-items-center rounded-full bg-amber-400 text-[8px] font-bold text-white ring-2 ring-card">
                HR
              </span>
            )}
          </div>

          {/* Info */}
          <div className="w-full">
            <p className="truncate text-xs font-semibold leading-tight">{employee.name}</p>
            {pos && (
              <p className="truncate text-[10px] text-muted-foreground leading-tight">{pos.name}</p>
            )}
            {dept && (
              <span
                className="mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-medium text-white"
                style={{ backgroundColor: dept.color + "cc" }}
              >
                {dept.name}
              </span>
            )}
          </div>

          {/* Employee number badge */}
          {employee.employeeNo && (
            <span className="absolute top-2 start-2 rounded-md bg-secondary px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
              #{employee.employeeNo}
            </span>
          )}
        </button>

        {/* Expand/collapse toggle */}
        {hasReports && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="mt-1 flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground transition hover:bg-primary/15 hover:text-primary"
          >
            {expanded ? (
              <><ChevronDown className="h-3 w-3" />{reports.length}</>
            ) : (
              <><ChevronLeft className="h-3 w-3" />{reports.length}</>
            )}
          </button>
        )}
      </div>

      {/* Vertical line + children */}
      {hasReports && expanded && (
        <>
          <div className="w-px h-4 bg-border/60" />
          {/* Horizontal bar */}
          {reports.length > 1 && (
            <div
              className="h-px bg-border/60"
              style={{ width: `calc(${reports.length * 180}px - 80px)` }}
            />
          )}
          <OrgRow
            employees={reports}
            allEmployees={allEmployees}
            departments={departments}
            positions={positions}
            depth={depth + 1}
            onSelect={onSelect}
          />
        </>
      )}
    </div>
  );
}

// ── Department Org View ───────────────────────────────────────────────────
// Alternative view: grouped by department

type DeptOrgProps = {
  departments: HRDepartment[];
  employees: HREmployee[];
  positions: HRPosition[];
  onSelectEmployee?: (emp: HREmployee) => void;
};

export function DeptOrgView({ departments, employees, positions, onSelectEmployee }: DeptOrgProps) {
  const ungrouped = employees.filter((e) => !e.departmentId && e.status === "active");

  const rootDepts = departments.filter((d) => !d.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const childDepts = (parentId: string) =>
    departments.filter((d) => d.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4" dir="rtl">
      {rootDepts.map((dept) => (
        <DeptCard
          key={dept.id}
          dept={dept}
          employees={employees}
          positions={positions}
          childDepts={childDepts}
          onSelect={onSelectEmployee}
        />
      ))}
      {ungrouped.length > 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 p-4">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">بدون قسم</p>
          <EmployeeAvatarRow employees={ungrouped} positions={positions} onSelect={onSelectEmployee} />
        </div>
      )}
    </div>
  );
}

function DeptCard({
  dept,
  employees,
  positions,
  childDepts,
  onSelect,
}: {
  dept: HRDepartment;
  employees: HREmployee[];
  positions: HRPosition[];
  childDepts: (id: string) => HRDepartment[];
  onSelect?: (emp: HREmployee) => void;
}) {
  const [open, setOpen] = useState(true);
  const deptEmployees = employees.filter((e) => e.departmentId === dept.id && e.status === "active");
  const children = childDepts(dept.id);
  const total = deptEmployees.length;

  return (
    <div
      className="rounded-2xl border border-border/60 overflow-hidden"
      style={{ borderColor: dept.color + "40" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 transition hover:bg-secondary/40"
        style={{ backgroundColor: dept.color + "10" }}
      >
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: dept.color }}
        />
        <span className="flex-1 text-start text-sm font-semibold">{dept.name}</span>
        <span className="text-[11px] text-muted-foreground">{total} موظف</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {total > 0 && (
            <EmployeeAvatarRow employees={deptEmployees} positions={positions} onSelect={onSelect} />
          )}
          {children.map((child) => (
            <DeptCard
              key={child.id}
              dept={child}
              employees={employees}
              positions={positions}
              childDepts={childDepts}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeAvatarRow({
  employees,
  positions,
  onSelect,
}: {
  employees: HREmployee[];
  positions: HRPosition[];
  onSelect?: (emp: HREmployee) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {employees.map((emp) => {
        const pos = positions.find((p) => p.id === emp.positionId);
        const initials = emp.name.split(" ").slice(0, 2).map((w) => w[0]).join("");
        return (
          <button
            key={emp.id}
            onClick={() => onSelect?.(emp)}
            className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-start transition hover:border-primary/40 hover:bg-secondary/60"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              {emp.avatarUrl ? (
                <img src={emp.avatarUrl} alt={emp.name} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                initials || <User className="h-4 w-4" />
              )}
            </div>
            <div>
              <p className="text-xs font-medium leading-tight">{emp.name}</p>
              {pos && <p className="text-[10px] text-muted-foreground">{pos.name}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
