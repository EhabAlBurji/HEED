// Supabase Edge Function: HEED CHAT proxy.
// ---------------------------------------------------------------------------
// Routes to Groq (Llama / Mixtral) or Google AI (Gemini) based on model id.
// Both keys are stored server-side — users never see them.
//
// Deploy:  supabase functions deploy chat
// Secrets: supabase secrets set GROQ_API_KEY=gsk_... GOOGLE_AI_KEY=AIza...
// ---------------------------------------------------------------------------

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

// Whitelist — prevents a tampered client from requesting arbitrary/costly models.
const ALLOWED_MODELS = new Set([
  // ── Groq / Llama ──────────────────────────────────────────────────────────
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3-32b",
  "deepseek-r1-distill-llama-70b",
  // vision (auto-selected when an image is attached)
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  // ── Google Gemini ─────────────────────────────────────────────────────────
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

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

  // ── Route to the right provider ───────────────────────────────────────────
  const isGemini = model.startsWith("gemini-");
  const apiUrl   = isGemini ? GEMINI_URL : GROQ_URL;
  const apiKey   = isGemini
    ? Deno.env.get("GOOGLE_AI_KEY")
    : Deno.env.get("GROQ_API_KEY");

  if (!apiKey) {
    return json({
      error: isGemini
        ? "Server missing GOOGLE_AI_KEY secret"
        : "Server missing GROQ_API_KEY secret",
    }, 500);
  }

  let upstream: Response;
  try {
    upstream = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature, stream: true }),
    });
  } catch (e) {
    return json({ error: "upstream fetch failed", detail: String(e) }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return json(
      { error: `${isGemini ? "Gemini" : "Groq"} error ${upstream.status}`, detail: detail.slice(0, 300) },
      upstream.status
    );
  }

  // SSE stream — pass straight through to the client.
  return new Response(upstream.body, {
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
