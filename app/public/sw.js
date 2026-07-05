// YDK Decoder — service worker. Gives the installed app offline support
// WITHOUT ever serving a stale build:
//   • Vite fingerprints asset filenames, so cached JS/CSS can never go stale
//     (a new build has new names) → cache-first is safe for them.
//   • HTML navigations are network-first, so a fresh deploy is always picked
//     up when you're online; the cached shell is only used offline.
//   • Cross-origin requests (the YGOPRODeck card API/images) are left alone.
// Bump CACHE to force-drop old caches on the next activate.
const CACHE = "ydk-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch the card API / images

  // HTML navigations: network-first (always get the latest deploy online),
  // fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  // Fingerprinted static assets: cache-first, fill the cache in the background.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      return cached || Response.error();
    }
  })());
});
