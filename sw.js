/* ВЕЗУ service worker (статическая версия): сеть в первую очередь, кэш — чтобы генератор и QR работали офлайн.
   Данные визиток сюда не попадают: они в # адреса, а # не входит в запросы. */
var CACHE = 'vezu-static-v3';
var SHELL = ['./', 'index.html', 'vizitka/', 'privacy.html', 'card.html', 'css/vz.css', 'js/vz.js', 'js/gen.js', 'js/view.js', 'js/legacy.js',
  'js/vendor/qrcode.js', 'js/vendor/inflate.js', 'favicon.svg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'img/hero-van-720.webp', 'img/v-kabluk.webp', 'img/v-gazel.webp', 'img/v-gazel-long.webp', 'img/v-truck3.webp'];
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }));
});
// Удаляем только свои кэши: прошлые vezu-static-* и старые vezu-v1…v25 этого адреса. Кэши платформы /vezu/ (vezu-platform-*) не трогаем.
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && (k.indexOf('vezu-static-') === 0 || /^vezu-v\d+$/.test(k)); }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Навигация: только страницы сайта; прочие адреса (старые короткие адреса, 404) — напрямую в сеть.
var PAGES = /^(|index\.html|vizitka\/|vizitka\/index\.html|privacy\.html|card\.html)$/;
self.addEventListener('fetch', function (e) {
  var req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin) return;
  var nav = req.mode === 'navigate', rel = u.href.split(/[?#]/)[0].slice(self.registration.scope.length);
  if (nav && !PAGES.test(rel)) return;
  var net = nav ? fetch(new Request(u.href.split('#')[0], { cache: 'no-cache', redirect: 'manual', credentials: 'same-origin' })) : fetch(req, { cache: 'no-cache' });
  e.respondWith(net.then(function (res) {
    if (res && res.ok && res.type === 'basic' && !res.redirected) {
      var copy = res.clone(), url = new URL(req.url);
      url.search = ''; url.hash = '';
      if (url.pathname.slice(-11) === '/index.html') url.pathname = url.pathname.slice(0, -10);
      caches.open(CACHE).then(function (c) { c.put(url.href, copy); });
    }
    return res;
  }).catch(function () {
    var url = new URL(req.url); url.search = ''; url.hash = '';
    if (url.pathname.slice(-11) === '/index.html') url.pathname = url.pathname.slice(0, -10);
    return caches.match(url.href).then(function (r) { return r || caches.match(req, { ignoreSearch: true }); }).then(function (r) {
      return r || (nav ? caches.match('./') : Response.error());
    });
  }));
});
