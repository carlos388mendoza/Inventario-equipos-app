const VERSION = "v2";
const CORE = ["./offline.html"];

/**
 * Un `Response` solo se guarda si el servidor lo permite. Las páginas de la app
 * salen con `Cache-Control: private, no-store` (llevan un `nonce` y datos de
 * sesión); guardarlas en la Cache API filtraría contenido autenticado que
 * sobreviviría al cierre de sesión o a otro usuario del mismo equipo.
 */
function isCacheable(response) {
  if (!response || !response.ok) return false;
  const cacheControl = (response.headers.get("cache-control") || "").toLowerCase();
  return (
    !cacheControl.includes("no-store") && !cacheControl.includes("private")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.get("rsc") === "1") return;
  if (request.headers.get("next-router-prefetch") === "1") return;
  if (url.pathname.startsWith("/api/")) return;

  // Navegaciones: primero red, con respaldo offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              caches.match("./offline.html").then((fallback) => fallback || Response.error())
          )
        )
    );
    return;
  }

  // Assets estáticos: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});
