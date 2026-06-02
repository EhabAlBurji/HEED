// Downscale + compress images before they go into the canvas store. Board media
// is kept as base64 inside persisted state, so a raw multi-MB photo would make
// every JSON.stringify on persist (and every Supabase sync) crawl. We cap the
// largest dimension and re-encode as JPEG, shrinking megabytes → ~100-300 KB.

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Returns a compressed data URL for image files; passes other files (and GIFs,
 * which would lose animation) through unchanged. Never throws — falls back to
 * the original data URL on any failure.
 */
export async function fileToStorableDataUrl(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<string> {
  const raw = await readAsDataUrl(file);
  if (!file.type.startsWith("image/") || file.type === "image/gif") return raw;
  try {
    const img = await loadImage(raw);
    let { width, height } = img;
    if (!width || !height) return raw;
    const longest = Math.max(width, height);
    if (longest > maxDim) {
      const s = maxDim / longest;
      width = Math.round(width * s);
      height = Math.round(height * s);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, width, height);
    const out = canvas.toDataURL("image/jpeg", quality);
    // Guard: only use it if it actually got smaller.
    return out.length < raw.length ? out : raw;
  } catch {
    return raw;
  }
}
