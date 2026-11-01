/* ВЕЗУ — генератор визитки. Данные никуда не отправляются: ссылка собирается в браузере. */
(function () {
  'use strict';
  var V = window.VZ, $ = function (id) { return document.getElementById(id); };
  var KEY = 'vezu-draft';
  var state = { th: 0, photo: null, photoBytes: 0, full: '', short: '', name: '' };

  function draftSave() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ n: $('n').value, w: $('w').value, p: $('p').value, c: $('c').value, d: $('d').value, th: state.th, photo: state.photo }));
    } catch (e) {}
  }
  function draftLoad() {
    try {
      var x = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!x) return;
      ['n', 'w', 'p', 'c', 'd'].forEach(function (k) { if (x[k]) $(k).value = x[k]; });
      state.th = +x.th || 0;
      if (state.th === V.PREMIUM_THEME && !V.premium()) state.th = 0;
      if (x.photo && /^data:image\/(webp|jpeg);base64,/.test(x.photo)) setPhoto(x.photo, Math.floor((x.photo.length - x.photo.indexOf(',') - 1) * 3 / 4));
    } catch (e) {}
  }

  function renderThemes() {
    var names = V.t('theme_names'), html = '';
    for (var i = 0; i <= V.PREMIUM_THEME; i++) {
      var locked = i === V.PREMIUM_THEME && !V.premium();
      html += '<button type="button" class="sw th-' + i + '" data-th="' + i + '" aria-pressed="' + (state.th === i) + '"' + (locked ? ' disabled title="' + V.esc(V.t('prem_lock')) + '"' : '') + '><i>' + (i === V.PREMIUM_THEME ? (locked ? '🔒' : '★') : '') + '</i>' + V.esc(names[i]) + '</button>';
    }
    $('themes').innerHTML = html;
    $('promoBox').hidden = V.premium();
  }
  $('themes').addEventListener('click', function (e) {
    var b = e.target.closest('.sw'); if (!b || b.disabled) return;
    state.th = +b.dataset.th; V.applyTheme(state.th); renderThemes(); draftSave();
  });
  $('promoBtn').addEventListener('click', function () {
    V.checkPromo($('promo').value).then(function (ok) {
      if (ok) { state.th = V.PREMIUM_THEME; V.applyTheme(state.th); renderThemes(); draftSave(); V.toast(V.t('promo_ok')); }
      else V.toast(V.t('promo_bad'));
    }, function () { V.toast(V.t('promo_na')); });
  });

  // ---------- фото ----------
  function setPhoto(url, bytes) {
    state.photo = url; state.photoBytes = bytes || 0;
    $('photoPrev').hidden = !url; if (url) $('photoPrev').src = url; else $('photoPrev').removeAttribute('src');
    $('photoDel').hidden = !url;
    $('photoStatus').textContent = url ? V.t('f_photo_ok', (state.photoBytes / 1024).toFixed(1).replace('.', ',')) : '';
  }
  $('photoIn').addEventListener('change', function () {
    var f = this.files && this.files[0]; this.value = '';
    if (!f) return;
    $('photoStatus').textContent = V.t('f_photo_busy');
    V.compressPhoto(f).then(function (r) { setPhoto(r.url, r.bytes); draftSave(); }, function () { $('photoStatus').textContent = V.t('f_photo_err'); });
  });
  $('photoDel').addEventListener('click', function () { setPhoto(null); draftSave(); });

  // ---------- генерация ----------
  function data() { return { n: $('n').value, w: $('w').value, p: $('p').value, c: $('c').value, d: $('d').value, th: state.th, l: V.lang() }; }
  function bad(id, on) { $(id).classList.toggle('bad', on); $(id + 'Err').classList.toggle('show', on); }
  $('f').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = V.clean(data()), okN = !!d.n, okW = !!d.w;
    bad('n', !okN); bad('w', !okW);
    if (!okN || !okW) { $(okN ? 'w' : 'n').focus(); return; }
    draftSave();
    Promise.all([V.encode(d, state.photo), state.photo ? V.encode(d, null) : null]).then(function (r) {
      state.full = V.cardUrl(r[0]); state.short = r[1] ? V.cardUrl(r[1]) : state.full; state.name = d.n;
      showResult(true);
    });
  });
  ['n', 'w', 'p', 'c', 'd'].forEach(function (k) {
    $(k).addEventListener('input', function () { if (k === 'n' || k === 'w') bad(k, false); draftSave(); });
  });
  $('clearBtn').addEventListener('click', function (e) {
    e.preventDefault();
    ['n', 'w', 'p', 'c', 'd'].forEach(function (k) { $(k).value = ''; });
    setPhoto(null); state.th = 0; V.applyTheme(0); renderThemes();
    try { localStorage.removeItem(KEY); } catch (er) {}
    $('result').hidden = true; V.toast(V.t('cleared'));
  });

  function showResult(scroll) {
    var withPhoto = state.full !== state.short;
    $('fullLink').value = state.full; $('fullLen').textContent = V.t('res_len', state.full.length);
    $('fullLabel').textContent = V.t(withPhoto ? 'res_full_photo' : 'res_full');
    $('openCard').href = state.full;
    $('shortBox').hidden = !withPhoto;
    $('shortLink').value = state.short; $('shortLen').textContent = V.t('res_len', state.short.length);
    $('qr').innerHTML = V.qrSvg(state.short);
    $('qrNote').innerHTML = V.t(withPhoto ? 'qr_note_photo' : 'qr_note');
    $('result').hidden = false;
    if (scroll) $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('copyFull').addEventListener('click', function () { V.copy(state.full); });
  $('copyShort').addEventListener('click', function () { V.copy(state.short); });
  $('shareCard').addEventListener('click', function () { V.share(state.full, state.name, state.name + ' — ' + V.t('sub')); });
  $('qrSave').addEventListener('click', function () { V.download('qr-' + V.fileName(state.name) + '.png', V.qrPng(state.short, state.name, V.t('sub'))); });
  $('shareSite').addEventListener('click', function () { V.share(V.baseUrl(), 'ВЕЗУ', V.t('share_text')); });

  V.initLang(function () {
    renderThemes();
    $('supBtn').href = V.supportUrl();
    if (state.photo) setPhoto(state.photo, state.photoBytes);
    if (!$('result').hidden) showResult();
  });
  draftLoad();
  V.applyTheme(state.th); renderThemes();
  V.registerSW('sw.js');
})();
