/* ВЕЗУ Про: оплата через Kaspi. Шаги перевода + «Я оплатил» → заявка в базе (vz_pay_request) и сообщение владельцу в WhatsApp. */
(function () {
  'use strict';
  var V = window.VEZU, C = window.VZC;
  if (!V) return;
  var KASPI = V.SITE_PHONE;                                   // 77714105797
  function price() { return (C && C.cfg && C.cfg.PRO_PRICE) || 1500; }
  function kaspiFmt() { return '+' + KASPI.replace(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5'); }

  // card — объект из vz_me (или null, если визитки в облаке нет); onDone(card) — после «Я оплатил»
  function open(card, onDone) {
    var months = 1;
    var opts = [[1, '1 мес'], [3, '3 мес'], [6, '6 мес'], [12, '12 мес']].map(function (o) {
      return '<button type="button" class="qchip' + (o[0] === 1 ? ' on' : '') + '" data-m="' + o[0] + '">' + o[1] + '</button>';
    }).join('');
    var s = V.sheet('Оплата Про через Kaspi',
      '<div class="qchips" id="pm">' + opts + '</div>' +
      '<ol class="pay-steps">' +
      '<li>Откройте <b>Kaspi.kz</b> → <b>Переводы</b> → <b>По номеру телефона</b>.</li>' +
      '<li>Переведите <b id="psum"></b> на номер <b>' + kaspiFmt() + '</b>.' +
      '<button type="button" class="btn btn-glass btn-sm" id="pcopy"><svg><use href="#i-link"/></svg>Скопировать номер</button></li>' +
      '<li>Нажмите <b>«Я оплатил»</b> — откроется WhatsApp с готовым сообщением. Отправьте его, можно приложить чек.</li>' +
      '</ol>' +
      (card ? '' : '<p class="dirty">Сначала сохраните визитку в облаке в <a href="new.html#pro">конструкторе</a> — так мы поймём, какую визитку продлить.</p>') +
      '<button type="button" class="btn btn-wa btn-block" id="ppaid"><svg><use href="#i-wa"/></svg>Я оплатил</button>' +
      '<p class="fine">Про продлевается вручную, обычно в течение дня. Если что-то не так — просто напишите в этот же чат.</p>', 'pay-sheet');
    var el = s.el;
    function sum() { el.querySelector('#psum').textContent = V.fmtNum(price() * months) + ' ₸'; }
    sum();
    el.querySelector('#pm').addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]'); if (!b) return;
      months = +b.dataset.m; el.querySelectorAll('#pm .qchip').forEach(function (x) { x.classList.toggle('on', x === b); }); sum();
    });
    el.querySelector('#pcopy').addEventListener('click', function () { V.copy(KASPI.replace(/^7/, '+7'), 'Номер скопирован'); });
    el.querySelector('#ppaid').addEventListener('click', function () {
      var text = 'Здравствуйте! Оплатил ВЕЗУ Про через Kaspi: ' + V.fmtNum(price() * months) + ' ₸ за ' + months + ' мес.' +
        (card && card.slug ? '\nВизитка: ' + C.shortUrl(card.slug) + ' (адрес: ' + card.slug + ')' : '') +
        (card ? '\nИмя: ' + card.d.n + ', тел. +' + card.d.p : '');
      // WhatsApp открываем сразу (иначе телефон заблокирует всплывающее окно), заявку пишем параллельно
      V.openWA(KASPI, text);
      if (card && C && C.key()) {
        C.rpc('vz_pay_request', { p_key: C.key(), p_months: months }, { keepalive: true }).then(function () {
          card.pay_pending = true; if (onDone) onDone(card);
        }, function (e) { V.toast(e.message); });
      }
      s.close();
    });
    return s;
  }
  window.VEZU_PAY = { open: open };
})();
