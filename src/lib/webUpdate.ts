// Web auto-update. When a newer build is deployed, the open tab reloads itself
// the next time it regains focus / becomes visible — so the web app always
// opens on the latest version with no manual hard-refresh. It compares the
// entry-bundle hash currently running against the one the server now serves.
// No-op in the Tauri desktop app (native updater) and in dev (no hashed entry).

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// The hashed entry bundle the page is currently running (e.g. index-AbC123.js).
function runningEntry(): string | null {
  for (const s of Array.from(document.getElementsByTagName("script"))) {
    const m = s.src.match(/(index-[A-Za-z0-9_-]+\.js)/);
    if (m) return m[1];
  }
  return null;
}

export function startWebUpdateWatcher(): void {
  if (isTauri() || typeof window === "undefined") return;
  const running = runningEntry();
  if (!running) return; // dev server / unexpected markup

  let busy = false;
  const check = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      // Cache-busted, no-store fetch of the app shell → always the freshest HTML.
      const html = await fetch(`${import.meta.env.BASE_URL}?_v=${Date.now()}`, {
        cache: "no-store",
      }).then((r) => r.text());
      const m = html.match(/(index-[A-Za-z0-9_-]+\.js)/);
      if (m && m[1] !== running) {
        // A new version is live → reload to it. (Safe moment: tab just regained
        // focus/visibility, so the user isn't mid-typing.)
        window.location.reload();
        return;
      }
    } catch {
      /* offline / network hiccup — try again next time */
    }
    busy = false;
  };

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void check();
  });
  window.addEventListener("focus", () => void check());
}
