(function () {
  'use strict';
  var V = window.VEZU, C = window.VZC;
  var app = document.getElementById('app');
  var langBtns = document.querySelectorAll('[data-lang]');
  function markLang() { langBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === V.lang())); }); }
  V.setLang(V.savedLang()); markLang();

  // короткий адрес: card.html?u=<slug> (или /dogruz/<slug> через 404.html) — визитка из облака ВЕЗУ Про
  var slug = (new URLSearchParams(location.search).get('u') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
  if (slug && C) {
    app.classList.add('loading');
    var fallback = function () {   // данные, оставленные страницей-превью …/dogruz/<адрес>/ (если облако недоступно)
      try { var f = JSON.parse(sessionStorage.getItem('vezu-og-' + slug) || 'null'); return f && f.n && f.p ? V.clean(f) : null; } catch (e) { return null; }
    };
    var timer = new Promise(function (ok, no) { setTimeout(function () { no(new Error('timeout')); }, 12000); });
    Promise.race([C.ready().then(function (ok) { if (!ok) throw new Error('offline'); return C.rpc('vz_card', { p_slug: slug }); }), timer])
      .then(function (r) {
        app.classList.remove('loading');
        if (!r || !r.d) return start(null);
        var d = V.clean(r.d);
        if (r.photo) d.i = C.photoUrl(r.photo);
        start(d, { slug: r.slug, pro: !!r.pro, lifetime: !!r.lifetime });
      }, function () {
        app.classList.remove('loading');
        var f = fallback();
        if (f) start(f, { slug: slug, cached: true }); else start(null, { offline: true });
      });
  } else start(V.readCard());

  function start(d, cloud) {
  cloud = cloud || {};
  if (!d || !d.n) {
    var renderErr = function () {
      app.innerHTML = '<div class="err glass"><h1>' + V.esc(cloud.offline ? 'Не удалось открыть визитку' : V.t('nf_t')) + '</h1><p class="muted">' + V.esc(cloud.offline ? 'Не удалось загрузить визитку — проверьте интернет и обновите страницу.' : V.t('nf_s')) + '</p>' +
        '<div class="btns" style="justify-content:center;margin-top:20px">' + (cloud.offline ? '<button type="button" class="btn btn-grad" onclick="location.reload()">Повторить</button>' : '') + '<a class="btn ' + (cloud.offline ? 'btn-glass' : 'btn-grad') + '" href="new.html">' + V.esc(V.t('nf_new')) + '</a><a class="btn btn-glass" href="./">' + V.esc(V.t('nf_home')) + '</a></div></div>';
    };
    renderErr();
    langBtns.forEach(function (b) { b.addEventListener('click', function () { V.setLang(b.dataset.lang, true); markLang(); renderErr(); }); });
    return;
  }

  V.applyTheme(document.documentElement, d.th);
  var url = cloud.slug ? C.shortUrl(cloud.slug) : V.cardUrl(d);
  document.title = d.n + (d.c ? ' · ' + d.c : '') + ' — грузоперевозки | ВЕЗУ';
  var hero = document.getElementById('hero'), det = document.getElementById('details');
  function render() {
    hero.innerHTML = V.cardHero(d, false, { badge: cloud.lifetime ? '★ Про · бессрочно' : cloud.pro ? 'PRO' : '' });
    var html = V.cardDetails(d);
    det.innerHTML = html ? '<h2>' + V.esc(V.t('details')) + '</h2>' + html : '';
    det.hidden = !html;
  }
  render();
  if (d.hs != null) setInterval(function () { hero.innerHTML = V.cardHero(d, false, { badge: cloud.lifetime ? '★ Про · бессрочно' : cloud.pro ? 'PRO' : '' }); }, 60000);

  var hello = 'Здравствуйте, ' + d.n.split(' ')[0] + '! Нашёл(ла) вашу визитку. Нужна перевозка.';
  var wa = document.getElementById('wa'), call = document.getElementById('call'), tg = document.getElementById('tg');
  V.bindWaLink(wa, d.p, hello);
  call.href = 'tel:+' + d.p;
  if (cloud.pro) {
    C.track(cloud.slug, 'view');
    wa.addEventListener('click', function () { C.track(cloud.slug, 'wa'); }, true);
    call.addEventListener('click', function () { C.track(cloud.slug, 'call'); }, true);
    document.getElementById('order').addEventListener('submit', function () { C.track(cloud.slug, 'wa'); }, true);
  }
  if (!d.p) { wa.setAttribute('disabled', ''); call.setAttribute('disabled', ''); }
  if (d.tg) { tg.href = 'https://t.me/' + d.tg; tg.hidden = false; }

  V.bindOrderForm(document.getElementById('order'), function () { return d.p; }, function () { return d.n; });

  document.getElementById('vcf').addEventListener('click', function () {
    V.addContact(d, url);
  });
  // Установка на телефон: для коротких адресов — статический манифест <адрес>.webmanifest (Chrome надёжнее ставит
  // приложение по настоящему файлу, чем по blob:), иначе — сгенерированный. Название приложения всегда VEZU.
  if (cloud.slug) fetch(cloud.slug + '.webmanifest', { method: 'HEAD', cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw 0;
    var link = document.querySelector('link[rel=manifest]'); link.href = cloud.slug + '.webmanifest';
  }).catch(function () { V.cardManifest(d, url); });
  else V.cardUrlAsync(d).then(function (u) { url = u; V.cardManifest(d, url); });
  function showQR() {
    var s = V.sheet(V.t('qr_t'), '<p class="muted">' + V.esc(V.t('qr_s')) + '</p><div class="qr qr-big" id="qrsheet">' + V.qrSvg(url) + '</div>' +
      '<button type="button" class="btn btn-glass btn-block" id="qrcopy"><svg><use href="#i-link"/></svg>' + V.esc(V.t('copy')) + '</button>', 'sheet-qr');
    s.el.querySelector('#qrcopy').addEventListener('click', function () { V.copy(url); });
  }
  document.getElementById('qrbtn').addEventListener('click', showQR);
  document.getElementById('share').addEventListener('click', function () {
    V.share(document.title, 'Грузоперевозки: ' + d.n + (d.c ? ' (' + d.c + ')' : '') + '. Пишите в WhatsApp:', url);
  });
  V.editUrl(d).then(function (u) { document.getElementById('edit').href = u; });
  V.bindInstall(document.getElementById('install'));
  var made = document.getElementById('made');
  made.href = 'new.html';
  if (cloud.pro) made.hidden = true;           // ВЕЗУ Про: без надписи «Сделано на ВЕЗУ»

  langBtns.forEach(function (b) {
    b.addEventListener('click', function () { V.setLang(b.dataset.lang, true); markLang(); render(); });
  });
  }
})();
