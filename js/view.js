/* ВЕЗУ — страница визитки. Данные берутся только из # в адресе (он не уходит на сервер). */
(function () {
  'use strict';
  var V = window.VZ, app = document.getElementById('app'), cur = null, shortUrl = '';
  var WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z"/></svg>';
  var CALL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';

  function stock(car) {
    var s = String(car || '').toLowerCase();
    if (/каблук|кабл|ларгус|0[,.]5/.test(s)) return '../img/v-kabluk.webp';
    if (/газон|грузов|борт|3 ?т|isuzu|исузу|рефриж/.test(s)) return '../img/v-truck3.webp';
    if (/удлин|длинн|2 ?т/.test(s)) return '../img/v-gazel-long.webp';
    return '../img/v-gazel.webp';
  }
  function vcf(d) {
    var e = function (s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); };
    var L = ['BEGIN:VCARD', 'VERSION:3.0', 'N:;' + e(d.n) + ';;;', 'FN:' + e(d.n), 'ORG:' + e('Грузоперевозки' + (d.c ? ' — ' + d.c : ''))];
    L.push('TEL;TYPE=CELL:+' + d.w);
    if (d.p) L.push('TEL;TYPE=VOICE:+' + d.p);
    L.push('URL:' + location.href.split('#')[0] + '#' + location.hash.slice(1));
    if (d.d) L.push('NOTE:' + e(d.d));
    L.push('END:VCARD');
    return L.join('\r\n') + '\r\n';
  }

  function error(kind) {
    cur = null; V.applyTheme(0);
    document.title = V.t('err_t') + ' — ВЕЗУ';
    app.innerHTML = '<div class="glass errbox" id="err"><div class="ic" aria-hidden="true">🧭</div><h1>' + V.esc(V.t('err_t')) + '</h1><p>' +
      V.esc(V.t(kind === 'empty' ? 'err_empty' : 'err_bad')) + '</p><a class="btn btn-grad" href="../">' + V.esc(V.t('err_make')) + '</a></div>';
  }

  function render() {
    if (!cur) return;
    var d = cur.d, call = d.p || d.w;
    V.applyTheme(d.th || 0);
    document.title = d.n + (d.c ? ' — ' + d.c : '') + ' · ВЕЗУ';
    app.innerHTML =
      '<article class="glass glow vcard">' +
      (cur.photo ? '<img class="ph" src="" alt="' + V.esc(d.c || d.n) + '">' : '<img class="ph stock" src="' + stock(d.c) + '" alt="">') +
      '<div class="body"><div class="kicker">' + V.esc(V.t('card_driver')) + '</div><h1 class="grad-text">' + V.esc(d.n) + '</h1>' +
      (d.c ? '<div class="car">' + V.esc(d.c) + '</div>' : '') +
      (d.d ? '<div class="desc">' + V.esc(d.d) + '</div>' : '') +
      '<div class="actions">' +
      '<a class="btn btn-wa btn-lg" id="waBtn" href="' + V.esc(V.waUrl(d.w, V.t('card_hello'))) + '" target="_blank" rel="noopener">' + WA_ICON + '<span>' + V.esc(V.t('card_wa')) + '</span></a>' +
      '<a class="btn btn-glass btn-lg" id="callBtn" href="tel:+' + call + '">' + CALL_ICON + '<span>' + V.esc(V.t('card_call')) + '</span></a>' +
      '<div class="sub-btns"><button type="button" class="btn btn-glass" id="vcfBtn">' + V.esc(V.t('card_contact')) + '</button><button type="button" class="btn btn-share" id="shBtn">' + V.esc(V.t('share')) + '</button></div>' +
      '</div><div class="phone">' + V.esc(V.fmtPhone(call)) + '</div></div></article>' +
      '<section class="glass qr-panel qrwrap"><b>' + V.esc(V.t('card_qr')) + '</b><div class="qr" id="qr"></div><p>' + V.esc(V.t('qr_note').replace(/<[^>]+>/g, '')) + '</p></section>' +
      '<a class="glass made" href="../">' + V.t('card_make') + '</a>';
    if (cur.photo) app.querySelector('.ph').src = cur.photo;
    document.getElementById('vcfBtn').onclick = function () {
      V.download(V.fileName(d.n) + '.vcf', 'data:text/vcard;charset=utf-8,' + encodeURIComponent(vcf(d)));
    };
    document.getElementById('shBtn').onclick = function () { V.share(location.href, d.n, d.n + (d.c ? ' — ' + d.c : '') + ' · ' + V.t('sub')); };
    if (shortUrl) document.getElementById('qr').innerHTML = V.qrSvg(shortUrl);
  }

  function load() {
    var h = location.hash.replace(/^#/, '');
    shortUrl = '';
    if (!h) return error('empty');
    var r = V.decode(h);
    if (!r) return error('bad');
    cur = r;
    // QR — всегда короткая ссылка без фото, чтобы код читался камерой
    if (r.photo) V.encode(r.d, null).then(function (c) { shortUrl = V.cardUrl(c); render(); });
    else shortUrl = location.href.split('#')[0] + '#' + h;
    render();
  }

  var linkLang = null;
  try { if (!localStorage.getItem('vezu-lang')) { var r0 = V.decode(location.hash); if (r0 && r0.d.l) linkLang = r0.d.l; } } catch (e) {}
  V.initLang(function () { if (cur) render(); else if (document.getElementById('err')) load(); });
  if (linkLang) V.setLang(linkLang);
  window.addEventListener('hashchange', load);
  load();
  V.registerSW('../sw.js');
})();
