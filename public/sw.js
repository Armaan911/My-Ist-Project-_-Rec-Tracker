/* Recruit Tracker service worker — offline fallback + safe caching.
   Bump CACHE_VERSION on every meaningful change to purge old clients' caches. */
const CACHE_VERSION = "rt-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting())
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
  const url = new URL(req.url);

  if (req.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // App navigations (HTML): NETWORK-ONLY, with the offline page as the only fallback.
  // We never serve a cached HTML document — a stale shell can reference build chunks that
  // no longer exist after a deploy, which on iOS Safari shows up as a blank white screen.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Content-hashed build assets are immutable → cache-first is safe. Icons/fonts too.
  // Only successful responses are cached, and we never resolve to a broken response.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
  }
});
