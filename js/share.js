/* ВЕЗУ — «Поделиться VEZU»: шторка с системным «Поделиться», WhatsApp, Telegram, копированием и QR.
   Считается анонимно (vz_share: источник + канал + хеш случайного id устройства), без персональных данных. */
(function () {
  'use strict';
  var V = window.VEZU; if (!V) return;
  var CFG = window.VEZU_CFG || {};
  var SITE = 'https://avtomaster24bot-lab.github.io/dogruz/';
  var TEXT = 'Нужно что-то перевезти? 🚚 VEZU — грузоперевозки до 3 т без посредников: водители рядом, цену видно сразу, заказ за 2 касания. Сохрани себе, пригодится:';
  function standalone() { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } }
  function dev() {
    var d = ''; try { d = JSON.parse(localStorage.getItem('vezu-dev') || '""'); } catch (e) {}
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(d || '')) {
      d = ''; var a = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
      a.forEach(function (x) { d += ('0' + x.toString(16)).slice(-2); });
      try { localStorage.setItem('vezu-dev', JSON.stringify(d)); } catch (e) {}
    }
    return d;
  }
  function track(src, ch, slug) {
    if (!CFG.SUPABASE_URL || CFG.FORCE_OFF) return;
    try {
      fetch(CFG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/vz_share', { method: 'POST', keepalive: true,
        headers: { apikey: CFG.SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_src: src, p_ch: ch, p_device: dev(), p_slug: slug || null }) }).catch(function () {});
    } catch (e) {}
  }
  var qrLoading = null;
  function needQR() {
    if (window.qrcode) return Promise.resolve();
    if (!qrLoading) qrLoading = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'js/vendor/qrcode.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    return qrLoading;
  }

  // o: { src, url, text, title, slug, head, sub }
  function open(o) {
    o = o || {};
    var src = o.src || 'other', url = o.url || SITE, text = o.text || TEXT, title = o.title || 'VEZU — грузоперевозки';
    var full = text + ' ' + url;
    var html = (o.sub ? '<p class="muted sh-sub">' + V.esc(o.sub) + '</p>' : '') +
      (navigator.share ? '<button type="button" class="btn sh-main btn-block" data-ch="native"><svg><use href="#i-share"/></svg>Отправить через…</button>' : '') +
      '<div class="sh-grid">' +
      '<button type="button" data-ch="wa" class="sh-wa"><svg><use href="#i-wa"/></svg><span>WhatsApp</span></button>' +
      '<button type="button" data-ch="tg" class="sh-tg"><svg><use href="#i-tg"/></svg><span>Telegram</span></button>' +
      '<button type="button" data-ch="copy"><svg><use href="#i-link"/></svg><span>Ссылка</span></button>' +
      '<button type="button" data-ch="qr"><svg><use href="#i-qr"/></svg><span>QR-код</span></button></div>' +
      '<div class="sh-qr" hidden><div class="qr qr-big"></div><p class="fine">Покажите другу — он наведёт камеру телефона и откроет VEZU.</p></div>' +
      '<div class="sh-msg"><span class="fine">Текст сообщения</span><p>' + V.esc(text) + ' <b>' + V.esc(url.replace(/^https:\/\//, '')) + '</b></p></div>';
    var s = V.sheet(o.head || 'Поделиться VEZU', html, 'sheet-share');
    s.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ch]'); if (!b) return;
      var ch = b.dataset.ch; track(src, ch, o.slug);
      if (ch === 'native') navigator.share({ title: title, text: text, url: url }).catch(function () {});
      else if (ch === 'wa') V.openWA('', full);
      else if (ch === 'tg') { var tg = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text); if (standalone()) location.href = tg; else window.open(tg, '_blank', 'noopener'); }
      else if (ch === 'copy') V.copy(full, 'Ссылка и текст скопированы — вставьте другу в чат');
      else if (ch === 'qr') {
        var box = s.el.querySelector('.sh-qr');
        needQR().then(function () { box.querySelector('.qr').innerHTML = V.qrSvg(url); box.hidden = false; box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
          function () { V.toast('Не удалось загрузить QR — проверьте интернет'); });
      }
    });
    return s;
  }
  // Любая кнопка с data-share="home|app|order|catalog" открывает шторку
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-share]'); if (!b) return;
    e.preventDefault(); open({ src: b.dataset.share });
  });
  // Плавающая кнопка (главная, каталог в браузере): прячется, когда видна кнопка отправки заказа или нижняя панель
  var fab = document.getElementById('sharefab');
  if (fab && 'IntersectionObserver' in window) {
    var seen = new Set();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) seen.add(x.target); else seen.delete(x.target); });
      upd();
    });
    document.querySelectorAll('[data-nofab]').forEach(function (x) { io.observe(x); });
    var typing = false, upd = function () { fab.classList.toggle('away', typing || seen.size > 0); };
    document.addEventListener('focusin', function (e) { if (e.target.matches('input,textarea,select')) { typing = true; upd(); } });
    document.addEventListener('focusout', function () { typing = false; setTimeout(upd, 50); });
  }
  window.VEZU_SHARE = { open: open, track: track, SITE: SITE, TEXT: TEXT };
})();
