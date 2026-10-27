/* ВЕЗУ service worker: сеть в первую очередь, кэш — для работы офлайн */
var CACHE = 'vezu-v13';
var SHELL = ['./', 'index.html', 'card.html', 'new.html', 'tarify.html', 'catalog.html', 'app.html', 'privacy.html', 'js/config.js', 'js/calc.js', 'js/favs.js', 'js/reviews.js', 'js/cab.js', 'js/app.js', 'js/cloud.js', 'js/pro.js', 'js/pay.js', 'js/catalog.js', 'css/style.css', 'js/common.js', 'js/card.js', 'js/new.js',
  'js/vendor/qrcode.js', 'js/vendor/inflate.js', 'favicon.svg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'img/hero-van-720.webp', 'img/v-kabluk.webp', 'img/v-gazel.webp', 'img/v-gazel-long.webp', 'img/v-truck3.webp'];
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).catch(function () {}));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Навигация: перехватываем ТОЛЬКО известные страницы сайта. Остальные адреса (короткие адреса водителей
// …/dogruz/<адрес>, редиректы 301, 404) идут в сеть напрямую, без service worker.
// Для навигации нельзя отдавать ответ после редиректа (Chrome показывает ERR_FAILED), поэтому redirect: 'manual'.
// Админку не кэшируем вовсе. Остальное — сеть в первую очередь с проверкой свежести (no-cache), кэш — только для офлайна.
var PAGES = /^(|index\.html|card\.html|new\.html|tarify\.html|catalog\.html|app\.html|privacy\.html)$/;
var NOCACHE = /\/(admin\.html|js\/admin\.js)$/;
self.addEventListener('fetch', function (e) {
  var req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin) return;
  var nav = req.mode === 'navigate';
  if (nav && !PAGES.test(u.href.split(/[?#]/)[0].slice(self.registration.scope.length))) return;
  if (NOCACHE.test(u.pathname)) return;
  var net = nav ? fetch(new Request(req.url, { cache: 'no-cache', redirect: 'manual', credentials: 'same-origin' })) : fetch(req, { cache: 'no-cache' });
  e.respondWith(net.then(function (res) {
    if (res && res.ok && res.type === 'basic' && !res.redirected) {
      var copy = res.clone(), url = new URL(req.url);
      url.search = '';
      caches.open(CACHE).then(function (c) { c.put(url.href, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (r) {
      return r || (nav ? caches.match('card.html') : Response.error());
    });
  }));
});
self.addEventListener('message', function (e) { if (e.data === 'skip') self.skipWaiting(); });
