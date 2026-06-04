// =========================================================================
// Heed — HR Supabase sync
// Pull/push HR data (departments, positions, employees, request types,
// requests) to Supabase. Follows the same fire-and-forget upsert pattern
// as sync.ts but kept separate to avoid polluting the main sync file.
// =========================================================================

import { getSupabase, isSupabaseConfigured } from "./supabase";

// HR tables are not yet in the generated Database types, so we use a typed
// helper to avoid `never` inference on `.from()` calls.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hrTable = (name: string) => (getSupabase() as any).from(name);
import { useAuthStore } from "../stores/authStore";
import {
  useHRStore,
  type HRDepartment,
  type HRPosition,
  type HREmployee,
  type HRRequestType,
  type HRRequest,
  DEFAULT_REQUEST_TYPES,
} from "../stores/hrStore";

const canSync = () => {
  if (!isSupabaseConfigured()) return false;
  const u = useAuthStore.getState().user;
  return Boolean(u && u.id !== "guest");
};

// ── DB → model mappers ────────────────────────────────────────────────────

function dbToDept(row: Record<string, unknown>): HRDepartment {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    name: row.name as string,
    color: (row.color as string) ?? "#0A4EFF",
    parentId: (row.parent_id as string) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
    createdAt: row.created_at as string,
  };
}

function dbToPos(row: Record<string, unknown>): HRPosition {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    name: row.name as string,
    grade: (row.grade as number) ?? 3,
    departmentId: (row.department_id as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function dbToEmployee(row: Record<string, unknown>): HREmployee {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    userId: (row.user_id as string) ?? null,
    employeeNo: (row.employee_no as string) ?? null,
    name: row.name as string,
    nameEn: (row.name_en as string) ?? null,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    nationalId: (row.national_id as string) ?? null,
    avatarUrl: (row.avatar_url as string) ?? null,
    departmentId: (row.department_id as string) ?? null,
    positionId: (row.position_id as string) ?? null,
    managerId: (row.manager_id as string) ?? null,
    hireDate: (row.hire_date as string) ?? null,
    location: (row.location as string) ?? null,
    status: (row.status as HREmployee["status"]) ?? "active",
    isHrAdmin: Boolean(row.is_hr_admin),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function dbToRequestType(row: Record<string, unknown>): HRRequestType {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    nameAr: row.name_ar as string,
    nameEn: (row.name_en as string) ?? "",
    icon: (row.icon as string) ?? "FileText",
    fields: (row.fields as HRRequestType["fields"]) ?? [],
    needsAttach: Boolean(row.needs_attach),
    isActive: row.is_active !== false,
    sortOrder: (row.sort_order as number) ?? 0,
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at as string,
  };
}

function dbToRequest(row: Record<string, unknown>): HRRequest {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    employeeId: (row.employee_id as string) ?? null,
    typeId: (row.type_id as string) ?? null,
    data: (row.data as Record<string, unknown>) ?? {},
    attachments: (row.attachments as HRRequest["attachments"]) ?? [],
    status: (row.status as HRRequest["status"]) ?? "pending",
    notes: (row.notes as string) ?? null,
    reviewedBy: (row.reviewed_by as string) ?? null,
    reviewedAt: (row.reviewed_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Pull all HR data for a workspace ──────────────────────────────────────

export async function pullHRData(workspaceId: string) {
  if (!canSync()) return;
  const store = useHRStore.getState();
  store.setLoading(true);

  try {
    const [deptRes, posRes, empRes, rtRes, reqRes] = await Promise.all([
      hrTable("hr_departments").select("*").eq("workspace_id", workspaceId).order("sort_order"),
      hrTable("hr_positions").select("*").eq("workspace_id", workspaceId).order("name"),
      hrTable("hr_employees").select("*").eq("workspace_id", workspaceId).order("name"),
      hrTable("hr_request_types").select("*").eq("workspace_id", workspaceId).order("sort_order"),
      hrTable("hr_requests").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    ]);

    if (deptRes.data) store.setDepartments(deptRes.data.map(dbToDept));
    if (posRes.data) store.setPositions(posRes.data.map(dbToPos));
    if (empRes.data) store.setEmployees(empRes.data.map(dbToEmployee));
    if (rtRes.data) {
      store.setRequestTypes(rtRes.data.map(dbToRequestType));
      // Seed default types if workspace has none
      if (rtRes.data.length === 0) {
        await seedDefaultRequestTypes(workspaceId);
      }
    } else {
      await seedDefaultRequestTypes(workspaceId);
    }
    if (reqRes.data) store.setRequests(reqRes.data.map(dbToRequest));
  } finally {
    store.setLoading(false);
  }
}

// Seed default request types for a new workspace
async function seedDefaultRequestTypes(workspaceId: string) {
  if (!canSync()) return;
  const rows = DEFAULT_REQUEST_TYPES.map((rt) => ({
    workspace_id: workspaceId,
    name_ar: rt.nameAr,
    name_en: rt.nameEn,
    icon: rt.icon,
    fields: rt.fields,
    needs_attach: rt.needsAttach,
    is_active: rt.isActive,
    sort_order: rt.sortOrder,
    is_system: rt.isSystem,
  }));
  const { data } = await hrTable("hr_request_types").insert(rows).select();
  if (data) {
    useHRStore.getState().setRequestTypes(data.map(dbToRequestType));
  }
}

// ── Departments ───────────────────────────────────────────────────────────

export async function pushHRDepartment(dept: HRDepartment) {
  if (!canSync()) return;
  await hrTable("hr_departments").upsert({
    id: dept.id,
    workspace_id: dept.workspaceId,
    name: dept.name,
    color: dept.color,
    parent_id: dept.parentId,
    sort_order: dept.sortOrder,
  });
}

export async function deleteHRDepartment(id: string) {
  if (!canSync()) return;
  await hrTable("hr_departments").delete().eq("id", id);
}

// ── Positions ─────────────────────────────────────────────────────────────

export async function pushHRPosition(pos: HRPosition) {
  if (!canSync()) return;
  await hrTable("hr_positions").upsert({
    id: pos.id,
    workspace_id: pos.workspaceId,
    name: pos.name,
    grade: pos.grade,
    department_id: pos.departmentId,
  });
}

export async function deleteHRPosition(id: string) {
  if (!canSync()) return;
  await hrTable("hr_positions").delete().eq("id", id);
}

// ── Employees ─────────────────────────────────────────────────────────────

export async function pushHREmployee(emp: HREmployee) {
  if (!canSync()) return;
  await hrTable("hr_employees").upsert({
    id: emp.id,
    workspace_id: emp.workspaceId,
    user_id: emp.userId,
    employee_no: emp.employeeNo,
    name: emp.name,
    name_en: emp.nameEn,
    email: emp.email,
    phone: emp.phone,
    national_id: emp.nationalId,
    avatar_url: emp.avatarUrl,
    department_id: emp.departmentId,
    position_id: emp.positionId,
    manager_id: emp.managerId,
    hire_date: emp.hireDate,
    location: emp.location,
    status: emp.status,
    is_hr_admin: emp.isHrAdmin,
  });
}

export async function deleteHREmployee(id: string) {
  if (!canSync()) return;
  await hrTable("hr_employees").delete().eq("id", id);
}

// ── Request Types ─────────────────────────────────────────────────────────

export async function pushHRRequestType(rt: HRRequestType) {
  if (!canSync()) return;
  await hrTable("hr_request_types").upsert({
    id: rt.id,
    workspace_id: rt.workspaceId,
    name_ar: rt.nameAr,
    name_en: rt.nameEn,
    icon: rt.icon,
    fields: rt.fields,
    needs_attach: rt.needsAttach,
    is_active: rt.isActive,
    sort_order: rt.sortOrder,
    is_system: rt.isSystem,
  });
}

export async function deleteHRRequestType(id: string) {
  if (!canSync()) return;
  await hrTable("hr_request_types").delete().eq("id", id);
}

// ── Create a fully custom request type ───────────────────────────────────

export async function createHRRequestType(
  input: Omit<HRRequestType, "id" | "createdAt">
): Promise<HRRequestType | null> {
  if (!canSync()) return null;
  const { data } = await hrTable("hr_request_types")
    .insert({
      workspace_id: input.workspaceId,
      name_ar: input.nameAr,
      name_en: input.nameEn,
      icon: input.icon,
      fields: input.fields,
      needs_attach: input.needsAttach,
      is_active: input.isActive,
      sort_order: input.sortOrder,
      is_system: false,
    })
    .select()
    .single();
  if (!data) return null;
  const rt = dbToRequestType(data as Record<string, unknown>);
  useHRStore.getState().addRequestType(rt);
  return rt;
}

// ── Requests ──────────────────────────────────────────────────────────────

export async function pushHRRequest(req: HRRequest) {
  if (!canSync()) return;
  const { data } = await hrTable("hr_requests").upsert({
    id: req.id,
    workspace_id: req.workspaceId,
    employee_id: req.employeeId,
    type_id: req.typeId,
    data: req.data,
    attachments: req.attachments,
    status: req.status,
    notes: req.notes,
    reviewed_by: req.reviewedBy,
    reviewed_at: req.reviewedAt,
  }).select().single();
  if (data) {
    useHRStore.getState().updateRequest(req.id, dbToRequest(data as Record<string, unknown>));
  }
}

export async function deleteHRRequest(id: string) {
  if (!canSync()) return;
  await hrTable("hr_requests").delete().eq("id", id);
}

// ── Create helpers (generate ID server-side via insert + select) ──────────

export async function createHRDepartment(
  input: Omit<HRDepartment, "id" | "createdAt">
): Promise<HRDepartment | null> {
  if (!canSync()) return null;
  const { data } = await hrTable("hr_departments")
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      color: input.color,
      parent_id: input.parentId,
      sort_order: input.sortOrder,
    })
    .select()
    .single();
  if (!data) return null;
  const dept = dbToDept(data as Record<string, unknown>);
  useHRStore.getState().addDepartment(dept);
  return dept;
}

export async function createHRPosition(
  input: Omit<HRPosition, "id" | "createdAt">
): Promise<HRPosition | null> {
  if (!canSync()) return null;
  const { data } = await hrTable("hr_positions")
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      grade: input.grade,
      department_id: input.departmentId,
    })
    .select()
    .single();
  if (!data) return null;
  const pos = dbToPos(data as Record<string, unknown>);
  useHRStore.getState().addPosition(pos);
  return pos;
}

export async function createHREmployee(
  input: Omit<HREmployee, "id" | "createdAt" | "updatedAt">
): Promise<HREmployee | null> {
  if (!canSync()) return null;
  const { data } = await hrTable("hr_employees")
    .insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      employee_no: input.employeeNo,
      name: input.name,
      name_en: input.nameEn,
      email: input.email,
      phone: input.phone,
      national_id: input.nationalId,
      avatar_url: input.avatarUrl,
      department_id: input.departmentId,
      position_id: input.positionId,
      manager_id: input.managerId,
      hire_date: input.hireDate,
      location: input.location,
      status: input.status,
      is_hr_admin: input.isHrAdmin,
    })
    .select()
    .single();
  if (!data) return null;
  const emp = dbToEmployee(data as Record<string, unknown>);
  useHRStore.getState().addEmployee(emp);
  return emp;
}

export async function updateHREmployee(
  id: string,
  patch: Partial<Omit<HREmployee, "id" | "workspaceId" | "createdAt">>
): Promise<void> {
  useHRStore.getState().updateEmployee(id, patch);
  const emp = useHRStore.getState().employees.find((e) => e.id === id);
  if (emp) await pushHREmployee(emp);
}

export async function createHRRequest(
  input: Omit<HRRequest, "id" | "createdAt" | "updatedAt">
): Promise<HRRequest | null> {
  if (!canSync()) return null;
  const { data } = await hrTable("hr_requests")
    .insert({
      workspace_id: input.workspaceId,
      employee_id: input.employeeId,
      type_id: input.typeId,
      data: input.data,
      attachments: input.attachments,
      status: input.status,
      notes: input.notes,
    })
    .select()
    .single();
  if (!data) return null;
  const req = dbToRequest(data as Record<string, unknown>);
  useHRStore.getState().addRequest(req);
  return req;
}

export async function reviewHRRequest(
  id: string,
  status: "approved" | "rejected",
  notes: string | null,
  reviewedBy: string
): Promise<void> {
  const now = new Date().toISOString();
  const patch = { status, notes, reviewedBy, reviewedAt: now };
  useHRStore.getState().updateRequest(id, patch);
  if (canSync()) {
    await hrTable("hr_requests")
      .update({ status, notes, reviewed_by: reviewedBy, reviewed_at: now })
      .eq("id", id);
  }
}
