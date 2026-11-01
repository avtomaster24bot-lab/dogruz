/* ВЕЗУ — старые адреса (card.html?c=/?d=, /slug, d/?slug, new.html, app.html…). Без сервера:
   ссылки со старыми данными в адресе (?c=, ?d=) переводятся в новый формат прямо в браузере;
   облачные короткие адреса больше не открываются (кроме визитки владельца, пересобранной в ссылку). */
(function () {
  'use strict';
  var V = window.VZ;
  var BASE = location.origin + '/dogruz/';
  // Визитка владельца «Александр / vezu», пересобрана из её публичных данных
  var OWNER = 'EWJpRcpBCoJAGIbhqwzfehZJxo9ep9ZtXUQw1QUELyLiYBiNV3j_G4Wrlg88N13Vip4PmdUfjHyZPSmqUyszq-rqcLLGFHXe60wJx-BPRV12D578xUJhI3siM1FYWHmHf77_AA';
  var CAPACITY = ['0,5 т', '1 т', '1,5 т', '2 т', '3 т'];
  var SERVICES = ['Переезды', 'Стройматериалы', 'Мебель', 'Вывоз мусора', 'Грузчики', 'Бытовая техника', 'Межгород', 'Мелкий груз'];

  function bytes(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var bin = atob(s), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  var CY = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя', EX = 'ЁёӘәҒғҚқҢңӨөҰұҮүҺһІі₸«»—–№…';
  function untxt(b) {
    var s = '';
    for (var i = 0; i < b.length; i++) {
      var c = b[i];
      if (c < 128) s += String.fromCharCode(c);
      else if (c < 0xC0) s += CY[c - 0x80];
      else if (c === 0xFF) { s += String.fromCharCode((b[i + 1] << 8) | b[i + 2]); i += 2; }
      else s += EX[c - 0xC0] || '';
    }
    return s;
  }
  function R(b, p) { this.b = b; this.p = p || 0; }
  R.prototype.byte = function () { if (this.p >= this.b.length) throw new Error('eof'); return this.b[this.p++]; };
  R.prototype.u = function () { var n = 0, m = 1, x; do { x = this.byte(); n += (x & 127) * m; m *= 128; } while (x & 128); return n; };
  R.prototype.s = function () { var l = this.u(); if (this.p + l > this.b.length) throw new Error('eof'); var v = untxt(this.b.slice(this.p, this.p + l)); this.p += l; return v; };
  function unpack(b) {
    var r = new R(b), mask = r.u(), d = {};
    if (mask & 1) { var n = 0; for (var i = 0; i < 5; i++) n = n * 256 + r.byte(); d.p = '7' + ('0000000000' + n).slice(-10); }
    if (mask & 2) d.n = r.s();
    if (mask & 4) d.c = r.s();
    if (mask & 8) d.w = CAPACITY[r.byte()];
    if (mask & 16) d.t = r.s();
    if (mask & 32) { var sm = r.byte(), s = ''; for (var k = 0; k < 8; k++) if (sm & (1 << k)) s += k; d.s = s; }
    if (mask & 64) d.m = r.s();
    if (mask & 128) d.i = 'https://' + r.s();
    if (mask & 256) { d.pr = String(r.u()); d.pu = r.byte(); }
    if (mask & 512) { d.hs = r.byte(); d.he = r.byte(); }
    if (mask & 1024) d.tg = r.s();
    if (mask & 2048) d.z = r.s();
    if (mask & 4096) d.f = r.byte();
    if (mask & 8192) d.th = r.byte();
    return d;
  }
  function decodeOld(q) {
    try {
      if (q.get('c')) {
        var b = bytes(q.get('c'));
        if (b[0] === 2) return unpack(b.slice(1));
        if (b[0] === 3) { var r = new R(b, 1), len = r.u(), out = new Uint8Array(len); window.tinyInflate(b.slice(r.p), out); return unpack(out); }
      }
      if (q.get('d')) return JSON.parse(new TextDecoder().decode(bytes(q.get('d'))));
    } catch (e) {}
    return null;
  }
  function convert(o) {
    var lines = [], svc = String(o.s || '').split('').map(function (k) { return SERVICES[+k]; }).filter(Boolean);
    if (o.t) lines.push(o.t);
    if (svc.length) lines.push(svc.join(', '));
    if (o.m) lines.push(o.m);
    if (o.z) lines.push(o.z);
    if (o.hs != null && o.he != null) lines.push(o.hs === 0 && o.he === 24 ? 'Круглосуточно' : o.hs + ':00–' + o.he + ':00');
    if (o.pr) lines.push('от ' + String(o.pr).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₸' + (+o.pu === 1 ? ' / час' : ' / поездка'));
    return { n: o.n, w: o.p, c: [o.c, o.w && CAPACITY.indexOf(o.w) >= 0 ? 'до ' + o.w : ''].filter(Boolean).join(', '), d: lines.join('\n'), th: o.th };
  }
  function go(code) { location.replace(BASE + 'vizitka/#' + code); }
  function msg(titleKey, textKey) {
    var el = document.getElementById('msg');
    el.innerHTML = '<div class="ic" aria-hidden="true">🧭</div><h1>' + V.esc(V.t(titleKey)) + '</h1><p>' + V.esc(V.t(textKey)) + '</p><a class="btn btn-grad" href="' + BASE + '">' + V.esc(V.t('err_make')) + '</a>';
  }

  var mode = document.body.dataset.legacy || '';
  var q = new URLSearchParams(location.search), old = decodeOld(q);
  if (old) {
    var d = V.clean(convert(old));
    if (d.n && d.w) return void V.encode(d, null).then(go);
  }
  if (mode === 'home') return void location.replace(BASE);
  var slug = '';
  if (mode === 'd') slug = location.search.replace(/^\?/, '').split('&')[0];
  else if (q.get('u')) slug = q.get('u');
  else if (mode === '404') { var m = /^\/dogruz\/([A-Za-z0-9-]{3,20})\/?$/.exec(location.pathname); if (m) slug = m[1]; }
  else if (mode.indexOf('slug:') === 0) slug = mode.slice(5);
  slug = slug.toLowerCase();
  if (slug === 'vezu') return void go(OWNER);
  if (q.has('demo')) return void location.replace(BASE);
  V.initLang(function () {
    if (slug || mode === 'card') msg('old_t', 'old_d'); else msg('err_t', 'err_bad');
  });
})();
