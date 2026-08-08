// YDK Decoder — service worker. Gives the installed app offline support
// WITHOUT ever serving a stale build:
//   • ONLY Vite's fingerprinted /assets/ files are cache-first — their names
//     change every build, so they can never go stale.
//   • EVERYTHING else same-origin (HTML, manifest, icons, logo) is
//     network-first with cache fallback. v1 cached the manifest + icons
//     cache-first, which froze the app icon forever: when Chrome rebuilt the
//     home-screen shortcut it was handed the months-old cached manifest.
//   • Cross-origin requests (the YGOPRODeck card API/images) are left alone.
// Bump CACHE to force-drop old caches on the next activate.
const CACHE = "ydk-cache-v2";

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

  // Fingerprinted /assets/ files: cache-first (immutable by construction).
  if (url.pathname.includes("/assets/")) {
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
        return Response.error();
      }
    })());
    return;
  }

  // Everything else same-origin (manifest, icons, logo, …): network-first so
  // updates always land; the cache only answers when offline.
  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      return (await caches.match(req)) || Response.error();
    }
  })());
});
