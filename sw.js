// Service worker: e bën programin të instalueshëm si aplikacion.
// Gjithmonë merr versionin më të ri nga interneti; kopjen e ruajtur e përdor vetëm kur s'ka internet,
// që programi të hapet dhe të tregojë mesazhin në vend të një faqeje bosh.
const CACHE = 'pizzeria-pos-v1';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'backend.js', 'config.js', 'manifest.json', 'icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // vetëm skedarët e vetë programit; Supabase dhe të tjerat shkojnë direkt në internet
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
