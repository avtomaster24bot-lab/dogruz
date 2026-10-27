(function () {
  'use strict';
  var V = window.VEZU, f = document.getElementById('f'), KEY = 'vezu-card', PKEY = 'vezu-photo';
  var build = document.getElementById('build');
  var state = { w: '1,5 т', s: '012', pu: 0, f: 0, th: 0 };

  // начальные данные: ?c=… / ?d=… (из «Редактировать визитку») → localStorage → по умолчанию
  var q = new URLSearchParams(location.search), init = null, fromLink = false;
  if (q.get('c') || q.get('d')) { init = V.readCard(); fromLink = !!init; }
  if (!init) try { init = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (init) { init = V.clean(init); delete init.x; state = Object.assign(state, init); if (!init.s) state.s = ''; if (!init.w) state.w = ''; }

  var TEXT = ['n', 't', 'c', 'i', 'm', 'z', 'tg'];
  TEXT.forEach(function (k) { if (state[k]) f.elements[k].value = state[k]; });
  if (state.tg) f.elements.tg.value = '@' + state.tg;
  if (state.p) f.elements.p.value = V.fmtPhone(state.p);
  if (state.pr) f.elements.pr.value = V.fmtNum(state.pr);
  // тарифы калькулятора: rt = «мин,км город,км межгород,грузчик,этаж,км в минимуме»
  var CALC = window.VEZU_CALC, rtv = String(state.rt || '').split(',');
  if (CALC) CALC.KEYS.forEach(function (k, i) { var el = f.elements['rt' + i]; if (!el) return; el.placeholder = String(CALC.RATES[k]); el.value = rtv[i] || ''; });
  if (state.rt) document.getElementById('rates').open = true;
  document.getElementById('rtreset').addEventListener('click', function () { for (var i = 0; i < 6; i++) f.elements['rt' + i].value = ''; update(); });
  var tgphoto = document.getElementById('tgphoto');
  tgphoto.checked = !!(state.f & V.TG_PHOTO);
  // раскрыть «Ещё», если там уже что-то заполнено
  if (state.tg || state.i || state.m) f.querySelector('[data-step="1"] details').open = true;
  if (state.hs != null || state.z || (state.f & 63)) f.querySelector('[data-step="2"] details').open = true;

  function chips(el, items, attr) {
    el.innerHTML = items.map(function (x) { return '<button type="button" class="qchip" ' + attr + '="' + V.esc(x.v) + '" aria-pressed="false">' + V.esc(x.l) + '</button>'; }).join('');
  }
  var cap = document.getElementById('cap'), svc = document.getElementById('svc'), ex = document.getElementById('ex'), pay = document.getElementById('pay'),
    pu = document.getElementById('pu'), themes = document.getElementById('themes'), veh = document.getElementById('veh');
  chips(cap, V.CAPACITY.map(function (c) { return { v: c, l: 'до ' + c }; }), 'data-v');
  chips(svc, V.SERVICES.map(function (s, i) { return { v: i, l: s }; }), 'data-i');
  chips(ex, V.EXTRAS.map(function (k, i) { return { v: 1 << i, l: V.t(k) }; }), 'data-bit');
  chips(pay, V.PAYMENTS.map(function (k, i) { return { v: 1 << (i + 3), l: V.t(k) }; }), 'data-bit');
  themes.innerHTML = V.THEMES.map(function (n, i) { return '<button type="button" class="sw th-' + i + '" data-th="' + i + '" aria-pressed="false"><i></i><span>' + V.esc(n) + '</span></button>'; }).join('');

  var hs = f.elements.hs, he = f.elements.he, h24 = document.getElementById('h24');
  var opt = function (h) { return '<option value="' + h + '">' + ('0' + h).slice(-2) + ':00</option>'; };
  var o1 = '<option value="">с …</option>', o2 = '<option value="">до …</option>';
  for (var h = 0; h < 24; h++) o1 += opt(h);
  for (h = 1; h <= 24; h++) o2 += opt(h);
  hs.innerHTML = o1; he.innerHTML = o2;
  if (state.hs != null) { hs.value = state.hs; he.value = state.he; }

  veh.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    f.elements.c.value = b.dataset.c; state.w = b.dataset.w; update();
  });
  cap.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.w = state.w === b.dataset.v ? '' : b.dataset.v; update(); });
  svc.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var i = b.dataset.i, s = state.s || '';
    state.s = s.indexOf(i) >= 0 ? s.replace(i, '') : (s + i).split('').sort().join('');
    update();
  });
  [ex, pay].forEach(function (el) { el.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.f = (state.f || 0) ^ +b.dataset.bit; update(); }); });
  pu.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.pu = +b.dataset.v; update(); });
  themes.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.th = +b.dataset.th; update(); });
  tgphoto.addEventListener('change', function () { state.f = (state.f || 0) & ~V.TG_PHOTO | (tgphoto.checked ? V.TG_PHOTO : 0); update(); });
  h24.addEventListener('click', function () {
    if (hs.value === '0' && he.value === '24') { hs.value = ''; he.value = ''; } else { hs.value = '0'; he.value = '24'; }
    update();
  });

  var phone = f.elements.p;
  phone.addEventListener('input', function () {
    var d = phone.value.replace(/\D/g, '');
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d && d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    var o = d ? '+7' : '';
    if (d.length > 1) o += ' ' + d.slice(1, 4);
    if (d.length > 4) o += ' ' + d.slice(4, 7);
    if (d.length > 7) o += ' ' + d.slice(7, 9);
    if (d.length > 9) o += ' ' + d.slice(9, 11);
    phone.value = o;
  });
  f.elements.pr.addEventListener('input', function () { f.elements.pr.value = V.fmtNum(f.elements.pr.value.replace(/\D/g, '').slice(0, 9)); });
  f.addEventListener('input', update);
  f.addEventListener('change', update);
  f.addEventListener('submit', function (e) { e.preventDefault(); });

  // ---- фото с телефона: хранится только на этом устройстве ----
  var phav = document.getElementById('phav'), phdel = document.getElementById('phdel');
  function photo() { try { return JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch (e) { return null; } }
  document.getElementById('photo').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0]; if (!file) return;
    V.resizePhoto(file, 256).then(function (img) {
      try { localStorage.setItem(PKEY, JSON.stringify({ p: V.normPhone(phone.value), img: img })); localStorage.removeItem('vezu-photo-del'); } catch (er) { V.toast('Не удалось сохранить фото'); return; }
      V.toast('Фото сохранено на этом телефоне'); update();
    }, function () { V.toast('Не получилось открыть фото — попробуйте другое'); });
    e.target.value = '';
  });
  phdel.addEventListener('click', function () { var x = photo(); localStorage.removeItem(PKEY); if (x && x.up) localStorage.setItem('vezu-photo-del', '1'); update(); });

  // ---- шаги ----
  var step = 1;
  function valid1() { return !!(f.elements.n.value.trim() && V.normPhone(phone.value)); }
  function go(n) {
    if (n > 1 && !valid1()) {
      n = 1; document.getElementById('err1').hidden = false;
      (f.elements.n.value.trim() ? phone : f.elements.n).classList.add('bad');
      (f.elements.n.value.trim() ? phone : f.elements.n).focus();
    }
    step = n; build.dataset.step = n;
    document.querySelectorAll('.progress [data-go]').forEach(function (b) {
      var k = +b.dataset.go; b.classList.toggle('done', k < n); b.classList.toggle('cur', k === n); b.setAttribute('aria-selected', k === n);
    });
    document.querySelectorAll('.step[data-step]').forEach(function (s) { s.hidden = +s.dataset.step !== n; });
    var top = document.querySelector('.progress').getBoundingClientRect().top + scrollY - 80;
    if (scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-next],[data-go]'); if (!b) return;
    go(+(b.dataset.next || b.dataset.go));
  });

  var link = '', d = {}, seq = 0, short = '', pvwrap = document.getElementById('pvwrap');
  function on(el, test) { el.querySelectorAll('button').forEach(function (b) { var v = test(b); b.classList.toggle('on', v); b.setAttribute('aria-pressed', v); }); }
  function update() {
    TEXT.forEach(function (k) { state[k] = f.elements[k].value.trim(); });
    state.p = V.normPhone(phone.value);
    state.pr = f.elements.pr.value;
    var rt = []; for (var ri = 0; ri < 6; ri++) { var re = f.elements['rt' + ri]; if (re) { re.value = re.value.replace(/\D/g, '').slice(0, 6); rt.push(re.value); } }
    state.rt = rt.join('').length ? rt.join(',') : '';
    state.hs = hs.value; state.he = he.value;
    d = V.clean(state);
    if (valid1()) { document.getElementById('err1').hidden = true; f.elements.n.classList.remove('bad'); phone.classList.remove('bad'); }
    document.getElementById('cnt').textContent = (state.m || '').length + '/80';
    on(cap, function (b) { return b.dataset.v === state.w; });
    on(svc, function (b) { return (state.s || '').indexOf(b.dataset.i) >= 0; });
    on(ex, function (b) { return !!((state.f || 0) & +b.dataset.bit); });
    on(pay, function (b) { return !!((state.f || 0) & +b.dataset.bit); });
    on(pu, function (b) { return +b.dataset.v === (state.pu || 0); });
    on(themes, function (b) { return +b.dataset.th === (state.th || 0); });
    on(veh, function (b) { return V.vehicle(d) === b.dataset.k; });
    h24.classList.toggle('on', d.hs === 0 && d.he === 24);
    f.elements.i.classList.toggle('bad', !!state.i && !/^https:\/\//i.test(state.i));
    f.elements.tg.classList.toggle('bad', !!state.tg && !d.tg);
    tgphoto.disabled = !d.tg;
    var ph = photo(), src = ph && ph.img;
    if (ph && d.p && ph.p !== d.p) { ph.p = d.p; try { localStorage.setItem(PKEY, JSON.stringify(ph)); } catch (e) {} }
    phav.innerHTML = src ? '<img src="' + src + '" alt="">' : '<span>' + V.esc(V.initials(d.n || '?')) + '</span>';
    phdel.hidden = !src;
    V.applyTheme(pvwrap, d.th);
    document.getElementById('pv').innerHTML = V.cardHero(d, true, { local: true });
    var det = V.cardDetails(d), pvd = document.getElementById('pvd');
    pvd.innerHTML = det; pvd.hidden = !det;
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}

    var ok = !!(d.n && d.p);
    document.getElementById('rbody').classList.toggle('locked', !ok);
    if (window.VEZU_PRO) window.VEZU_PRO.changed(d);
    if (!ok) { setLink(''); return; }
    var my = ++seq;
    if (short) { setLink(short); return; }
    setLink(V.cardUrl(d));
    V.cardUrlAsync(d).then(function (u) { if (my === seq && !short) setLink(u); });
  }
  // для ВЕЗУ Про (js/pro.js): данные визитки, короткий адрес вместо длинной ссылки, обновление фото
  window.VEZU_B = {
    data: function () { return d; }, photo: photo, refresh: update,
    setShort: function (u) { if (short !== (u || '')) { short = u || ''; update(); } },
    setForm: function (x) { if (f.elements.n.value.trim()) return false; init = V.clean(x); location.replace('new.html?c=' + V.encodeSync(init)); return true; }
  };
  function setLink(u) {
    link = u;
    document.getElementById('link').value = u || 'Здесь появится ваша ссылка';
    document.getElementById('open').href = u || '#';
    document.getElementById('qr').innerHTML = V.qrSvg(u || 'https://example.com');
    document.getElementById('result').dataset.len = u.length;
  }
  update();
  go(fromLink && valid1() ? 3 : 1);

  document.getElementById('copy').addEventListener('click', function () { if (link) V.copy(link); });
  document.getElementById('share').addEventListener('click', function () {
    if (link) V.share('Моя визитка — ' + d.n, 'Грузоперевозки: ' + d.n + '. Заказ в WhatsApp:', link);
  });
  document.getElementById('png').addEventListener('click', function () {
    if (!link) return;
    V.download('qr-' + V.fileName(d.n) + '.png', V.qrPng(link, d.n + (d.c ? ' · ' + d.c : ''), 'Грузоперевозки · ' + V.fmtPhone(d.p)));
  });
  V.bindInstall(document.getElementById('install'));

  var area = document.getElementById('print-area');
  function cardBlock() {
    var sv = V.services(d).slice(0, 5).join(' · ');
    var extra = [V.priceText(d), V.hoursText(d)].filter(Boolean).join(' · ');
    var ph = V.photoSrc(d, true);
    return '<div class="pc"><div>' + (ph ? '<img class="pc-ph" src="' + V.esc(ph) + '" alt="">' : '') + '<div class="b">Грузоперевозки</div><div class="n">' + V.esc(d.n) + '</div>' +
      '<div class="m">' + V.esc(V.metaLine(d)) + '</div>' + (sv ? '<div class="s">' + V.esc(sv) + '</div>' : '') +
      (extra ? '<div class="s">' + V.esc(extra) + '</div>' : '') +
      '<div class="p">' + V.esc(V.fmtPhone(d.p)) + '</div><div class="w">WhatsApp · звонки' + (d.tg ? ' · t.me/' + V.esc(d.tg) : '') + '</div></div>' +
      '<div class="q">' + V.qrSvg(link, '#0b0b1f', '#ffffff') + '<i>визитка и заказ</i></div></div>';
  }
  document.getElementById('pcards').addEventListener('click', function () {
    if (!link) return;
    var one = cardBlock(), html = ''; for (var i = 0; i < 10; i++) html += one;
    area.innerHTML = '<div class="pc-sheet">' + html + '</div>'; window.print();
  });
  document.getElementById('psticker').addEventListener('click', function () {
    if (!link) return;
    area.innerHTML = '<div class="st"><div><div class="t1">ГРУЗОПЕРЕВОЗКИ</div><div class="t2">' + V.esc(V.metaLine(d) || 'до 3 тонн') + '</div></div>' +
      '<div class="q">' + V.qrSvg(link, '#0b0b1f', '#ffffff') + '</div><div class="t3">Наведите камеру — закажите в WhatsApp</div>' +
      '<div><div class="p">' + V.esc(V.fmtPhone(d.p)) + '</div><div class="n">' + V.esc(d.n) + '</div></div></div>';
    window.print();
  });

  // ---- онбординг: 3 слайда при первом открытии ----
  var SLIDES = [
    ['img/hero-van-720.webp', 'Визитка — это ссылка', 'Отправьте её клиентам в WhatsApp или покажите QR-код. Бумажная визитка теряется — ссылка остаётся в телефоне.'],
    ['img/s-move.webp', 'Заказы сразу в WhatsApp', 'Клиент нажимает кнопку — вам приходит готовое сообщение: что везти, откуда, куда и точка на карте.'],
    ['img/v-gazel.webp', 'Печать и наклейка на машину', 'Распечатайте визитки и наклейку с QR. Бесплатно и без регистрации — займёт минуту.']
  ];
  function onboarding() {
    var i = 0;
    var s = V.sheet('', '<div class="onb"><div class="onb-img"><img alt="" width="520" height="300"></div><h2></h2><p></p><div class="dots">' +
      SLIDES.map(function () { return '<i></i>'; }).join('') + '</div><div class="navrow"><button type="button" class="btn btn-glass" data-o="skip">Пропустить</button><button type="button" class="btn btn-grad" data-o="next">Далее</button></div></div>', 'sheet-onb');
    var el = s.el;
    function show() {
      el.querySelector('.onb-img img').src = SLIDES[i][0];
      el.querySelector('h2').textContent = SLIDES[i][1];
      el.querySelector('p').textContent = SLIDES[i][2];
      el.querySelectorAll('.dots i').forEach(function (x, k) { x.classList.toggle('on', k === i); });
      el.querySelector('[data-o=next]').textContent = i === SLIDES.length - 1 ? 'Начать' : 'Далее';
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-o]'); if (!b) return;
      if (b.dataset.o === 'next' && i < SLIDES.length - 1) { i++; show(); } else s.close();
    });
    show();
    try { localStorage.setItem('vezu-onb', '1'); } catch (e) {}
  }
  var seen = false; try { seen = !!localStorage.getItem('vezu-onb'); } catch (e) {}
  if (!seen && !fromLink) setTimeout(onboarding, 300);
})();
