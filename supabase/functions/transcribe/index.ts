// Supabase Edge Function: HEED CHAT voice transcription proxy.
// ---------------------------------------------------------------------------
// Receives an audio blob (multipart/form-data, field "file") from the app and
// forwards it to Groq's Whisper endpoint using the server-side key, returning
// { text }. Keeps the Groq key secret, same as the chat proxy.
//
// Deploy:  supabase functions deploy transcribe
// Secret:  reuses GROQ_API_KEY (already set for the chat function).
// ---------------------------------------------------------------------------

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL = "whisper-large-v3-turbo";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return json({ error: "Server missing GROQ_API_KEY secret" }, 500);

  let inForm: FormData;
  try {
    inForm = await req.formData();
  } catch {
    return json({ error: "expected multipart/form-data" }, 400);
  }
  const file = inForm.get("file");
  if (!(file instanceof File)) return json({ error: "audio 'file' required" }, 400);

  const out = new FormData();
  out.append("file", file, file.name || "audio.webm");
  out.append("model", WHISPER_MODEL);
  // language hint optional; Whisper auto-detects (handles Arabic + English).

  let groqRes: Response;
  try {
    groqRes = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: out,
    });
  } catch (e) {
    return json({ error: "upstream fetch failed", detail: String(e) }, 502);
  }

  if (!groqRes.ok) {
    const detail = await groqRes.text().catch(() => "");
    return json({ error: `Groq error ${groqRes.status}`, detail: detail.slice(0, 300) }, groqRes.status);
  }

  const data = await groqRes.json();
  return json({ text: data?.text ?? "" });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
