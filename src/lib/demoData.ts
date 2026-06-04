// =========================================================================
// Heed — Demo Data Seeder
// Seeds realistic Arabic dummy data for HR, projects, tasks, and
// notifications so the app looks impressive during demos.
// Call seedDemoData() once; it checks a flag to avoid re-seeding.
// =========================================================================

import { useHRStore } from "../stores/hrStore";
import { useTasksStore } from "../stores/tasksStore";
import { useNotificationsStore } from "../stores/notificationsStore";

const DEMO_FLAG = "heed-demo-seeded-v3";

function uid() { return Math.random().toString(36).slice(2, 14); }
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function dateStr(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export function isDemoSeeded() {
  return localStorage.getItem(DEMO_FLAG) === "1";
}

export function clearDemoData() {
  localStorage.removeItem(DEMO_FLAG);
}

export function seedDemoData(workspaceId: string) {
  if (isDemoSeeded()) return;

  seedHR(workspaceId);
  seedProjects(workspaceId);
  seedNotifications();

  localStorage.setItem(DEMO_FLAG, "1");
}

// ── HR Demo Data ──────────────────────────────────────────────────────────

function seedHR(workspaceId: string) {
  const store = useHRStore.getState();

  // ── Departments ──────────────────────────────────────────────────────
  const deptIds = {
    exec:    uid(), hr:      uid(), finance: uid(),
    tech:    uid(), design:  uid(), marketing: uid(),
    ops:     uid(), sales:   uid(),
  };

  const departments = [
    { id: deptIds.exec,      workspaceId, name: "الإدارة التنفيذية",  color: "#0A4EFF", parentId: null,         sortOrder: 0, createdAt: daysAgo(180) },
    { id: deptIds.hr,        workspaceId, name: "الموارد البشرية",    color: "#10B981", parentId: null,         sortOrder: 1, createdAt: daysAgo(180) },
    { id: deptIds.finance,   workspaceId, name: "المالية والمحاسبة",  color: "#F59E0B", parentId: null,         sortOrder: 2, createdAt: daysAgo(180) },
    { id: deptIds.tech,      workspaceId, name: "التقنية",            color: "#8B5CF6", parentId: null,         sortOrder: 3, createdAt: daysAgo(180) },
    { id: deptIds.design,    workspaceId, name: "التصميم",            color: "#EC4899", parentId: deptIds.tech, sortOrder: 0, createdAt: daysAgo(120) },
    { id: deptIds.marketing, workspaceId, name: "التسويق",            color: "#06B6D4", parentId: null,         sortOrder: 4, createdAt: daysAgo(180) },
    { id: deptIds.ops,       workspaceId, name: "العمليات",           color: "#EF4444", parentId: null,         sortOrder: 5, createdAt: daysAgo(180) },
    { id: deptIds.sales,     workspaceId, name: "المبيعات",           color: "#84CC16", parentId: null,         sortOrder: 6, createdAt: daysAgo(180) },
  ];
  store.setDepartments(departments);

  // ── Positions ────────────────────────────────────────────────────────
  const posIds = {
    ceo: uid(), hrDir: uid(), hrSpec: uid(), finDir: uid(), accountant: uid(),
    cto: uid(), senior_dev: uid(), dev: uid(), designer: uid(),
    mktDir: uid(), mktSpec: uid(), opsDir: uid(), salesDir: uid(),
  };

  const positions = [
    { id: posIds.ceo,        workspaceId, name: "الرئيس التنفيذي",       grade: 1, departmentId: deptIds.exec,      createdAt: daysAgo(180) },
    { id: posIds.hrDir,      workspaceId, name: "مدير الموارد البشرية",   grade: 2, departmentId: deptIds.hr,        createdAt: daysAgo(180) },
    { id: posIds.hrSpec,     workspaceId, name: "أخصائي موارد بشرية",    grade: 4, departmentId: deptIds.hr,        createdAt: daysAgo(180) },
    { id: posIds.finDir,     workspaceId, name: "مدير مالي",              grade: 2, departmentId: deptIds.finance,   createdAt: daysAgo(180) },
    { id: posIds.accountant, workspaceId, name: "محاسب",                  grade: 4, departmentId: deptIds.finance,   createdAt: daysAgo(180) },
    { id: posIds.cto,        workspaceId, name: "مدير تقنية المعلومات",   grade: 2, departmentId: deptIds.tech,      createdAt: daysAgo(180) },
    { id: posIds.senior_dev, workspaceId, name: "مطور أول",               grade: 4, departmentId: deptIds.tech,      createdAt: daysAgo(180) },
    { id: posIds.dev,        workspaceId, name: "مطور",                   grade: 5, departmentId: deptIds.tech,      createdAt: daysAgo(180) },
    { id: posIds.designer,   workspaceId, name: "مصمم جرافيك متقدم",     grade: 4, departmentId: deptIds.design,    createdAt: daysAgo(120) },
    { id: posIds.mktDir,     workspaceId, name: "مدير التسويق",           grade: 2, departmentId: deptIds.marketing, createdAt: daysAgo(180) },
    { id: posIds.mktSpec,    workspaceId, name: "أخصائي تسويق رقمي",     grade: 4, departmentId: deptIds.marketing, createdAt: daysAgo(180) },
    { id: posIds.opsDir,     workspaceId, name: "مدير العمليات",          grade: 2, departmentId: deptIds.ops,       createdAt: daysAgo(180) },
    { id: posIds.salesDir,   workspaceId, name: "مدير المبيعات",          grade: 2, departmentId: deptIds.sales,     createdAt: daysAgo(180) },
  ];
  store.setPositions(positions);

  // ── Employees ────────────────────────────────────────────────────────
  const empIds = {
    ceo: uid(), hrDir: uid(), hrSpec1: uid(), finDir: uid(), accountant1: uid(),
    cto: uid(), senDev1: uid(), dev1: uid(), dev2: uid(), designer1: uid(),
    mktDir: uid(), mktSpec1: uid(), opsDir: uid(), salesDir: uid(),
  };

  const now = new Date().toISOString();
  const employees = [
    { id: empIds.ceo,        workspaceId, userId: null, employeeNo: "001", name: "سلطان محمد الغامدي",   nameEn: "Sultan Al-Ghamdi",   email: "sultan@company.sa",   phone: "+966 50 111 2233", nationalId: "1022334455", avatarUrl: null, departmentId: deptIds.exec,      positionId: posIds.ceo,        managerId: null,          hireDate: "2021-01-15", location: "الرياض",  status: "active" as const, isHrAdmin: false, createdAt: daysAgo(180), updatedAt: now },
    { id: empIds.hrDir,      workspaceId, userId: null, employeeNo: "002", name: "سارة سعيد العتيبي",    nameEn: "Sara Al-Otaibi",     email: "sara@company.sa",     phone: "+966 55 222 3344", nationalId: "1033445566", avatarUrl: null, departmentId: deptIds.hr,        positionId: posIds.hrDir,      managerId: empIds.ceo,    hireDate: "2021-03-01", location: "الرياض",  status: "active" as const, isHrAdmin: true,  createdAt: daysAgo(180), updatedAt: now },
    { id: empIds.hrSpec1,    workspaceId, userId: null, employeeNo: "003", name: "شيماء سعيد العبري",    nameEn: "Shaima Al-Abri",     email: "shaima@company.sa",   phone: "+966 54 333 4455", nationalId: "1044556677", avatarUrl: null, departmentId: deptIds.hr,        positionId: posIds.hrSpec,     managerId: empIds.hrDir,  hireDate: "2022-06-15", location: "الرياض",  status: "active" as const, isHrAdmin: true,  createdAt: daysAgo(150), updatedAt: now },
    { id: empIds.finDir,     workspaceId, userId: null, employeeNo: "004", name: "عبدالرحمن خالد المطيري", nameEn: "Abdulrahman Al-Mutairi", email: "abdulrahman@company.sa", phone: "+966 56 444 5566", nationalId: "1055667788", avatarUrl: null, departmentId: deptIds.finance, positionId: posIds.finDir,     managerId: empIds.ceo,    hireDate: "2021-06-01", location: "الرياض",  status: "active" as const, isHrAdmin: false, createdAt: daysAgo(180), updatedAt: now },
    { id: empIds.accountant1, workspaceId, userId: null, employeeNo: "005", name: "أسماء عبدالله الصخير", nameEn: "Asmaa Al-Sakhir",   email: "asmaa@company.sa",    phone: "+966 53 555 6677", nationalId: "1066778899", avatarUrl: null, departmentId: deptIds.finance, positionId: posIds.accountant, managerId: empIds.finDir, hireDate: "2022-01-15", location: "الرياض",  status: "active" as const, isHrAdmin: false, createdAt: daysAgo(160), updatedAt: now },
    { id: empIds.cto,        workspaceId, userId: null, employeeNo: "006", name: "محمد أديب عبدالله رمضان", nameEn: "Mohamed Ramadan",  email: "mohamed@company.sa",  phone: "+966 58 666 7788", nationalId: "1077889900", avatarUrl: null, departmentId: deptIds.tech,      positionId: posIds.cto,        managerId: empIds.ceo,    hireDate: "2021-02-01", location: "الدمام",  status: "active" as const, isHrAdmin: false, createdAt: daysAgo(180), updatedAt: now },
    { id: empIds.senDev1,    workspaceId, userId: null, employeeNo: "007", name: "فيصل ناصر الدوسري",    nameEn: "Faisal Al-Dosari",   email: "faisal@company.sa",   phone: "+966 59 777 8899", nationalId: "1088990011", avatarUrl: null, departmentId: deptIds.tech,      positionId: posIds.senior_dev, managerId: empIds.cto,    hireDate: "2022-03-01", location: "الدمام",  status: "active" as const, isHrAdmin: false, createdAt: daysAgo(140), updatedAt: now },
    { id: empIds.dev1,       workspaceId, userId: null, employeeNo: "008", name: "طارق وليد الشمري",     nameEn: "Tariq Al-Shammari",  email: "tariq@company.sa",    phone: "+966 50 888 9900", nationalId: "1099001122", avatarUrl: null, departmentId: deptIds.tech,      positionId: posIds.dev,        managerId: empIds.senDev1, hireDate: "2023-01-10", location: "الدمام", status: "active" as const, isHrAdmin: false, createdAt: daysAgo(100), updatedAt: now },
    { id: empIds.dev2,       workspaceId, userId: null, employeeNo: "009", name: "ريم علي الزهراني",     nameEn: "Reem Al-Zahrani",    email: "reem@company.sa",     phone: "+966 55 999 0011", nationalId: "1100112233", avatarUrl: null, departmentId: deptIds.tech,      positionId: posIds.dev,        managerId: empIds.senDev1, hireDate: "2023-05-20", location: "جدة",   status: "on_leave" as const, isHrAdmin: false, createdAt: daysAgo(80), updatedAt: now },
    { id: empIds.designer1,  workspaceId, userId: null, employeeNo: "079", name: "إيهاب علي البرجي",     nameEn: "Ehab Ali Elborgy",   email: "ehab@om.sa",          phone: "+966 54 254 2781", nationalId: "2542781527", avatarUrl: null, departmentId: deptIds.design,    positionId: posIds.designer,   managerId: empIds.cto,    hireDate: "2023-04-10", location: "الدمام", status: "active" as const, isHrAdmin: false, createdAt: daysAgo(90), updatedAt: now },
    { id: empIds.mktDir,     workspaceId, userId: null, employeeNo: "010", name: "نورة سالم القحطاني",   nameEn: "Nora Al-Qahtani",    email: "nora@company.sa",     phone: "+966 56 100 2233", nationalId: "1111223344", avatarUrl: null, departmentId: deptIds.marketing, positionId: posIds.mktDir,     managerId: empIds.ceo,    hireDate: "2021-09-01", location: "جدة",    status: "active" as const, isHrAdmin: false, createdAt: daysAgo(175), updatedAt: now },
    { id: empIds.mktSpec1,   workspaceId, userId: null, employeeNo: "011", name: "فايزة مفرس البقمي",    nameEn: "Faiza Al-Buqami",    email: "faiza@company.sa",    phone: "+966 53 200 3344", nationalId: "1122334455", avatarUrl: null, departmentId: deptIds.marketing, positionId: posIds.mktSpec,    managerId: empIds.mktDir, hireDate: "2022-11-01", location: "جدة",    status: "active" as const, isHrAdmin: false, createdAt: daysAgo(120), updatedAt: now },
    { id: empIds.opsDir,     workspaceId, userId: null, employeeNo: "012", name: "أحمد عاصم أحمد",      nameEn: "Ahmed Asim",         email: "ahmed@company.sa",    phone: "+966 58 300 4455", nationalId: "1133445566", avatarUrl: null, departmentId: deptIds.ops,       positionId: posIds.opsDir,     managerId: empIds.ceo,    hireDate: "2021-07-15", location: "الرياض",  status: "active" as const, isHrAdmin: false, createdAt: daysAgo(170), updatedAt: now },
    { id: empIds.salesDir,   workspaceId, userId: null, employeeNo: "013", name: "وليد عبدالعزيز السلامة", nameEn: "Walid Al-Salama",  email: "walid@company.sa",    phone: "+966 59 400 5566", nationalId: "1144556677", avatarUrl: null, departmentId: deptIds.sales,     positionId: posIds.salesDir,   managerId: empIds.ceo,    hireDate: "2021-11-01", location: "الرياض",  status: "active" as const, isHrAdmin: false, createdAt: daysAgo(165), updatedAt: now },
  ];
  store.setEmployees(employees);

  // ── Requests (seed realistic history) ────────────────────────────────
  const rtIds = useHRStore.getState().requestTypes.map((r) => r.id);
  const leaveTypeId  = rtIds[0] ?? "";
  const expenseTypeId = rtIds[1] ?? "";
  const advanceTypeId = rtIds[3] ?? "";
  const letterTypeId  = rtIds[4] ?? "";
  const trainingTypeId = rtIds[7] ?? "";
  const exitTypeId    = rtIds[6] ?? "";

  const requests = [
    {
      id: uid(), workspaceId, employeeId: empIds.designer1, typeId: leaveTypeId,
      data: { leave_type: "سنوية", start_date: dateStr(5), end_date: dateStr(12), reason: "رحلة عائلية لزيارة الأهل" },
      attachments: [], status: "pending" as const, notes: null, reviewedBy: null, reviewedAt: null,
      createdAt: daysAgo(1), updatedAt: daysAgo(1),
    },
    {
      id: uid(), workspaceId, employeeId: empIds.dev1, typeId: expenseTypeId,
      data: { expense_items: [{ name: "تذكرة طيران", date: dateStr(-10), amount: "850", description: "رحلة الدمام-الرياض" }, { name: "فندق", date: dateStr(-9), amount: "450", description: "ليلتان" }], reason: "مهمة عمل في الرياض" },
      attachments: [{ name: "invoice_flight.pdf", url: "#", size: 102400 }],
      status: "approved" as const, notes: "تمت الموافقة، سيتم الصرف مع الراتب القادم", reviewedBy: empIds.hrDir, reviewedAt: daysAgo(8),
      createdAt: daysAgo(10), updatedAt: daysAgo(8),
    },
    {
      id: uid(), workspaceId, employeeId: empIds.mktSpec1, typeId: advanceTypeId,
      data: { advance_type: "سلفة راتب", amount: "3000", deduction_start: dateStr(30), guarantors: "نورة القحطاني", installment: "1000" },
      attachments: [], status: "approved" as const, notes: null, reviewedBy: empIds.hrDir, reviewedAt: daysAgo(15),
      createdAt: daysAgo(18), updatedAt: daysAgo(15),
    },
    {
      id: uid(), workspaceId, employeeId: empIds.dev2, typeId: leaveTypeId,
      data: { leave_type: "مرضية", start_date: dateStr(-7), end_date: dateStr(7), exit_reentry: "false", reason: "علاج طبي" },
      attachments: [], status: "approved" as const, notes: "تم الموافقة على الإجازة المرضية بناءً على التقرير الطبي", reviewedBy: empIds.hrSpec1, reviewedAt: daysAgo(6),
      createdAt: daysAgo(8), updatedAt: daysAgo(6),
    },
    {
      id: uid(), workspaceId, employeeId: empIds.accountant1, typeId: letterTypeId,
      data: { letter_type: "خطاب تعريف بالراتب", recipient: "البنك العربي الوطني", needs_certification: "نعم" },
      attachments: [], status: "pending" as const, notes: null, reviewedBy: null, reviewedAt: null,
      createdAt: daysAgo(0), updatedAt: daysAgo(0),
    },
    {
      id: uid(), workspaceId, employeeId: empIds.senDev1, typeId: trainingTypeId,
      data: { training_name: "دورة AWS Solutions Architect", location: "الرياض - حضوري", start_date: dateStr(14), end_date: dateStr(17), cost: "2500", notes: "دورة معتمدة من AWS" },
      attachments: [], status: "approved" as const, notes: "تمت الموافقة، قيد التنسيق مع الجهة المانحة", reviewedBy: empIds.hrDir, reviewedAt: daysAgo(3),
      createdAt: daysAgo(5), updatedAt: daysAgo(3),
    },
    {
      id: uid(), workspaceId, employeeId: empIds.designer1, typeId: exitTypeId,
      data: { visa_type: "فردية", duration: "شهر", payment_status: "مسدد", travel_date: dateStr(20) },
      attachments: [], status: "rejected" as const, notes: "لم تكتمل فترة الخدمة المطلوبة قبل طلب تأشيرة الخروج", reviewedBy: empIds.hrDir, reviewedAt: daysAgo(12),
      createdAt: daysAgo(14), updatedAt: daysAgo(12),
    },
    {
      id: uid(), workspaceId, employeeId: empIds.finDir, typeId: expenseTypeId,
      data: { expense_items: [{ name: "بدل سيارة", date: dateStr(-5), amount: "1000", description: "بدل النقل الشهري" }, { name: "وجبات اجتماع", date: dateStr(-3), amount: "380", description: "اجتماع مجلس الإدارة" }], reason: "مصاريف الإدارة التنفيذية" },
      attachments: [{ name: "receipts_may.pdf", url: "#", size: 204800 }],
      status: "pending" as const, notes: null, reviewedBy: null, reviewedAt: null,
      createdAt: daysAgo(2), updatedAt: daysAgo(2),
    },
  ];
  store.setRequests(requests);
}

// ── Projects + Tasks Demo Data ────────────────────────────────────────────

function seedProjects(workspaceId: string) {
  const store = useTasksStore.getState();

  // ── Categories ────────────────────────────────────────────────────────
  const catDev  = store.addCategory({ name: "تطوير", color: "#8B5CF6", type: "general" });
  const catDes  = store.addCategory({ name: "تصميم", color: "#EC4899", type: "design"  });
  const catMkt  = store.addCategory({ name: "تسويق", color: "#06B6D4", type: "general" });
  const catIds  = { dev: catDev.id, design: catDes.id, marketing: catMkt.id };

  // ── Projects ──────────────────────────────────────────────────────────
  const app = store.addProject({
    name: "تطبيق Heed",
    color: "#8B5CF6", icon: "🚀", type: "general", workspace_id: workspaceId, shared_workspace_ids: [],
  });
  const brand = store.addProject({
    name: "الهوية البصرية",
    color: "#EC4899", icon: "🎨", type: "design", workspace_id: workspaceId, shared_workspace_ids: [],
  });
  const campaign = store.addProject({
    name: "حملة رمضان 2026",
    color: "#06B6D4", icon: "📢", type: "general", workspace_id: workspaceId, shared_workspace_ids: [],
  });

  const pIds = { app: app.id, brand: brand.id, campaign: campaign.id };

  // ── Tasks ─────────────────────────────────────────────────────────────
  const addT = (t: Parameters<typeof store.addTask>[0]) => store.addTask({ workspace_id: workspaceId, ...t });

  // App project tasks
  addT({ title: "إعداد نظام الإشعارات الفورية", project_id: pIds.app, category_id: catIds.dev, priority: "urgent", column: "today",     status: "in_progress", estimated_minutes: 240, deadline: dateStr(1),  notes: "يشمل push notifications و in-app notifications" });
  addT({ title: "تصميم صفحة تسجيل الدخول الجديدة", project_id: pIds.app, category_id: catIds.design, priority: "high", column: "today", status: "todo",        estimated_minutes: 180, deadline: dateStr(2),  notes: "" });
  addT({ title: "مراجعة أداء قاعدة البيانات",      project_id: pIds.app, category_id: catIds.dev,    priority: "high", column: "this_week", status: "todo",      estimated_minutes: 120, deadline: dateStr(4),  notes: "فحص الـ slow queries والـ indexes" });
  addT({ title: "كتابة Unit Tests لنظام HR",        project_id: pIds.app, category_id: catIds.dev,    priority: "medium", column: "this_week", status: "todo",    estimated_minutes: 300, deadline: dateStr(5),  notes: "" });
  addT({ title: "نشر الإصدار 2.0 على الـ production", project_id: pIds.app, category_id: catIds.dev,  priority: "urgent", column: "this_week", status: "todo",   estimated_minutes: 60,  deadline: dateStr(3),  notes: "بعد اعتماد QA" });
  addT({ title: "إصلاح bug الـ RTL في Safari",      project_id: pIds.app, category_id: catIds.dev,    priority: "medium", column: "backlog",   status: "todo",    estimated_minutes: 90,  deadline: dateStr(7),  notes: "" });
  addT({ title: "دمج Google Analytics",             project_id: pIds.app, category_id: catIds.dev,    priority: "low",    column: "backlog",   status: "todo",    estimated_minutes: 120, deadline: dateStr(10), notes: "" });
  addT({ title: "رفع كفاءة الـ image compression",  project_id: pIds.app, category_id: catIds.dev,    priority: "low",    column: "backlog",   status: "todo",    estimated_minutes: 90,  deadline: dateStr(14), notes: "" });
  addT({ title: "اعتماد مخطط قاعدة البيانات v2",   project_id: pIds.app, category_id: catIds.dev,    priority: "high",   column: "done",      status: "done",    estimated_minutes: 60,  deadline: null,        notes: "", completed_at: daysAgo(3) });
  addT({ title: "إعداد CI/CD pipeline",             project_id: pIds.app, category_id: catIds.dev,    priority: "medium", column: "done",      status: "done",    estimated_minutes: 180, deadline: null,        notes: "", completed_at: daysAgo(7) });

  // Brand project tasks
  addT({ title: "تصميم الشعار الرئيسي",            project_id: pIds.brand, category_id: catIds.design, priority: "urgent", column: "done",      status: "done",    estimated_minutes: 480, deadline: null,        notes: "", completed_at: daysAgo(14) });
  addT({ title: "تحديد Color Palette",              project_id: pIds.brand, category_id: catIds.design, priority: "high",   column: "done",      status: "done",    estimated_minutes: 120, deadline: null,        notes: "", completed_at: daysAgo(10) });
  addT({ title: "تصميم نماذج المكونات (UI Kit)",   project_id: pIds.brand, category_id: catIds.design, priority: "high",   column: "today",     status: "in_progress", estimated_minutes: 360, deadline: dateStr(2), notes: "Buttons, inputs, cards, modals" });
  addT({ title: "إعداد ملف Brand Guidelines",      project_id: pIds.brand, category_id: catIds.design, priority: "medium", column: "this_week", status: "todo",    estimated_minutes: 240, deadline: dateStr(6), notes: "" });
  addT({ title: "تصميم قوالب Presentation",        project_id: pIds.brand, category_id: catIds.design, priority: "low",    column: "backlog",   status: "todo",    estimated_minutes: 180, deadline: dateStr(15), notes: "" });

  // Campaign project tasks
  addT({ title: "وضع استراتيجية الحملة",          project_id: pIds.campaign, category_id: catIds.marketing, priority: "urgent", column: "done",      status: "done",    estimated_minutes: 240, deadline: null,       notes: "", completed_at: daysAgo(20) });
  addT({ title: "إنتاج فيديو الإعلان الرئيسي",   project_id: pIds.campaign, category_id: catIds.marketing, priority: "high",   column: "today",     status: "in_progress", estimated_minutes: 600, deadline: dateStr(3), notes: "المونتاج في المرحلة النهائية" });
  addT({ title: "إعداد محتوى السوشيال ميديا",    project_id: pIds.campaign, category_id: catIds.marketing, priority: "high",   column: "this_week", status: "todo",    estimated_minutes: 300, deadline: dateStr(4), notes: "30 بوست للـ Instagram وSnapchat" });
  addT({ title: "التنسيق مع المؤثرين",           project_id: pIds.campaign, category_id: catIds.marketing, priority: "medium", column: "this_week", status: "todo",    estimated_minutes: 120, deadline: dateStr(5), notes: "قائمة المؤثرين جاهزة للاعتماد" });
  addT({ title: "إعداد تقرير نتائج الحملة",      project_id: pIds.campaign, category_id: catIds.marketing, priority: "low",    column: "backlog",   status: "todo",    estimated_minutes: 180, deadline: dateStr(30), notes: "" });
}

// ── Notifications Demo Data ───────────────────────────────────────────────

function seedNotifications() {
  const store = useNotificationsStore.getState();

  const notifs: Parameters<typeof store.add>[0][] = [
    { type: "info",     title: "طلب إجازة جديد بانتظار مراجعتك",        body: "إيهاب علي البرجي · إجازة سنوية من 10 يونيو" },
    { type: "info",     title: "طلب تصديق مستند بانتظار مراجعتك",       body: "أسماء الصخير · خطاب تعريف بالراتب" },
    { type: "info",     title: "طلب مصاريف بانتظار مراجعتك",             body: "عبدالرحمن المطيري · 1,380 ر.س" },
    { type: "assignment", title: "تم تكليفك بمهمة جديدة",               body: "إعداد نظام الإشعارات الفورية · عاجل" },
    { type: "mention",  title: "تم ذكرك في تعليق",                       body: "محمد رمضان في مهمة: دمج Google Analytics" },
    { type: "info",     title: "تمت الموافقة على طلب إجازتك",             body: "إجازة مرضية · 7 يناير – 21 يناير 2026" },
    { type: "info",     title: "اليوم يوافق مرور 3 سنوات على انضمام إيهاب علي البرجي للفريق", body: "نتمنى له التوفيق والنجاح 🎉" },
    { type: "info",     title: "اليوم يوافق مرور سنة على انضمام فايزة البقمي للفريق", body: "نتمنى لها التوفيق والنجاح 🎉" },
    { type: "assignment", title: "تم تعيينك مراجعاً لطلب تدريب",         body: "فيصل الدوسري · دورة AWS Solutions Architect" },
    { type: "info",     title: "تم رفع تقرير الحضور الشهري",              body: "مايو 2026 · 3 غياب غير مبرر" },
  ];

  // Add in reverse so newest is last-added (store prepends)
  [...notifs].reverse().forEach((n) => store.add(n));
}
