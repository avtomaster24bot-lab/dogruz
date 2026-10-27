/* Каталог водителей ВЕЗУ Про (catalog.html) */
(function () {
  'use strict';
  var V = window.VEZU, C = window.VZC;
  var list = document.getElementById('list'), f = document.getElementById('filters'), city = document.getElementById('city');
  var st = { veh: '', svc: null, free: false }, seq = 0, timer = 0;

  document.getElementById('vehf').innerHTML = '<button type="button" class="qchip on" data-veh="">Все</button>' +
    V.VEHICLES.map(function (v) { return '<button type="button" class="qchip" data-veh="' + v.k + '">' + V.esc(v.l) + '</button>'; }).join('');
  document.getElementById('svcf').innerHTML = V.SERVICES.map(function (s, i) { return '<button type="button" class="qchip" data-svc="' + i + '">' + V.esc(s) + '</button>'; }).join('');

  function item(r) {
    var d = V.clean(r.d), url = C.shortUrl(r.slug), img = r.photo ? C.photoUrl(r.photo) : '';
    var open = d.hs != null ? V.isOpen(d) : null, si = V.statusInfo(r.status), F = window.VEZU_FAV;
    var rate = r.rating && r.rating.n ? '<span class="cat-r">★ ' + String(r.rating.avg).replace('.', ',') + ' · ' + r.rating.n + ' ' + V.plural(r.rating.n, 'отзыв', 'отзыва', 'отзывов') + '</span>' : '';
    return '<article class="cat glass">' + (F ? F.btnHtml(r.slug, 'fav-cat') : '') +
      '<a class="cat-top" href="' + V.esc(url) + '">' +
      '<span class="cat-img"><img src="' + V.vehicleImg(d) + '" alt="" loading="lazy" decoding="async" width="520" height="319">' +
      '<i class="cat-av">' + (img ? '<img src="' + V.esc(img) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '<b>' + V.esc(V.initials(d.n)) + '</b></i></span>' +
      '<span class="cat-txt"><b class="cat-n">' + V.esc(d.n) + (r.paid ? ' <em class="cat-pro">PRO</em>' : '') + '</b>' +
      '<span class="cat-m">' + V.esc(V.metaLine(d)) + '</span>' + rate +
      (si ? '<span class="cat-st st-' + si.s + '"><i></i>' + V.esc(si.short) + '</span>' : '') +
      (open != null ? '<span class="cat-o ' + (open ? 'on' : '') + '">' + (open ? 'Сейчас работает' : 'Сейчас не работает') + ' · ' + V.esc(V.hoursText(d)) + '</span>' : '') +
      (d.pr ? '<span class="cat-p">' + V.esc(V.priceText(d)) + '</span>' : '') +
      '<span class="cat-s">' + V.esc(V.services(d).slice(0, 4).join(' · ')) + '</span></span></a>' +
      '<div class="cat-b"><a class="btn btn-wa btn-sm" data-wa="' + V.esc(r.slug) + '" href="#"><svg><use href="#i-wa"/></svg>WhatsApp</a>' +
      '<a class="btn btn-glass btn-sm" data-call="' + V.esc(r.slug) + '" href="tel:+' + d.p + '"><svg><use href="#i-phone"/></svg>Позвонить</a></div></article>';
  }
  var rows = {};
  function load() {
    var my = ++seq;
    list.innerHTML = '<p class="muted cat-msg">Загружаем…</p>';
    C.rpc('vz_catalog', { p_city: city.value.trim(), p_veh: st.veh, p_service: st.svc, p_limit: 60, p_offset: 0, p_free: st.free }).then(function (r) {
      if (my !== seq) return;
      rows = {}; (r || []).forEach(function (x) { rows[x.slug] = x; });
      list.innerHTML = r && r.length ? r.map(item).join('') :
        '<div class="cat-empty glass"><h2>Пока никого не нашли</h2><p class="muted">Попробуйте убрать фильтры. Вы водитель? Добавьте себя в каталог — 7 дней Про бесплатно.</p><a class="btn btn-grad" href="new.html">Создать визитку</a></div>';
      document.getElementById('cnt').textContent = r && r.length ? r.length + ' ' + plural(r.length) : '';
    }, function (e) { if (my === seq) list.innerHTML = '<p class="err-msg cat-msg">' + V.esc(e.message) + '</p>'; });
  }
  function plural(n) { var a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'водитель' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'водителя' : 'водителей'; }

  f.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.veh !== undefined) { st.veh = b.dataset.veh; f.querySelectorAll('[data-veh]').forEach(function (x) { x.classList.toggle('on', x === b); }); }
    else if (b.dataset.free !== undefined) { st.free = !st.free; b.classList.toggle('on', st.free); b.setAttribute('aria-pressed', String(st.free)); }
    else if (b.dataset.svc !== undefined) { var v = +b.dataset.svc; st.svc = st.svc === v ? null : v; f.querySelectorAll('[data-svc]').forEach(function (x) { x.classList.toggle('on', +x.dataset.svc === st.svc); }); }
    load();
  });
  if (window.VEZU_FAV) window.VEZU_FAV.bind(list, function (slug) { var r = rows[slug]; return r && window.VEZU_FAV.info(slug, V.clean(r.d), r.photo ? C.photoUrl(r.photo) : ''); });
  city.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(load, 350); });
  list.addEventListener('click', function (e) {
    var a = e.target.closest('[data-wa],[data-call]'); if (!a) return;
    var r = rows[a.dataset.wa || a.dataset.call]; if (!r) return;
    if (a.dataset.wa) {
      e.preventDefault(); C.track(r.slug, 'wa');
      V.openWA(r.d.p, 'Здравствуйте, ' + String(r.d.n).split(' ')[0] + '! Нашёл(ла) вас в каталоге ВЕЗУ. Нужна перевозка.');
    } else C.track(r.slug, 'call');
  });

  C.ready().then(function (ok) {
    if (!ok) {
      document.getElementById('filters').hidden = true;
      list.innerHTML = '<div class="cat-empty glass"><h2>Каталог водителей — скоро</h2><p class="muted">Здесь появятся водители с ВЕЗУ Про. Пока можно отправить заказ всем водителям ВЕЗУ с главной страницы.</p>' +
        '<div class="btns"><a class="btn btn-grad" href="./">Заказать перевозку</a><a class="btn btn-glass" href="new.html">Я водитель</a></div></div>';
      return;
    }
    C.rpc('vz_catalog_cities', {}).then(function (cs) {
      document.getElementById('citylist').innerHTML = (cs || []).map(function (c) { return '<option>' + V.esc(c) + '</option>'; }).join('');
    }, function () {});
    var q = new URLSearchParams(location.search); if (q.get('city')) city.value = q.get('city');
    load();
  });
})();
