// Supabase Edge Function: HEED IMAGE proxy.
// ---------------------------------------------------------------------------
// Holds CF and HF API keys server-side so users never need to bring their own.
// Client sends { model, prompt }, function routes to the right provider and
// returns the binary image back.
//
// Deploy:  supabase functions deploy image
// Secrets: supabase secrets set CF_IMAGE_KEY=... CF_ACCOUNT_ID=... HF_IMAGE_TOKEN=...
// ---------------------------------------------------------------------------

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CF_MODELS: Record<string, string> = {
  "cf:flux-schnell": "@cf/black-forest-labs/flux-1-schnell",
};

const HF_MODELS: Record<string, string> = {
  "hf:sd21":   "stabilityai/stable-diffusion-2-1",
  "hf:sd15":   "runwayml/stable-diffusion-v1-5",
  "hf:sdxl":   "stabilityai/stable-diffusion-xl-base-1.0",
};

/** AbortSignal that fires after `ms` milliseconds. */
function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { model?: unknown; prompt?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  const model  = typeof body.model  === "string" ? body.model.trim()  : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1000) : "";

  if (!model || !prompt) return json({ error: "model and prompt required" }, 400);

  // ── Cloudflare Workers AI ─────────────────────────────────────────────────
  if (model.startsWith("cf:")) {
    const key  = Deno.env.get("CF_IMAGE_KEY");
    const acct = Deno.env.get("CF_ACCOUNT_ID");
    if (!key || !acct) return json({ error: "CF keys not configured on server" }, 500);

    const cfModel = CF_MODELS[model] ?? "@cf/black-forest-labs/flux-1-schnell";

    let res: Response;
    try {
      res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${cfModel}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, num_steps: 4 }),
          signal: timeoutSignal(60_000),
        }
      );
    } catch (e) {
      const msg = String(e);
      const isTimeout = msg.includes("timed out") || msg.includes("TimeoutError");
      return json({ error: isTimeout ? "CF: انتهى وقت الاستجابة، جرّب مرة تانية" : `CF upstream: ${msg}` }, 502);
    }

    if (!res.ok) {
      let detail = "";
      try { const j = await res.json(); detail = j?.errors?.[0]?.message ?? j?.error ?? ""; } catch { detail = await res.text().catch(() => ""); }
      return json({ error: `CF error ${res.status}${detail ? ": " + detail : ""}` }, res.status < 500 ? res.status : 502);
    }

    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = await res.json();
      if (j?.result?.image) {
        const binary = Uint8Array.from(atob(j.result.image), (c) => c.charCodeAt(0));
        return new Response(binary, { headers: { ...cors, "content-type": "image/png" } });
      }
      return json({ error: `CF: لم يرجع صورة — ${JSON.stringify(j).slice(0, 200)}` }, 502);
    }
    const img = await res.arrayBuffer();
    return new Response(img, { headers: { ...cors, "content-type": ct || "image/png" } });
  }

  // ── Hugging Face Inference API ────────────────────────────────────────────
  if (model.startsWith("hf:")) {
    const token = Deno.env.get("HF_IMAGE_TOKEN");
    if (!token) return json({ error: "HF token not configured on server" }, 500);

    const hfModel = HF_MODELS[model] ?? "black-forest-labs/FLUX.1-schnell";

    // Try the HF router endpoint first, fall back to legacy if needed.
    const endpoints = [
      `https://router.huggingface.co/hf-inference/models/${hfModel}`,
      `https://api-inference.huggingface.co/models/${hfModel}`,
    ];

    for (const url of endpoints) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: prompt, parameters: { num_inference_steps: 4 } }),
          signal: timeoutSignal(60_000),
        });
      } catch (e) {
        const msg = String(e);
        // DNS / network error — try next endpoint
        if (msg.includes("dns") || msg.includes("connect") || msg.includes("network") || msg.includes("timed out")) continue;
        return json({ error: `HF upstream: ${msg}` }, 502);
      }

      if (!res.ok) {
        let detail = "";
        try { const j = await res.json(); detail = j?.error ?? ""; } catch { detail = await res.text().catch(() => ""); }
        return json({ error: `HF error ${res.status}${detail ? ": " + detail.slice(0, 200) : ""}` }, 502);
      }

      const img = await res.arrayBuffer();
      const ct  = res.headers.get("content-type") ?? "image/jpeg";
      return new Response(img, { headers: { ...cors, "content-type": ct } });
    }

    return json({ error: "HF: مش قادر يوصل للخادم، جرّب Pollinations أو Cloudflare" }, 502);
  }

  return json({ error: `Unknown model prefix: ${model}` }, 400);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
