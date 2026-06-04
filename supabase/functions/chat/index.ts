// Supabase Edge Function: HEED CHAT proxy.
// ---------------------------------------------------------------------------
// Holds ONE Groq API key server-side so every signed-in user can chat without
// bringing their own key. The key never reaches the client — the app calls
// this function, and this function calls Groq with the secret and streams the
// OpenAI-compatible SSE straight back.
//
// Only authenticated users can reach it (JWT is verified by the gateway), so
// the proxy can't be abused by anonymous traffic.
//
// Deploy:  supabase functions deploy chat
// Secret:  supabase secrets set GROQ_API_KEY=gsk_your_new_key
// ---------------------------------------------------------------------------

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

// Whitelist so a tampered client can't ask for an arbitrary/expensive model.
const ALLOWED_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3-32b",
  "deepseek-r1-distill-llama-70b",
  // vision-capable (used automatically when an image is attached)
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return json({ error: "Server missing GROQ_API_KEY secret" }, 500);

  let payload: { messages?: unknown; model?: unknown; temperature?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "messages[] required" }, 400);
  }

  const model =
    typeof payload.model === "string" && ALLOWED_MODELS.has(payload.model)
      ? payload.model
      : DEFAULT_MODEL;
  const temperature =
    typeof payload.temperature === "number" ? payload.temperature : 0.7;

  let groqRes: Response;
  try {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, messages, temperature, stream: true }),
    });
  } catch (e) {
    return json({ error: "upstream fetch failed", detail: String(e) }, 502);
  }

  if (!groqRes.ok || !groqRes.body) {
    const detail = await groqRes.text().catch(() => "");
    return json({ error: `Groq error ${groqRes.status}`, detail: detail.slice(0, 300) }, groqRes.status);
  }

  // Pass the SSE stream straight through to the client.
  return new Response(groqRes.body, {
    headers: {
      ...cors,
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
