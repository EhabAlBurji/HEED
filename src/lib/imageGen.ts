// =========================================================================
// Image generation — free & keyless via Pollinations' open image endpoint.
// Returns a URL the browser loads directly (the model renders on request),
// so no API key or backend is required. Swap for Google Imagen / a proxied
// model later by changing only this file.
// =========================================================================

/** Available free models — ordered best→fastest. */
export type ImageModel = "flux" | "flux-realism" | "flux-anime" | "turbo";

export function imagePromptUrl(prompt: string, seed?: number, model: ImageModel = "flux"): string {
  const clean = prompt.trim().slice(0, 500);
  const s = seed ?? Math.floor((Date.now() % 100000));
  const params = new URLSearchParams({
    model,
    width: "1024",
    height: "1024",
    nologo: "true",
    enhance: "true",
    seed: String(s),
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(clean)}?${params.toString()}`;
}
