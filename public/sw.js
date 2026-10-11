// Service worker for fotballquizen, så /quiz kan åpnes og spilles helt uten nett.
// Resten av appen trenger nett som før: den eneste endringen er at en side som ikke kan lastes
// uten nett sender brukeren til quizen, hvis quizen er lagret.
const CACHE = "quiz-offline-v1";
const QUIZ_PAGE = "/quiz";
const STATIC = /^\/(_next\/static|crests|flags|players)\//;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("quiz-offline-") && key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

// Quizsiden sender listen over filene den bruker (sidens HTML, JS/CSS-bitene og bildene).
// Gamle JS/CSS-biter fra en tidligere versjon av appen slettes, bildene beholdes.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-quiz" || !Array.isArray(event.data.urls)) return;
  const wanted = new Set(event.data.urls.map((url) => new URL(url, self.location.origin).pathname));
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const existing = await cache.keys();
      const have = new Set(existing.map((request) => new URL(request.url).pathname));
      await Promise.all(
        existing
          .filter((request) => {
            const path = new URL(request.url).pathname;
            return path.startsWith("/_next/static/") && !wanted.has(path);
          })
          .map((request) => cache.delete(request)),
      );
      let failed = 0;
      await Promise.all(
        [...wanted].map(async (path) => {
          // Filene under /_next/static har innholdet i navnet og endrer seg aldri, så de hentes bare én gang.
          if (path !== QUIZ_PAGE && have.has(path)) return;
          try {
            const response = await fetch(path, { credentials: "same-origin" });
            if (response.ok) await cache.put(path, response);
            else failed++;
          } catch {
            failed++;
          }
        }),
      );
      event.source?.postMessage({ type: "quiz-cached", failed });
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (url.pathname === QUIZ_PAGE && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(QUIZ_PAGE, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(QUIZ_PAGE);
          if (!cached) return Response.error();
          return url.pathname === QUIZ_PAGE ? cached : Response.redirect(QUIZ_PAGE, 302);
        }),
    );
    return;
  }

  if (STATIC.test(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(request)));
  }
});
