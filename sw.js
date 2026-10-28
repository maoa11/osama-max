// لوحة أسامة — offline cache. Bump VERSION on every deploy so phones pick up the new index.html.
var VERSION = 'board-v16';
var CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png', './firebase-config.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // The page itself: network first (fresh when online), cache when offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put('./index.html', copy); });
      return res;
    }).catch(function () { return caches.match('./index.html'); }));
    return;
  }

  // Same-origin files + Google Fonts (Tajawal) + the Firebase SDK files: cache first, fill on first use.
  // (Firestore / sign-in traffic itself is never cached.)
  var firebaseSdk = url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0;
  var pdfLibs = url.hostname === 'cdn.jsdelivr.net' && /^\/npm\/(html-to-image|jspdf|mediabunny)@/.test(url.pathname);
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || firebaseSdk || pdfLibs) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
  }
});
