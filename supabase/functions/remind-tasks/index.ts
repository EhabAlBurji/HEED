// remind-tasks: send a daily digest email per user for tasks due today or tomorrow.
// POST body: optional { userId } — if provided, reminds only that user.
// Triggered by Supabase scheduled job (pg_cron) or manually from the client on login.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return json({ skipped: true, reason: "RESEND_API_KEY not set" });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse optional userId from request body
    let userId: string | null = null;
    try {
      const body = await req.json();
      userId = body?.userId ?? null;
    } catch {
      // no body or invalid JSON — treat as broadcast
    }

    const today    = isoDate(new Date());
    const tomorrow = isoDate(new Date(Date.now() + 86_400_000));

    // Fetch tasks due today or tomorrow that are not done
    let tasksQuery = admin
      .from("tasks")
      .select("id, title, deadline, priority, workspace_id, assignee_id, created_by")
      .neq("status", "done")
      .in("deadline", [today, tomorrow]);

    if (userId) {
      // Remind for tasks owned by or assigned to this user
      tasksQuery = tasksQuery.or(`created_by.eq.${userId},assignee_id.eq.${userId}`);
    }

    const { data: tasks, error: tasksErr } = await tasksQuery;
    if (tasksErr) {
      console.error("[remind-tasks] tasks query error:", tasksErr);
      return json({ error: tasksErr.message }, 500);
    }
    if (!tasks || tasks.length === 0) {
      return json({ ok: true, sent: 0 });
    }

    // Collect unique user IDs that should receive emails
    const userIds = new Set<string>();
    if (userId) {
      userIds.add(userId);
    } else {
      for (const t of tasks) {
        if (t.assignee_id) userIds.add(t.assignee_id);
        if (t.created_by)  userIds.add(t.created_by);
      }
    }

    if (userIds.size === 0) return json({ ok: true, sent: 0 });

    // Fetch profiles for all relevant users
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, name")
      .in("id", [...userIds]);

    const profileMap = new Map<string, { email: string; name?: string }>(
      (profiles ?? []).map((p) => [p.id, { email: p.email, name: p.name }])
    );

    let sent = 0;
    const errors: string[] = [];

    for (const uid of userIds) {
      const profile = profileMap.get(uid);
      if (!profile?.email) continue;

      // Tasks for this user
      const userTasks = tasks.filter(
        (t) => t.created_by === uid || t.assignee_id === uid
      );

      const todayTasks    = userTasks.filter((t) => t.deadline === today);
      const tomorrowTasks = userTasks.filter((t) => t.deadline === tomorrow);

      if (todayTasks.length === 0 && tomorrowTasks.length === 0) continue;

      // Build subject
      let subject: string;
      if (todayTasks.length > 0 && tomorrowTasks.length > 0) {
        subject = `⏰ لديك ${todayTasks.length} مهمة تستحق اليوم و${tomorrowTasks.length} غداً`;
      } else if (todayTasks.length > 0) {
        subject = `⏰ لديك ${todayTasks.length} مهمة تستحق اليوم`;
      } else {
        subject = `⏰ غداً: ${tomorrowTasks.length} مهمة`;
      }

      // Build HTML task rows
      function priorityColor(p: string) {
        switch (p) {
          case "urgent": return "#EF4444";
          case "high":   return "#F97316";
          case "medium": return "#3B82F6";
          default:       return "#94A3B8";
        }
      }
      function priorityLabel(p: string) {
        switch (p) {
          case "urgent": return "عاجل";
          case "high":   return "عالي";
          case "medium": return "متوسط";
          default:       return "منخفض";
        }
      }

      function buildTaskRows(list: typeof tasks) {
        return list
          .map((t) => `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${priorityColor(t.priority)};margin-left:8px;vertical-align:middle;"></span>
                <strong style="font-size:14px;color:#1a1a1a;">${t.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong>
              </td>
              <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">
                <span style="font-size:11px;color:${priorityColor(t.priority)};font-weight:600;">${priorityLabel(t.priority)}</span>
              </td>
            </tr>`)
          .join("");
      }

      const todaySection = todayTasks.length > 0 ? `
        <h3 style="margin:24px 0 8px;font-size:15px;color:#111827;">📅 مهام اليوم (${todayTasks.length})</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-align:right;">المهمة</th>
              <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-align:center;width:80px;">الأولوية</th>
            </tr>
          </thead>
          <tbody>${buildTaskRows(todayTasks)}</tbody>
        </table>` : "";

      const tomorrowSection = tomorrowTasks.length > 0 ? `
        <h3 style="margin:24px 0 8px;font-size:15px;color:#111827;">🗓 مهام الغد (${tomorrowTasks.length})</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-align:right;">المهمة</th>
              <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-align:center;width:80px;">الأولوية</th>
            </tr>
          </thead>
          <tbody>${buildTaskRows(tomorrowTasks)}</tbody>
        </table>` : "";

      const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#6735E1 0%,#8B5CF6 100%);padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">⏰ Heed — تذكير بالمهام</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 4px;font-size:16px;color:#374151;">
              مرحباً${profile.name ? ` ${profile.name}،` : "،"}
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
              إليك ملخص المهام المستحقة قريباً التي تحتاج اهتمامك:
            </p>

            ${todaySection}
            ${tomorrowSection}

            <div style="margin-top:28px;">
              <a href="https://heedapp.co/projects"
                 style="display:inline-block;background:#6735E1;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                افتح مهامي
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              أُرسلت هذه الرسالة تلقائياً من تطبيق Heed. لإيقاف هذه التذكيرات يرجى تعديل إعداداتك.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Heed <noreply@heedapp.co>",
          to:   [profile.email],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[remind-tasks] Resend error for ${profile.email}:`, errText);
        errors.push(errText);
      } else {
        sent++;
      }
    }

    return json({ ok: true, sent, errors: errors.length ? errors : undefined });
  } catch (e) {
    console.error("[remind-tasks] unexpected error:", e);
    return json({ error: String(e) }, 500);
  }
});
