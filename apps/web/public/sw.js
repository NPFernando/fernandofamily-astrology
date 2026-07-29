// Minimal app-shell service worker. Precache only the locale fallback shells
// and install metadata so activation stays fast on mobile connections. Pages,
// posters, and generated badges are cached at runtime as users visit them.
// The schedule itself is cached separately
// in localStorage by the app (see app/[locale]/pancha-pakshi/page.tsx) and
// re-rendered there with an explicit "cached, not live" label — this worker
// does not attempt any astronomical calculation of its own.
const CACHE_NAME = "ff-astrology-shell-v10";
const POSTER_CACHE_NAME = "ff-astrology-posters-v1";
const MAX_POSTER_ENTRIES = 96;
// Locale data is bundled into the page JS (imported at build time, not
// fetched from a public URL), so it's cached automatically once the page
// itself is cached below — no separate /locales/*.json entries needed here.
const PRECACHE_URLS = [
  "/en",
  "/si",
  "/icons/app/icon-192.png",
  "/icons/app/icon-512.png",
  "/icons/app/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
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
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== POSTER_CACHE_NAME).map((key) => caches.delete(key))))
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

  if (url.origin === self.location.origin && url.pathname.startsWith("/posters/")) {
    event.respondWith(
      caches.open(POSTER_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_POSTER_ENTRIES)).map((key) => cache.delete(key)));
        }
        return response;
      }),
    );
    return;
  }

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
