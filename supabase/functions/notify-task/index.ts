// notify-task: send email to assignee when a task is assigned to them
// Body: { assigneeId, assignerName, taskTitle, taskId, workspaceId, appUrl }
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { assigneeId, assignerName, taskTitle, taskId, appUrl } = await req.json();
    if (!assigneeId || !assignerName) {
      return json({ error: "assigneeId and assignerName are required" }, 400);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return json({ skipped: true });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the assignee's email from profiles
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", assigneeId)
      .maybeSingle();

    if (!profile?.email) return json({ ok: true, delivered: false });

    const safeTitle = (taskTitle ?? "مهمة جديدة").slice(0, 120);
    const link = appUrl ?? "https://heedapp.co";
    const taskLink = taskId ? `${link}?taskId=${taskId}` : link;

    const emailBody = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0A4EFF;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Heed</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;font-size:18px;color:#1a1a1a;">📋 مهمة جديدة مُسنَدة إليك</h2>
            <p style="margin:0 0 8px;font-size:15px;color:#444;">قام <strong>${assignerName}</strong> بإسناد مهمة جديدة إليك:</p>
            <div style="margin:0 0 24px;background:#f8f9fa;border-right:3px solid #0A4EFF;padding:12px 16px;border-radius:4px;">
              <p style="margin:0;font-size:15px;font-weight:600;color:#1a1a1a;">${safeTitle}</p>
            </div>
            <a href="${taskLink}" style="display:inline-block;background:#0A4EFF;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">افتح المهمة</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#999;">أُرسلت هذه الرسالة تلقائياً من تطبيق Heed. لإلغاء الاشتراك، يرجى تعديل إعداداتك.</p>
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
        to: [profile.email],
        subject: `📋 مهمة جديدة: ${safeTitle}`,
        html: emailBody,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[notify-task] Resend error:", err);
      return json({ ok: false, error: err }, 500);
    }

    return json({ ok: true, delivered: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
