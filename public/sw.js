/* Recruit Tracker service worker — intentionally NON-caching.
   It exists only so the app is installable (PWA) and has an offline fallback. It never
   caches HTML or build assets, so it can never serve a stale build — every request goes
   to the network, and the browser's own HTTP cache handles immutable hashed assets.
   Bump CACHE_VERSION on any change to purge older clients' caches. */
const CACHE_VERSION = "rt-v3";
const PRECACHE = `${CACHE_VERSION}-precache`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((c) => c.add(OFFLINE_URL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Navigations: always go to the network (never a cached shell). Only fall back to the
  // offline page when the device is genuinely offline. Everything else (JS/CSS/images) is
  // left to the browser's normal HTTP cache — not cached here — so nothing can go stale.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
