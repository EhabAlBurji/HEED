// Supabase Edge Function: admin approves a user's early-access and emails them.
// Caller must be signed in with an email listed in ADMIN_EMAILS (comma-separated).
// Deploy: `supabase functions deploy approve-access`.
// Env: ADMIN_EMAILS, RESEND_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Verify the caller is an admin.
    const authHeader = req.headers.get("Authorization") ?? "";
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: me } = await anon.auth.getUser();
    const admins = (Deno.env.get("ADMIN_EMAILS") ?? "").split(",").map((s) => s.trim().toLowerCase());
    if (!me.user || !admins.includes((me.user.email ?? "").toLowerCase())) {
      return json({ error: "forbidden" }, 403);
    }

    const { userId } = await req.json();
    if (!userId) return json({ error: "userId required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await admin.from("profiles").update({ access_status: "approved" }).eq("id", userId);

    const { data: profile } = await admin
      .from("profiles")
      .select("email, name")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.email) {
      await sendEmail(
        profile.email,
        "Welcome to Heed — you're in 🎉",
        `<p>Hi ${profile.name ?? "there"},</p>
         <p>Your access to Heed has been approved — you can start using it right now.</p>
         <p>Welcome aboard!</p>`
      );
    }
    return json({ ok: true });
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

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: "Heed <noreply@heed.app>", to, subject, html }),
  });
}
