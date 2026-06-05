// Image generation — Pollinations (keyless), Cloudflare Workers AI, Hugging Face.

export type ImageModel = "flux" | "flux-realism" | "flux-anime" | "flux-3d" | "flux-cablyai" | "turbo" | "sana";

export function imagePromptUrl(prompt: string, seed?: number, model: ImageModel = "flux"): string {
  const clean = prompt.trim().slice(0, 500);
  const s = seed ?? Math.floor((Date.now() % 100000));
  const params = new URLSearchParams({ model, width: "1024", height: "1024", nologo: "true", enhance: "true", seed: String(s) });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(clean)}?${params.toString()}`;
}

export async function generateImageViaProxy(prompt: string, model: string, signal?: AbortSignal): Promise<string> {
  const { getSupabase, supabaseUrl, supabaseAnonKey } = await import("./supabase");
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token || supabaseAnonKey;

  const localController = new AbortController();
  const timeoutId = setTimeout(() => localController.abort(), 90_000);
  const combined = signal ? anySignal([signal, localController.signal]) : localController.signal;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model, prompt: prompt.trim().slice(0, 1000) }),
      signal: combined,
    });
    if (!res.ok) {
      let msg = "";
      try { const j = await res.json(); msg = j?.error ?? ""; } catch { /* noop */ }
      throw new Error(`تعذّر توليد الصورة (${res.status})${msg ? ": " + msg : ""}`);
    }
    return blobToDataUrl(await res.blob());
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw new Error("انتهى وقت التوليد — جرّب مرة تانية");
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) { controller.abort(); break; }
    s.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
