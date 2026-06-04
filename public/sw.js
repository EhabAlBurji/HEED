const CACHE = "heed-v1";
const PRECACHE = ["/", "/app/", "/heed-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Only cache GET requests for same origin or static assets
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Never cache Supabase API calls
  if (url.hostname.includes("supabase") || url.hostname.includes("supabase.co")) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((res) => {
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      // For navigation requests, try network first, fall back to cache
      return url.pathname.startsWith("/app/") ? (network || cached) : (cached || network);
    })
  );
});
