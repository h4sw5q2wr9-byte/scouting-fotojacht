const NAME = "fotojacht-deck-v2.5.1-icons";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./challenges.js",
  "./vendor/fflate.js",
  "./manifest.webmanifest",
  "./manifest.webmanifest?v=bcdf49eb1bf3",
  "./assets/icon.svg",
  "./assets/fotojacht-icon-32-efdfd8ce02dc.png",
  "./assets/fotojacht-icon-180-99a49de2fca9.png",
  "./assets/fotojacht-icon-192-266f80f7d196.png",
  "./assets/fotojacht-icon-512-13bf584abc9d.png",
  "./assets/fotojacht-favicon-20c631674db2.ico",
  "./credits.html",
  "./docs/user-reference-uploads.md",
  "./assets/references/sources.json",
  "./archive/challenges-v1.json",
];
const allowed = new Set(
  CORE.map((path) => new URL(path, self.location.href).pathname),
);
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(NAME);
      await cache.addAll(CORE);
      const response = await cache.match("./assets/references/sources.json");
      const manifest = await response.json();
      // Preload the complete small deck: no remote originals or personal photos.
      for (const item of manifest.items.filter((i) => i.status === "ready")) {
        await cache.add("./" + item.image);
        if (item.previewImage) await cache.add("./" + item.previewImage);
      }
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("fotojacht-") && key !== NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    event.request.headers.has("authorization")
  )
    return;
  // Versioned public test links are the same static document, including offline.
  const versionedNavigation =
    event.request.mode === "navigate" &&
    [...url.searchParams.keys()].every((key) => key === "v");
  const versionedManifest =
    url.pathname === new URL("./manifest.webmanifest", self.location.href).pathname &&
    [...url.searchParams.keys()].every((key) => key === "v");
  if (url.search && !versionedNavigation && !versionedManifest) return;
  const normalized = new URL(url);
  normalized.search = "";
  const cacheKey = url.search ? normalized.href : event.request;
  if (
    !allowed.has(url.pathname) &&
    !url.pathname.startsWith(
      new URL("./assets/references/", self.location.href).pathname,
    )
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(NAME).then((cache) => cache.put(cacheKey, copy)),
          );
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(cacheKey);
        if (cached) return cached;
        if (event.request.mode === "navigate")
          return (await caches.match("./index.html")) || Response.error();
        return Response.error();
      }),
  );
});
