// Supabase Edge Function: admin rejects / revokes a user's access.
// Caller must be signed in with an email listed in ADMIN_EMAILS (comma-separated).
// Deploy: `supabase functions deploy reject-access`.
// Env: ADMIN_EMAILS.
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
    // An admin must not be able to lock themselves out.
    if (userId === me.user.id) return json({ error: "cannot reject yourself" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await admin.from("profiles").update({ access_status: "rejected" }).eq("id", userId);
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
