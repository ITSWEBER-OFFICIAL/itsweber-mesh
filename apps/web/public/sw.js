/* Mesh Service Worker. Nur die Hülle: gebaute Dateien, Symbole und eine Seite für
   "keine Verbindung". Seiten, Anmeldung und Schnittstellen laufen immer über das Netz
   und landen nie im Cache, weil ihr Inhalt von der Sitzung abhängt. */
const VERSION = "mesh-shell-v2";
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

/* Mitteilungen. Der Inhalt kommt verschlüsselt vom Mesh-Server und enthält nur
   Titel, Text und einen Pfad innerhalb der App. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Mesh";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      icon: "/icons/app-icon-192.png",
      badge: "/icons/app-icon-96.png",
      data: { url: safePath(data.url) },
    }),
  );
});

/** Nur Pfade der eigenen App, nie eine fremde Adresse aus einer Mitteilung. */
function safePath(url) {
  return typeof url === "string" && /^\/[A-Za-z0-9\-_/?=&.]*$/.test(url) && !url.startsWith("//") ? url : "/";
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
