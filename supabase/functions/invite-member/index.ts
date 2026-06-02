// Supabase Edge Function: invite a member to a workspace.
// Looks up the invitee by email (service role), inserts a notification they'll
// receive in realtime, and emails them. Deploy: `supabase functions deploy invite-member`.
// Env required: RESEND_API_KEY (or swap the email block for your provider).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { email, workspaceId, workspaceName, workspaceColor, inviterName } = await req.json();
    if (!email || !workspaceId) {
      return json({ error: "email and workspaceId are required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the invitee's user id by email.
    const { data: profile } = await admin
      .from("profiles")
      .select("id, name")
      .eq("email", email)
      .maybeSingle();

    // If they already have an account, drop an in-app notification.
    if (profile?.id) {
      await admin.from("notifications").insert({
        id: crypto.randomUUID(),
        recipient_id: profile.id,
        type: "workspace_invite",
        title: `Invitation to join "${workspaceName}"`,
        body: `${inviterName ?? "A teammate"} invited you to the "${workspaceName}" workspace.`,
        workspace_id: workspaceId,
        workspace_name: workspaceName,
        workspace_color: workspaceColor ?? "#6735E1",
      });
    }

    // Email them (works whether or not they already have an account).
    await sendEmail(
      email,
      `You're invited to "${workspaceName}" on Heed`,
      `<p>${inviterName ?? "A teammate"} invited you to collaborate on the <b>${workspaceName}</b> workspace in Heed.</p>
       <p>Open Heed and accept the invite from your notifications to get started.</p>`
    );

    return json({ ok: true, delivered: Boolean(profile?.id) });
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
  if (!key) return; // email is optional — notification still delivered in-app
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: "Heed <noreply@heed.app>", to, subject, html }),
  });
}
