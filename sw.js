/* Service Worker der Rechnungs-App.

   Zweck: Die App startet auch ohne Netz. Erfassen, Liste, Auswertung und bereits lokal
   vorliegende Belege funktionieren dann; Auslesen (Claude) und Sync (GitHub) brauchen
   naturgemäß eine Verbindung und melden sich mit ihren eigenen Fehlern.

   Die Strategie ist bewusst zweigeteilt:
   - index.html zuerst aus dem Netz. Die gesamte App steckt in dieser einen Datei und ändert
     sich oft — eine veraltete Kopie aus dem Cache wäre schlimmer als eine Sekunde Wartezeit.
     Jede erfolgreiche Antwort frischt die Offline-Kopie auf.
   - Bibliotheken und Icons zuerst aus dem Cache. Die ändern sich praktisch nie.

   Fremde Hosts (api.anthropic.com, api.github.com) laufen komplett unangetastet durch:
   API-Antworten dürfen weder abgefangen noch zwischengespeichert werden. */

const CACHE = "rechnungsapp-v1";

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./lib/xlsx.full.min.js",
  "./lib/pdf-lib.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // Einzeln statt addAll: ein fehlender Eintrag soll nicht die ganze Installation kippen.
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch((err) => console.warn("nicht vorgeladen:", u, err)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheAuffrischen(req, res) {
  if (res && res.ok) {
    const kopie = res.clone();
    caches.open(CACHE).then((c) => c.put(req, kopie)).catch(() => { /* Cache voll o.ä. */ });
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Claude- und GitHub-API nicht anfassen

  const istSeite = req.mode === "navigate"
    || url.pathname.endsWith("/")
    || url.pathname.endsWith("/index.html");

  if (istSeite) {
    e.respondWith(
      fetch(req)
        .then((res) => cacheAuffrischen(req, res))
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => cacheAuffrischen(req, res)))
  );
});
