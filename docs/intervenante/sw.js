/* Garde seulement le code de l'appli (jamais les données) pour qu'elle s'ouvre vite.
   Toujours le réseau d'abord : une nouvelle version arrive dès qu'il y a Internet. */
const VERSION = "oikos-int-1";
const FICHIERS = ["./", "index.html", "manifest.webmanifest", "icone-192.png", "icone-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.hostname.endsWith("supabase.co")) return;   // les données ne passent jamais par le cache
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && (u.origin === location.origin || u.hostname === "cdn.jsdelivr.net")) {
      const copie = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copie));
    }
    return r;
  }).catch(() => caches.match(e.request)));
});
