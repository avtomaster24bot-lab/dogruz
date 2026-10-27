/* ВЕЗУ: отзывы на визитке — список, форма (по приглашению — сразу, открытая — после модерации), жалобы. */
(function () {
  'use strict';
  var V = window.VEZU, C = window.VZC;
  if (!V || !C) return;
  function esc(s) { return V.esc(s == null ? '' : String(s)); }
  function stars(n) { var s = ''; for (var i = 1; i <= 5; i++) s += i <= n ? '★' : '☆'; return '<span class="stars" aria-label="Оценка ' + n + ' из 5">' + s + '</span>'; }
  function date(s) { try { return new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Almaty' }); } catch (e) { return ''; } }
  var NOTE = 'Пишите только о своём реальном опыте. Ложные отзывы удаляются.';
  function item(x, driver) {
    return '<article class="rv"><div class="rv-h">' + stars(x.stars) + '<b>' + esc(x.author || 'Клиент') + '</b><span class="muted">' + esc(date(x.at)) + '</span></div>' +
      (x.invite ? '<span class="rv-inv">По приглашению водителя</span>' : '') +
      (x.body ? '<p>' + esc(x.body) + '</p>' : '') +
      (x.reply ? '<p class="rv-reply"><b>Ответ водителя:</b> ' + esc(x.reply) + '</p>' : '') +
      '<button type="button" class="rv-flag" data-flag="' + x.id + '"><svg><use href="#i-flag"/></svg>Пожаловаться</button></article>';
  }
  function complain(id) {
    if (!V.reviewsOn()) return;
    var reasons = ['Ложный отзыв', 'Оскорбления', 'Личные данные', 'Реклама / спам', 'Другое'];
    var s = V.sheet('Пожаловаться на отзыв', '<div class="qchips" data-rs>' + reasons.map(function (r, i) { return '<button type="button" class="qchip' + (i ? '' : ' on') + '">' + r + '</button>'; }).join('') + '</div>' +
      '<textarea class="inp" maxlength="250" rows="3" placeholder="Что не так? (необязательно)"></textarea>' +
      '<button type="button" class="btn btn-grad btn-block" data-go>Отправить жалобу</button><p class="fine">Администратор ВЕЗУ проверит отзыв и скроет его, если он нарушает правила.</p>', 'rv-flag-sheet');
    var why = reasons[0];
    s.el.querySelector('[data-rs]').addEventListener('click', function (e) { var b = e.target.closest('.qchip'); if (!b) return; why = b.textContent; s.el.querySelectorAll('[data-rs] .qchip').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    s.el.querySelector('[data-go]').addEventListener('click', function () {
      var t = s.el.querySelector('textarea').value.trim();
      C.rpc('vz_review_complain', { p_id: id, p_reason: why + (t ? ': ' + t : ''), p_device: C.device() }).then(function () { s.close(); V.toast('Жалоба отправлена. Спасибо!'); }, function (e) { V.toast(e.message); });
    });
  }
  // Форма отзыва. token — из ссылки-приглашения (публикуется сразу), иначе — на модерацию.
  function form(slug, driver, token, done) {
    if (!V.reviewsOn()) return null;
    var n = 0;
    var s = V.sheet('Отзыв о водителе ' + driver,
      (token ? '<p class="rv-inv">По приглашению водителя</p>' : '<p class="muted">Отзыв появится после проверки модератором.</p>') +
      '<div class="rv-pick" role="radiogroup" aria-label="Оценка">' + [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" role="radio" aria-checked="false" data-n="' + i + '" aria-label="' + i + ' из 5">★</button>'; }).join('') + '</div>' +
      '<label class="fld"><span>Ваше имя</span><input class="inp" name="rn" maxlength="30" placeholder="Только имя, например: Айгерим" autocomplete="given-name"></label>' +
      '<label class="fld"><span>Отзыв <em class="counter" data-cnt>0/500</em></span><textarea class="inp" name="rb" maxlength="500" rows="4" placeholder="Как прошла перевозка? Вовремя, аккуратно, по цене?"></textarea></label>' +
      '<p class="err-msg" data-err hidden></p>' +
      '<button type="button" class="btn btn-grad btn-block" data-send>Отправить отзыв</button>' +
      '<p class="rv-note">' + NOTE + '</p><p class="fine">Не указывайте телефоны, адреса и ссылки — такие отзывы уходят на проверку.</p>', 'rv-form');
    var el = s.el, err = el.querySelector('[data-err]');
    el.querySelector('.rv-pick').addEventListener('click', function (e) {
      var b = e.target.closest('[data-n]'); if (!b) return; n = +b.dataset.n;
      el.querySelectorAll('.rv-pick button').forEach(function (x) { var on = +x.dataset.n <= n; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(+x.dataset.n === n)); });
    });
    var ta = el.querySelector('[name=rb]');
    ta.addEventListener('input', function () { el.querySelector('[data-cnt]').textContent = ta.value.length + '/500'; });
    el.querySelector('[data-send]').addEventListener('click', function () {
      if (!n) { err.textContent = 'Поставьте оценку — от 1 до 5 звёзд'; err.hidden = false; return; }
      var b = this; b.disabled = true; b.textContent = 'Отправляю…'; err.hidden = true;
      C.rpc('vz_review_submit', { p_slug: slug, p_stars: n, p_body: ta.value, p_author: el.querySelector('[name=rn]').value, p_device: C.device(), p_token: token || null }).then(function (st) {
        s.close();
        V.toast(st === 'pub' ? 'Спасибо! Отзыв опубликован' : 'Спасибо! Отзыв появится после проверки', 4000);
        if (done) done(st);
      }, function (e) { b.disabled = false; b.textContent = 'Отправить отзыв'; err.textContent = e.message; err.hidden = false; });
    });
    return s;
  }
  // Блок отзывов на визитке
  function mount(sec, slug, driver, rating) {
    if (!V.reviewsOn()) {                 // отзывы выключены: блока нет, ссылка-приглашение просто открывает визитку
      sec.hidden = true; sec.innerHTML = '';
      var q = new URLSearchParams(location.search);
      if (q.has('r') || q.has('review')) { q.delete('r'); q.delete('review'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
      return { reload: function () {} };
    }
    var short = String(driver || '').split(' ')[0];
    function draw(list) {
      var r = rating && rating.n ? '★ ' + String(rating.avg).replace('.', ',') + ' · ' + rating.n + ' ' + V.plural(rating.n, 'отзыв', 'отзыва', 'отзывов') : '';
      sec.innerHTML = '<div class="rv-top"><h2>Отзывы</h2>' + (r ? '<span class="rv-sum">' + r + '</span>' : '') + '</div>' +
        (list.length ? list.map(function (x) { return item(x, short); }).join('') : '<p class="muted">Отзывов пока нет. Возили с этим водителем? Расскажите, как всё прошло.</p>') +
        '<div class="btns">' + (rating && rating.n > list.length ? '<button type="button" class="btn btn-glass btn-sm" data-all>Все отзывы (' + rating.n + ')</button>' : '') +
        '<button type="button" class="btn btn-glass btn-sm" data-write><svg><use href="#i-star"/></svg>Оставить отзыв</button></div>' +
        '<p class="rv-note">' + NOTE + '</p>';
      sec.hidden = false;
    }
    function load() { C.rpc('vz_reviews', { p_slug: slug, p_limit: 3, p_offset: 0 }).then(function (l) { draw(l || []); }, function () { sec.hidden = true; }); }
    sec.addEventListener('click', function (e) {
      var f = e.target.closest('[data-flag]'); if (f) return complain(+f.dataset.flag);
      if (e.target.closest('[data-write]')) return form(slug, short, null);
      if (e.target.closest('[data-all]')) {
        C.rpc('vz_reviews', { p_slug: slug, p_limit: 50, p_offset: 0 }).then(function (l) {
          var s = V.sheet('Все отзывы', (l || []).map(function (x) { return item(x, short); }).join('') + '<p class="rv-note">' + NOTE + '</p>', 'rv-all');
          s.el.addEventListener('click', function (e2) { var f2 = e2.target.closest('[data-flag]'); if (f2) complain(+f2.dataset.flag); });
        }, function (er) { V.toast(er.message); });
      }
    });
    load();
    // ссылка-приглашение: card.html?u=<адрес>&r=<токен>
    var tok = (new URLSearchParams(location.search).get('r') || '').replace(/[^a-f0-9]/g, '').slice(0, 64);
    if (tok) C.rpc('vz_review_invite_info', { p_token: tok }).then(function (i) {
      if (!i) return V.toast('Ссылка для отзыва недействительна');
      if (i.used) return V.toast('По этой ссылке отзыв уже оставлен. Спасибо!');
      if (!i.valid) return V.toast('Срок ссылки для отзыва истёк');
      form(slug, short, tok, function (st) { history.replaceState(null, '', location.pathname + '?u=' + slug); if (st === 'pub') location.reload(); });
    }, function () {});
    return { reload: load };
  }
  window.VEZU_RV = { mount: mount, form: form, stars: stars, item: item };
})();
