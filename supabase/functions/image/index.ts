// Supabase Edge Function: HEED IMAGE proxy.
// Routes to Google Gemini image generation.
// Deploy:  supabase functions deploy image
// Secrets: supabase secrets set GOOGLE_AI_KEY=...

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_IMAGE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { prompt?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1000) : "";
  if (!prompt) return json({ error: "prompt required" }, 400);

  const apiKey = Deno.env.get("GOOGLE_AI_KEY");
  if (!apiKey) return json({ error: "GOOGLE_AI_KEY not configured on server" }, 500);

  let res: Response;
  try {
    res = await fetch(`${GEMINI_IMAGE_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    return json({ error: `Gemini image fetch failed: ${String(e)}` }, 502);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return json({ error: `Gemini image error ${res.status}`, detail: detail.slice(0, 300) }, res.status);
  }

  let data: { candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[] };
  try { data = await res.json(); } catch { return json({ error: "Gemini returned invalid JSON" }, 502); }

  const inlineData = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inlineData?.data) {
    return json({ error: "Gemini did not return an image" }, 502);
  }

  const binary = Uint8Array.from(atob(inlineData.data), (c) => c.charCodeAt(0));
  return new Response(binary, {
    headers: { ...cors, "content-type": inlineData.mimeType || "image/png" },
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
