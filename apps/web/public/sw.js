/* Mesh Service Worker. Nur die Hülle: gebaute Dateien, Symbole und eine Seite für
   "keine Verbindung". Seiten, Anmeldung und Schnittstellen laufen immer über das Netz
   und landen nie im Cache, weil ihr Inhalt von der Sitzung abhängt. */
const VERSION = "mesh-shell-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/app-icon-192.png"];

/** Entscheidet je Anfrage: "bypass" (SW fasst nichts an), "page" (Netz, sonst Offline-Seite), "static" (Cache zuerst). */
function strategy(method, url, mode, origin) {
  if (method !== "GET") return "bypass";
  const u = new URL(url);
  if (u.origin !== origin) return "bypass";
  const p = u.pathname;
  if (p.startsWith("/api/") || p.startsWith("/login") || p.startsWith("/admin/login")) return "bypass";
  if (p.startsWith("/_next/static/") || p.startsWith("/icons/")) return "static";
  if (mode === "navigate") return "page";
  return "bypass";
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const kind = strategy(req.method, req.url, req.mode, self.location.origin);
  if (kind === "bypass") return;

  if (kind === "page") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
