// Minimal app-shell service worker. Caches the shell, locale data, and icons
// so the site is reachable offline; the schedule itself is cached separately
// in localStorage by the app (see app/[locale]/pancha-pakshi/page.tsx) and
// re-rendered there with an explicit "cached, not live" label — this worker
// does not attempt any astronomical calculation of its own.
const CACHE_NAME = "ff-astrology-shell-v1";
// Locale data is bundled into the page JS (imported at build time, not
// fetched from a public URL), so it's cached automatically once the page
// itself is cached below — no separate /locales/*.json entries needed here.
const PRECACHE_URLS = [
  "/en",
  "/si",
  "/en/pancha-pakshi",
  "/si/pancha-pakshi",
  "/icons/icon.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" }))))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Never intercept API calls — the app itself handles online/offline
  // fallback for calculation requests explicitly and labels cached data.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache good, same-origin responses: a 404/5xx served mid-deploy
        // (or an opaque redirect) written into the shell cache would later be
        // served offline in place of a working page.
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(() => {
        // Offline fallback shell must match the user's locale — an English
        // user hitting an uncached path shouldn't land on the Sinhala shell.
        const fallback = url.pathname.startsWith("/en") ? "/en" : "/si";
        return caches.match(request).then((cached) => cached ?? caches.match(fallback));
      }),
  );
});
