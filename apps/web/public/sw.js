// Minimal app-shell service worker. Caches the shell, locale data, and icons
// so the site is reachable offline; the schedule itself is cached separately
// in localStorage by the app (see app/[locale]/pancha-pakshi/page.tsx) and
// re-rendered there with an explicit "cached, not live" label — this worker
// does not attempt any astronomical calculation of its own.
const CACHE_NAME = "ff-astrology-shell-v2";
// Locale data is bundled into the page JS (imported at build time, not
// fetched from a public URL), so it's cached automatically once the page
// itself is cached below — no separate /locales/*.json entries needed here.
const PRECACHE_URLS = [
  "/en",
  "/si",
  "/en/pancha-pakshi",
  "/si/pancha-pakshi",
  "/icons/app/icon-192.png",
  "/icons/app/icon-512.png",
  "/icons/app/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/generated/birds/vulture-64.png",
  "/icons/generated/birds/owl-64.png",
  "/icons/generated/birds/crow-64.png",
  "/icons/generated/birds/cock-64.png",
  "/icons/generated/birds/peacock-64.png",
  "/icons/generated/activities/ruling-64.png",
  "/icons/generated/activities/eating-64.png",
  "/icons/generated/activities/walking-64.png",
  "/icons/generated/activities/sleeping-64.png",
  "/icons/generated/activities/dying-64.png",
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

// Period alerts: the payload (title/body/url, already localized) is composed
// server-side by the dispatch route — this worker only displays it.
self.addEventListener("push", (event) => {
  let payload = { title: "Fernando Family Astrology", body: "", url: "/" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // Keep the fallback payload if the data isn't JSON.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/apple-touch-icon.png",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/pancha-pakshi") && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
