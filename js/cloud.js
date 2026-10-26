/* ВЕЗУ Про: маленький клиент Supabase без внешних библиотек (RPC + фото через edge-функцию).
   Вход без регистрации: «ключ доступа» — случайные 256 бит, хранится на телефоне водителя,
   в базе только его SHA-256. Если в базе нет функций vz_* — ready() вернёт false. */
(function () {
  'use strict';
  var CFG = window.VEZU_CFG || {}, BASE = (CFG.SUPABASE_URL || '').replace(/\/$/, ''), KEY = CFG.SUPABASE_KEY || '';
  var enabled = /^https:\/\//.test(BASE) && !!KEY && !CFG.FORCE_OFF, readyP = null;

  function ls(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null');
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { return null; }
  }
  function headers() { return { apikey: KEY, 'Content-Type': 'application/json' }; }
  function timeout(ms) { if (!window.AbortController) return {}; var c = new AbortController(); setTimeout(function () { c.abort(); }, ms); return { signal: c.signal }; }
  function rnd(n) {
    var a = new Uint8Array(n); crypto.getRandomValues(a);
    return btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function ready() {
    if (!enabled) return Promise.resolve(false);
    if (readyP) return readyP;
    try { var c = JSON.parse(sessionStorage.getItem('vezu-cloud') || 'null'); if (c && c.ok && Date.now() - c.t < 300000) return (readyP = Promise.resolve(true)); } catch (e) {}
    readyP = fetch(BASE + '/rest/v1/rpc/vz_ping', Object.assign({ method: 'POST', headers: headers(), body: '{}' }, timeout(6000)))
      .then(function (r) { return r.ok; }, function () { return false; })
      .then(function (ok) { try { sessionStorage.setItem('vezu-cloud', JSON.stringify({ ok: ok, t: Date.now() })); } catch (e) {} return ok; });
    return readyP;
  }

  function human(m) {
    m = String(m || '');
    if (/Failed to fetch|NetworkError|aborted|Load failed/i.test(m)) return 'Нет связи с сервером, попробуйте ещё раз';
    if (/permission denied|42501/i.test(m)) return 'Недостаточно прав';
    return m || 'Ошибка сервера';
  }
  function rpc(fn, args, opts) {
    opts = opts || {};
    return fetch(BASE + '/rest/v1/rpc/' + fn, Object.assign({ method: 'POST', keepalive: !!opts.keepalive, headers: headers(), body: JSON.stringify(args || {}) },
      opts.keepalive ? {} : timeout(15000)))
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
          if (!r.ok) throw new Error(human(j && (j.message || j.msg)));
          return j;
        });
      }, function (e) { throw new Error(human(e && e.message)); });
  }

  // ---- ключ доступа водителя ----
  var KK = 'vezu-key';
  function key() { return ls(KK); }
  function newKey() { var k = rnd(32); ls(KK, k); return k; }
  function setKey(k) { k = String(k || '').trim(); if (!/^[A-Za-z0-9_-]{32,64}$/.test(k)) return false; ls(KK, k); return true; }
  function forget() { ls(KK, null); ls('vezu-cloud-slug', null); }

  // ---- фото (через edge-функцию vz-photo) ----
  function photoCall(body) {
    return fetch(BASE + '/functions/v1/vz-photo', { method: 'POST', headers: headers(), body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) {
            var map = { not_pro: 'Фото в облаке — функция Про', too_big: 'Фото слишком большое', bad_image: 'Не удалось прочитать фото', no_card: 'Сначала сохраните визитку в облаке' };
            throw new Error(map[j.error] || 'Не удалось загрузить фото (' + (j.error || r.status) + ')');
          }
          return j.photo || null;
        });
      }, function (e) { throw new Error(human(e && e.message)); });
  }
  // JPEG-копия для превью ссылок (WhatsApp/Telegram не везде показывают WebP)
  function toJpeg(dataUrl) {
    return new Promise(function (ok) {
      var im = new Image();
      im.onload = function () {
        try {
          var cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
          var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0);
          ok(cv.toDataURL('image/jpeg', 0.85));
        } catch (e) { ok(null); }
      };
      im.onerror = function () { ok(null); };
      im.src = dataUrl;
    });
  }
  function uploadPhoto(dataUrl) {
    return toJpeg(dataUrl).then(function (og) { return photoCall({ key: key(), image: dataUrl, og: og && /^data:image\/jpeg/.test(og) ? og : undefined }); });
  }
  function removePhoto() { return photoCall({ key: key(), remove: true }); }
  function adminPhoto(admin, body) { return photoCall(Object.assign({ admin: admin }, body)).catch(function () { return null; }); }
  function photoUrl(path) { return path ? BASE + '/storage/v1/object/public/vz_photos/' + path : ''; }

  // ---- статистика ----
  function device() { var d = ls('vezu-dev'); if (!d) { d = rnd(12); ls('vezu-dev', d); } return d; }
  function track(slug, kind) {
    if (!slug || !enabled) return;
    if (ls('vezu-cloud-slug') === slug) return;          // свои просмотры не считаем
    rpc('vz_track', { p_slug: slug, p_kind: kind, p_device: device() }, { keepalive: true }).catch(function () {});
  }

  // ---- адреса ----
  var SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,18})[a-z0-9]$/;
  var RESERVED = 'admin api app about assets auth card catalog css d demo edit help icons img index js kaspi login logout manifest me new null owner pay pro root settings stats static support sw tarify telegram test undefined vezu whatsapp www 404 supabase tests user driver drivers order orders info privacy terms tools github og p ref pay price help-me'.split(' ');
  function slugCheck(s) { s = String(s || '').toLowerCase().trim(); if (!SLUG_RE.test(s) || s.indexOf('--') >= 0) return 'bad'; if (RESERVED.indexOf(s) >= 0) return 'reserved'; return 'ok'; }
  var TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i' };
  function translit(s) { return String(s || '').toLowerCase().split('').map(function (c) { return TR[c] !== undefined ? TR[c] : c; }).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20).replace(/-+$/, ''); }
  function siteBase() { var p = location.pathname, i = p.indexOf('/dogruz/'); return location.origin + (i >= 0 ? p.slice(0, i + 8) : p.replace(/[^/]*$/, '')); }
  function shortUrl(slug) { return siteBase() + slug; }

  window.VZC = { enabled: enabled, ready: ready, rpc: rpc, key: key, newKey: newKey, setKey: setKey, forget: forget,
    uploadPhoto: uploadPhoto, removePhoto: removePhoto, adminPhoto: adminPhoto, photoUrl: photoUrl, device: device, track: track,
    slugCheck: slugCheck, translit: translit, shortUrl: shortUrl, siteBase: siteBase, ls: ls, cfg: CFG };
})();
