// notify-dm: send email to receiver when they get a DM
// Body: { receiverId, senderName, preview, appUrl }
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { receiverId, senderName, preview, appUrl } = await req.json();
    if (!receiverId || !senderName) {
      return json({ error: "receiverId and senderName are required" }, 400);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return json({ skipped: true });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the receiver's email from profiles
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", receiverId)
      .maybeSingle();

    if (!profile?.email) return json({ ok: true, delivered: false });

    const safePreview = (preview ?? "").slice(0, 100);
    const link = appUrl ?? "https://heedapp.co";

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
            <h2 style="margin:0 0 12px;font-size:18px;color:#1a1a1a;">💬 رسالة جديدة</h2>
            <p style="margin:0 0 8px;font-size:15px;color:#444;"><strong>${senderName}</strong> أرسل لك رسالة:</p>
            ${safePreview ? `<p style="margin:0 0 24px;font-size:14px;color:#666;background:#f8f9fa;border-right:3px solid #0A4EFF;padding:12px 16px;border-radius:4px;">${safePreview}</p>` : ""}
            <a href="${link}" style="display:inline-block;background:#0A4EFF;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">افتح المحادثة</a>
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
        subject: `💬 رسالة جديدة من ${senderName}`,
        html: emailBody,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[notify-dm] Resend error:", err);
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
