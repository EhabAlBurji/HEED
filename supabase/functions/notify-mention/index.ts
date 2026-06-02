// Supabase Edge Function: notify a mentioned member.
// Resolves a workspace member by name → user id, then inserts a notification.
// Deploy: `supabase functions deploy notify-mention`.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { workspaceId, memberName, taskTitle, taskId } = await req.json();
    if (!workspaceId || !memberName) {
      return json({ error: "workspaceId and memberName are required" }, 400);
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve the member's user id within this workspace.
    const { data: member } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .ilike("name", memberName)
      .not("user_id", "is", null)
      .maybeSingle();

    if (!member?.user_id) return json({ ok: true, delivered: false });

    await admin.from("notifications").insert({
      id: crypto.randomUUID(),
      recipient_id: member.user_id,
      type: "mention",
      title: `You were mentioned in "${taskTitle ?? "a task"}"`,
      task_id: taskId ?? null,
    });

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
