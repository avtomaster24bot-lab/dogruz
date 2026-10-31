/* Наклейка «Закажи эту машину» с QR визитки: A6, A5 и на заднее стекло. Рисуется на canvas, скачивается PNG или PDF. */
(function () {
  'use strict';
  var V = window.VEZU;
  var SIZES = {
    a6: { mm: [105, 148], dpi: 300, label: 'A6 · 10,5×14,8 см' },
    a5: { mm: [148, 210], dpi: 300, label: 'A5 · 14,8×21 см' },
    win: { mm: [500, 250], dpi: 150, label: 'Заднее стекло · 50×25 см' }
  };
  var INK = '#0b0b1f';
  function qrDraw(g, text, x, y, size) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    var q = qrcode(0, 'M'); q.addData(text, 'Byte'); q.make();
    var n = q.getModuleCount(), quiet = 2, cell = size / (n + quiet * 2);
    g.fillStyle = '#fff'; g.fillRect(x, y, size, size); g.fillStyle = INK;
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++)
      if (q.isDark(r, c)) g.fillRect(Math.floor(x + (c + quiet) * cell), Math.floor(y + (r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
  }
  // текст по центру/слева с уменьшением шрифта, пока не влезет
  function fit(g, s, x, y, maxW, px, weight, color, align) {
    var f = px;
    do { g.font = (weight || 800) + ' ' + f + 'px Inter, "Segoe UI", Roboto, Arial, sans-serif'; f -= 2; } while (g.measureText(s).width > maxW && f > 8);
    g.fillStyle = color || INK; g.textAlign = align || 'center'; g.textBaseline = 'alphabetic'; g.fillText(s, x, y);
  }
  function grad(g, x, y, w, h) {
    var gr = g.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, '#7c5cff'); gr.addColorStop(1, '#22d3ee'); return gr;
  }
  function draw(card, url, size, scale, mirror) {
    var S = SIZES[size], k = (S.dpi / 25.4) * (scale || 1), W = Math.round(S.mm[0] * k), H = Math.round(S.mm[1] * k);
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), d = card.d || {}, phone = V.fmtPhone(d.p), meta = 'Грузоперевозки' + (d.c ? ' · ' + d.c : '') + (d.t ? ' · ' + d.t : '');
    if (mirror) { g.translate(W, 0); g.scale(-1, 1); }
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    if (size === 'win') {
      var pad = H * 0.07, qs = H - pad * 2;
      g.fillStyle = grad(g, 0, 0, W, H); g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff'; g.beginPath(); if (g.roundRect) g.roundRect(pad * 0.6, pad * 0.6, qs + pad * 0.8, qs + pad * 0.8, pad * 0.5); else g.rect(pad * 0.6, pad * 0.6, qs + pad * 0.8, qs + pad * 0.8); g.fill();
      qrDraw(g, url, pad, pad, qs);
      var tx = qs + pad * 2.2, tw = W - tx - pad;
      fit(g, 'ЗАКАЖИ', tx, H * 0.27, tw, H * 0.2, 900, '#fff', 'left');
      fit(g, 'ЭТУ МАШИНУ', tx, H * 0.48, tw, H * 0.2, 900, '#fff', 'left');
      fit(g, phone, tx, H * 0.7, tw, H * 0.15, 900, '#fff', 'left');
      fit(g, meta, tx, H * 0.83, tw, H * 0.07, 700, 'rgba(255,255,255,.92)', 'left');
      fit(g, 'Наведите камеру на QR → заказ в WhatsApp', tx, H * 0.93, tw, H * 0.05, 600, 'rgba(255,255,255,.85)', 'left');
    } else {
      var m = W * 0.07, band = H * 0.2;
      g.fillStyle = grad(g, 0, 0, W, band); g.fillRect(0, 0, W, band);
      fit(g, 'ЗАКАЖИ', W / 2, band * 0.46, W - m * 2, band * 0.36, 900, '#fff');
      fit(g, 'ЭТУ МАШИНУ', W / 2, band * 0.86, W - m * 2, band * 0.36, 900, '#fff');
      fit(g, meta, W / 2, band + H * 0.055, W - m * 2, H * 0.03, 700, INK);
      var q = W * 0.7; qrDraw(g, url, (W - q) / 2, band + H * 0.075, q);
      var y = band + H * 0.075 + q;
      fit(g, 'Наведите камеру — закажите в WhatsApp', W / 2, y + H * 0.035, W - m * 2, H * 0.024, 600, '#4b4b63');
      fit(g, phone, W / 2, y + H * 0.105, W - m * 2, H * 0.06, 900, INK);
      fit(g, d.n || '', W / 2, y + H * 0.15, W - m * 2, H * 0.032, 700, '#4b4b63');
      g.fillStyle = grad(g, 0, H - H * 0.018, W, H * 0.018); g.fillRect(0, H - H * 0.018, W, H * 0.018);
    }
    return cv;
  }
  // минимальный PDF: одна страница нужного размера с JPEG на всю площадь
  function pdf(cv, mm) {
    var jpg = atob(cv.toDataURL('image/jpeg', 0.95).split(',')[1]), pw = (mm[0] * 72 / 25.4).toFixed(2), ph = (mm[1] * 72 / 25.4).toFixed(2);
    var parts = [], off = [], len = 0;
    function add(s) { parts.push(s); len += s.length; }
    function obj(n, s) { off[n] = len; add(n + ' 0 obj\n' + s + '\nendobj\n'); }
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    obj(4, '<< /Type /XObject /Subtype /Image /Width ' + cv.width + ' /Height ' + cv.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n' + jpg + '\nendstream');
    var cs = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
    obj(5, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
    var x = len; add('xref\n0 6\n0000000000 65535 f \n');
    for (var i = 1; i <= 5; i++) add(('000000000' + off[i]).slice(-10) + ' 00000 n \n');
    add('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n');
    var s = parts.join(''), a = new Uint8Array(s.length);
    for (var j = 0; j < s.length; j++) a[j] = s.charCodeAt(j) & 255;
    return a;
  }
  function html() {
    return '<div class="stk-sz" role="group" aria-label="Размер">' + Object.keys(SIZES).map(function (k, i) {
      return '<button type="button" class="qchip' + (i ? '' : ' on') + '" data-stk="' + k + '" aria-pressed="' + (i ? 'false' : 'true') + '">' + SIZES[k].label + '</button>';
    }).join('') + '</div><div class="stk-prev"><img alt="Предпросмотр наклейки" data-stkimg></div>' +
      '<label class="check" data-stkmir hidden><input type="checkbox" data-stkm><span>Зеркально — если клеите изнутри стекла (печать на прозрачной плёнке)</span></label>' +
      '<div class="row2"><button type="button" class="btn btn-grad" data-stkdl="png">Скачать PNG</button><button type="button" class="btn btn-glass" data-stkdl="pdf">Скачать PDF</button></div>' +
      '<p class="fine">PDF — точно в размер для типографии; PNG — для печати дома или в фотосалоне. QR открывает вашу визитку.</p>';
  }
  function bind(host, getCard) {
    var cur = 'a6';
    function url() { return window.VZC.shortUrl(getCard().slug); }
    function mir() { var m = host.querySelector('[data-stkm]'); return cur === 'win' && m && m.checked; }
    function prev() { var im = host.querySelector('[data-stkimg]'); if (!im) return; im.src = draw(getCard(), url(), cur, 0.12 * (cur === 'win' ? 2 : 1), mir()).toDataURL('image/png'); im.className = 'stk-' + cur; }
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-stk]');
      if (b) {
        cur = b.dataset.stk;
        host.querySelectorAll('[data-stk]').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        host.querySelector('[data-stkmir]').hidden = cur !== 'win'; prev(); return;
      }
      var dl = e.target.closest('[data-stkdl]'); if (!dl) return;
      var c = getCard(), cv = draw(c, url(), cur, 1, mir()), name = 'nakleika-' + cur + '-' + V.fileName(c.slug || 'vezu');
      if (dl.dataset.stkdl === 'pdf') V.download(name + '.pdf', pdf(cv, SIZES[cur].mm), 'application/pdf');
      else cv.toBlob(function (bl) { V.download(name + '.png', bl, 'image/png'); }, 'image/png');
    });
    host.addEventListener('change', function (e) { if (e.target.matches('[data-stkm]')) prev(); });
    prev();
  }
  window.VEZU_STICKER = { html: html, bind: bind, draw: draw, pdf: pdf, SIZES: SIZES };
})();
