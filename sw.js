/* ВЕЗУ service worker: сеть в первую очередь, кэш — для работы офлайн */
var CACHE = 'vezu-v6';
var SHELL = ['./', 'index.html', 'card.html', 'new.html', 'tarify.html', 'catalog.html', 'js/config.js', 'js/cloud.js', 'js/pro.js', 'js/pay.js', 'js/catalog.js', 'css/style.css', 'js/common.js', 'js/card.js', 'js/new.js',
  'js/vendor/qrcode.js', 'js/vendor/inflate.js', 'favicon.svg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'img/hero-van-720.webp', 'img/v-kabluk.webp', 'img/v-gazel.webp', 'img/v-gazel-long.webp', 'img/v-truck3.webp'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok && res.type === 'basic') {
      var copy = res.clone(), url = new URL(req.url);
      url.search = '';
      caches.open(CACHE).then(function (c) { c.put(url.href, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (r) {
      return r || (req.mode === 'navigate' ? caches.match('card.html') : Response.error());
    });
  }));
});
