/* ВЕЗУ: кабинет водителя — статус «Свободен / Занят», отзывы (пригласить, ответить), вход в ленту заказов. */
(function () {
  'use strict';
  var V = window.VEZU, C = window.VZC;
  if (!V || !C) return;
  function esc(s) { return V.esc(s == null ? '' : String(s)); }
  function stars(n) { var s = ''; for (var i = 1; i <= 5; i++) s += i <= n ? '★' : '☆'; return '<span class="stars" aria-label="' + n + ' из 5">' + s + '</span>'; }
  function date(s) { try { return new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Almaty' }); } catch (e) { return ''; } }
  // минут до завтра 09:00 по Алматы
  function tillTomorrow() {
    var now = Date.now(), al = new Date(now + 5 * 3600e3);
    var t = Date.UTC(al.getUTCFullYear(), al.getUTCMonth(), al.getUTCDate() + 1, 9, 0) - 5 * 3600e3;
    return Math.min(1440, Math.round((t - now) / 60000));
  }

  // ---------- статус ----------
  function statusHtml(st) {
    var i = V.statusInfo(st), free = i && i.s === 'free', busy = i && i.s === 'busy';
    return '<div class="st-box" data-stbox>' +
      '<div class="st-big"><button type="button" class="st-btn st-free' + (free ? ' on' : '') + '" data-st="free"><i></i>Свободен</button>' +
      '<button type="button" class="st-btn st-busy' + (busy ? ' on' : '') + '" data-st="busy"><i></i>Занят</button></div>' +
      '<div class="qchips st-q"><span class="muted">Занят на:</span><button type="button" class="qchip" data-min="60">1 ч</button><button type="button" class="qchip" data-min="180">3 ч</button><button type="button" class="qchip" data-min="tomorrow">до завтра</button></div>' +
      '<p class="st-now">' + (i ? 'Сейчас клиенты видят: <b class="st-' + i.s + '">' + esc(i.text) + '</b>' + (busy && st.until ? ' — потом снова «Свободен»' : '') :
        'Статус не задан — на визитке его не видно. Нажмите «Свободен», когда готовы к заказам.') + '</p>' +
      '<p class="fine">Статус виден 24 часа после изменения — обновляйте его каждый день.</p></div>';
  }
  function bindStatus(root, onChange) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-st],[data-min]'); if (!b || !root.contains(b)) return;
      var st = b.dataset.st || 'busy', min = b.dataset.min === 'tomorrow' ? tillTomorrow() : b.dataset.min ? +b.dataset.min : null;
      root.querySelectorAll('[data-st],[data-min]').forEach(function (x) { x.disabled = true; });
      C.rpc('vz_set_status', { p_key: C.key(), p_status: st, p_minutes: min }).then(function (s) {
        var box = root.querySelector('[data-stbox]'); box.outerHTML = statusHtml(s);
        V.toast(st === 'free' ? 'Вы «Свободен» — клиенты это видят' : 'Статус: ' + V.statusInfo(s).text);
        if (onChange) onChange(s);
      }, function (er) { V.toast(er.message); root.querySelectorAll('[data-st],[data-min]').forEach(function (x) { x.disabled = false; }); });
    });
  }
  // быстрый лист статуса (с визитки на своём телефоне)
  function statusSheet(st, onChange) {
    var s = V.sheet('Мой статус', statusHtml(st) + '<a class="btn btn-glass btn-block" href="app.html#feed"><svg><use href="#i-feed"/></svg>Лента заказов</a><a class="lnk" href="new.html#pro">Открыть кабинет</a>', 'st-sheet');
    bindStatus(s.el, onChange);
    return s;
  }

  // ---------- отзывы: пригласить ----------
  function inviteUrl(slug, tok) { return C.siteBase() + 'card.html?u=' + encodeURIComponent(slug) + '&r=' + tok; }
  function askReview(card) {
    if (!card.slug) { V.toast('Сначала задайте короткий адрес визитки (Про)'); return; }
    C.rpc('vz_review_invite', { p_key: C.key() }).then(function (tok) {
      var url = inviteUrl(card.slug, tok), text = 'Здравствуйте! Это ' + card.d.n.split(' ')[0] + ', водитель. Спасибо за заказ! Оставьте, пожалуйста, короткий отзыв — это 30 секунд: ' + url;
      var s = V.sheet('Попросить отзыв', '<p class="muted">Одноразовая ссылка для одного клиента, действует 14 дней. Отправьте её тому, кого вы реально возили.</p>' +
        '<div class="linkrow"><input class="inp" readonly value="' + esc(url) + '"><button class="btn btn-glass" type="button" data-c aria-label="Копировать"><svg><use href="#i-link"/></svg></button></div>' +
        '<button type="button" class="btn btn-wa btn-block" data-w><svg><use href="#i-wa"/></svg>Отправить в WhatsApp</button>' +
        '<button type="button" class="btn btn-glass btn-block" data-s><svg><use href="#i-share"/></svg>Поделиться</button>' +
        '<p class="fine">Не пишите отзывы сами и не просите писать тех, кто не пользовался услугой — такие отзывы удаляются.</p>', 'rv-ask');
      s.el.querySelector('[data-c]').onclick = function () { V.copy(url); };
      s.el.querySelector('[data-w]').onclick = function () { V.openWA('', text); };
      s.el.querySelector('[data-s]').onclick = function () { V.share('Отзыв о водителе', text.replace(url, '').trim(), url); };
    }, function (e) { V.toast(e.message); });
  }
  function myReviewsHtml(r) {
    if (!r) return '';
    var list = r.list || [];
    return '<p class="muted">' + (list.length ? 'Опубликовано: ' + list.length : 'Отзывов пока нет') + (r.pending ? ' · на проверке: ' + r.pending : '') + (r.invites ? ' · ждут ответа клиентов: ' + r.invites : '') + '</p>' +
      list.slice(0, 20).map(function (x) {
        return '<div class="rv"><div class="rv-h">' + stars(x.stars) + '<b>' + esc(x.author || 'Клиент') + '</b><span class="muted">' + esc(date(x.at)) + '</span></div>' +
          (x.body ? '<p>' + esc(x.body) + '</p>' : '') +
          (x.reply ? '<p class="rv-reply"><b>Ваш ответ:</b> ' + esc(x.reply) + '</p>' :
            '<div class="rv-rep" data-rid="' + x.id + '"><textarea class="inp" maxlength="500" rows="2" placeholder="Ответить публично (один раз)"></textarea><button type="button" class="btn btn-glass btn-sm" data-reply="' + x.id + '">Ответить</button></div>') + '</div>';
      }).join('') + '<p class="fine">Удалить или изменить отзыв нельзя. Если отзыв ложный — нажмите «Пожаловаться» на визитке, администратор проверит.</p>';
  }

  // ---------- блок кабинета ----------
  var host, card, feedN = 0;
  function render(c) {
    card = c;
    var pro = document.getElementById('pro');
    if (!pro) return;
    if (!host) { host = document.createElement('div'); host.id = 'cab'; host.className = 'cab f'; pro.parentNode.insertBefore(host, pro); bind(); }
    if (!card || card.is_blocked) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    host.innerHTML = '<section class="glass cab-sec" id="status"><h3>Мой статус</h3>' + statusHtml(card.status) + '</section>' +
      '<a class="cab-feed glass" href="app.html#feed"><svg><use href="#i-feed"/></svg><span><b>Лента заказов</b><small>Заказы клиентов рядом — откликайтесь «Беру»</small></span><em class="cnt" data-feedn' + (feedN ? '' : ' hidden') + '>' + feedN + '</em></a>' +
      '<section class="glass cab-sec" id="reviews"><h3>Отзывы клиентов</h3>' +
      '<button type="button" class="btn btn-grad btn-block" data-ask><svg><use href="#i-star"/></svg>Попросить отзыв</button><div data-myrv><p class="muted">Загружаю…</p></div></section>';
    loadReviews(); loadFeed();
  }
  function loadReviews() {
    C.rpc('vz_my_reviews', { p_key: C.key() }).then(function (r) { var el = host.querySelector('[data-myrv]'); if (el) el.innerHTML = myReviewsHtml(r); }, function () {});
  }
  function loadFeed() {
    C.rpc('vz_feed', { p_key: C.key() }).then(function (f) {
      feedN = (f || []).filter(function (o) { return o.status === 'open' && !o.my; }).length;
      var el = host.querySelector('[data-feedn]'); if (el) { el.textContent = feedN; el.hidden = !feedN; }
    }, function () {});
  }
  function bind() {
    bindStatus(host, function (s) { if (card) card.status = s; });
    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-ask]')) return askReview(card);
      var b = e.target.closest('[data-reply]'); if (!b) return;
      var ta = b.parentNode.querySelector('textarea'), t = ta.value.trim();
      if (!t) { ta.focus(); return; }
      b.disabled = true;
      C.rpc('vz_review_reply', { p_key: C.key(), p_id: +b.dataset.reply, p_text: t }).then(function () { V.toast('Ответ опубликован'); loadReviews(); }, function (er) { b.disabled = false; V.toast(er.message); });
    });
  }
  window.VEZU_CAB = { render: render, statusHtml: statusHtml, bindStatus: bindStatus, statusSheet: statusSheet, stars: stars, date: date };
})();
