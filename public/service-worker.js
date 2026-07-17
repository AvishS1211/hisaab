// Hand-rolled, on purpose (CLAUDE.md §9: "hand-rolled is fine and smaller").
// Two jobs: keep the app shell available offline, and never touch a write.
//
// Writes always go straight to fetch() from the page (Supabase inserts) and
// this worker only ever intercepts GETs — the offline *write* queue is a
// separate concern, handled in the page via IndexedDB (src/lib/offlineQueue.ts).

const CACHE = "hisaab-shell-v1";
const CORE_ASSETS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never intercept a write

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase etc. — pass through untouched

  if (request.mode === "navigate") {
    // Network-first for pages: always prefer the live app when online, cache
    // the result for next time, fall back to the shell when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  // Static assets (fonts, icons, JS/CSS chunks): cache-first, refresh quietly.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
