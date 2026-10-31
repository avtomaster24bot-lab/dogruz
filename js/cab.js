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
    if (!V.reviewsOn()) return;
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
      '<section class="glass cab-sec" id="vfsec"><h3>Значок «Проверен»</h3><div data-vf>' + verifyHtml() + '</div></section>' +
      '<section class="glass cab-sec" id="tgsec"><h3><svg class="tg-ic"><use href="#i-tg"/></svg>Уведомления в Telegram</h3><div data-tg><p class="muted">Загружаю…</p></div></section>' +
      (V.reviewsOn() ? '<section class="glass cab-sec" id="reviews"><h3>Отзывы клиентов</h3>' +
      '<button type="button" class="btn btn-grad btn-block" data-ask><svg><use href="#i-star"/></svg>Попросить отзыв</button><div data-myrv><p class="muted">Загружаю…</p></div></section>' : '');
    if (V.reviewsOn()) loadReviews();
    loadFeed(); loadTg();
  }
  function verifyHtml() {
    if (card.verified_at) return '<p class="tg-ok"><span class="vf-b">✓ Проверен</span> с ' + esc(date(card.verified_at)) + '</p><p class="fine">Значок виден клиентам на визитке, в каталоге и в откликах на заказы.</p>';
    if (card.verify_pending) return '<p class="muted">⏳ Заявка на проверке. Обычно — в течение суток.</p><button type="button" class="btn btn-glass btn-sm" data-vfcancel>Отозвать заявку</button>';
    return (card.verify_note ? '<p class="vf-no">Не подтверждено: ' + esc(card.verify_note) + '</p>' : '') +
      '<p class="muted">Клиенты чаще выбирают проверенных водителей. Пришлите фото машины с видимым госномером и селфи — администратор сверит их с визиткой.</p>' +
      '<div class="vf-files"><label class="vf-f"><input type="file" accept="image/*" capture="environment" data-vfcar hidden><span data-vfl="car">🚚 Фото машины с номером</span></label>' +
      '<label class="vf-f"><input type="file" accept="image/*" capture="user" data-vfself hidden><span data-vfl="self">🤳 Селфи</span></label></div>' +
      '<label class="fld"><span>Госномер</span><input class="inp" data-vfplate maxlength="12" placeholder="123ABC02" autocapitalize="characters"></label>' +
      '<label class="check"><input type="checkbox" data-vfok><span>Согласен на обработку госномера, фото машины и селфи для проверки (<a href="privacy.html" target="_blank">политика</a>)</span></label>' +
      '<button type="button" class="btn btn-grad btn-block" data-vfsend>Отправить на проверку</button>' +
      '<p class="fine">Фото и номер видит только администратор (закрытое хранилище, без публичных ссылок). После решения они удаляются — остаётся только отметка «Проверен» и дата. Нерассмотренные заявки удаляются через 30 дней.</p>';
  }
  function vfRefresh() { var el = host.querySelector('[data-vf]'); if (el) el.innerHTML = verifyHtml(); }
  var tgPoll = null;
  function loadTg() {
    var el = host.querySelector('[data-tg]'); if (!el) return;
    C.rpc('vz_tg_status', { p_key: C.key() }).then(function (st) {
      if (!st.linked) {
        return C.rpc('vz_tg_link', { p_key: C.key() }).then(function (tok) {
          el.innerHTML = '<p class="muted">Новые заказы из ленты придут вам в Telegram — без имени и телефона клиента, только тип груза, район и время.' +
            (st.pro ? ' С «Про» — сразу.' : ' Без «Про» — через 10 минут после публикации, с «Про» — сразу.') + '</p>' +
            '<a class="btn btn-tg btn-block" href="https://t.me/' + esc(st.bot) + '?start=' + esc(tok) + '" target="_blank" rel="noopener" data-tggo><svg><use href="#i-tg"/></svg>Подключить Telegram</a>' +
            '<p class="fine">Откроется бот @' + esc(st.bot) + ' — нажмите «Старт». Ссылка действует 30 минут.</p>';
        });
      }
      clearInterval(tgPoll); tgPoll = null;
      el.innerHTML = '<p class="tg-ok">✅ Подключено — заказы приходят в @' + esc(st.bot) + '</p>' +
        '<label class="check"><input type="checkbox" data-tgon' + (st.enabled ? ' checked' : '') + '><span>Присылать новые заказы</span></label>' +
        '<label class="fld"><span>Города (через запятую; пусто — все заказы)</span><input class="inp" data-tgc maxlength="200" value="' + esc(st.cities) + '" placeholder="' + esc(st.city || 'Алматы, Каскелен') + '"></label>' +
        '<div class="row2"><button type="button" class="btn btn-glass" data-tgsave>Сохранить</button><button type="button" class="btn btn-glass" data-tgoff>Отключить</button></div>' +
        '<p class="fine">Заказы без города в адресе приходят всем. Отключить можно и командой /stop в боте — тогда ваш Telegram отвязывается от визитки.</p>';
    }, function () { el.innerHTML = '<p class="muted">Уведомления недоступны — сохраните визитку в облаке.</p>'; });
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
    host.addEventListener('change', function (e) {
      var t = e.target, k = t.matches('[data-vfcar]') ? 'car' : t.matches('[data-vfself]') ? 'self' : '';
      if (!k || !t.files[0]) return;
      var l = host.querySelector('[data-vfl="' + k + '"]'); l.textContent = '✓ ' + (k === 'car' ? 'Фото машины' : 'Селфи') + ' выбрано'; l.parentNode.classList.add('on');
    });
    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-ask]')) return askReview(card);
      if (e.target.closest('[data-vfcancel]')) return C.verifyCall({ key: C.key(), cancel: true }).then(function () { card.verify_pending = false; vfRefresh(); V.toast('Заявка отозвана, фото удалены'); }, function (er) { V.toast(er.message); });
      var vs = e.target.closest('[data-vfsend]');
      if (vs) {
        var fc = host.querySelector('[data-vfcar]').files[0], fs = host.querySelector('[data-vfself]').files[0], pl = host.querySelector('[data-vfplate]').value.trim();
        if (!fc || !fs) return V.toast('Добавьте оба фото');
        if (!host.querySelector('[data-vfok]').checked) return V.toast('Отметьте согласие на обработку');
        if (pl.replace(/[^0-9A-Za-zА-Яа-я]/g, '').length < 4) return V.toast('Укажите госномер');
        vs.disabled = true; vs.textContent = 'Отправляю…';
        return Promise.all([C.shrinkJpeg(fc), C.shrinkJpeg(fs)]).then(function (im) {
          return C.verifyCall({ key: C.key(), plate: pl, car: im[0], selfie: im[1] });
        }).then(function () { card.verify_pending = true; card.verify_note = ''; vfRefresh(); V.toast('Отправлено на проверку'); },
          function (er) { vs.disabled = false; vs.textContent = 'Отправить на проверку'; V.toast(er.message); });
      }
      if (e.target.closest('[data-tggo]')) { var n = 0; clearInterval(tgPoll); tgPoll = setInterval(function () { if (++n > 40) { clearInterval(tgPoll); return; } C.rpc('vz_tg_status', { p_key: C.key() }).then(function (st) { if (st.linked) { V.toast('Telegram подключён ✅'); loadTg(); } }, function () {}); }, 3000); return; }
      if (e.target.closest('[data-tgsave]')) { var c = host.querySelector('[data-tgc]').value, on = host.querySelector('[data-tgon]').checked;
        return C.rpc('vz_tg_set', { p_key: C.key(), p_cities: c, p_enabled: on }).then(function () { V.toast('Сохранено'); loadTg(); }, function (er) { V.toast(er.message); }); }
      if (e.target.closest('[data-tgoff]')) { if (!confirm('Отключить уведомления и отвязать Telegram?')) return;
        return C.rpc('vz_tg_unlink', { p_key: C.key() }).then(function () { V.toast('Telegram отключён'); loadTg(); }, function (er) { V.toast(er.message); }); }
      var b = e.target.closest('[data-reply]'); if (!b) return;
      var ta = b.parentNode.querySelector('textarea'), t = ta.value.trim();
      if (!t) { ta.focus(); return; }
      b.disabled = true;
      C.rpc('vz_review_reply', { p_key: C.key(), p_id: +b.dataset.reply, p_text: t }).then(function () { V.toast('Ответ опубликован'); loadReviews(); }, function (er) { b.disabled = false; V.toast(er.message); });
    });
  }
  window.VEZU_CAB = { render: render, statusHtml: statusHtml, bindStatus: bindStatus, statusSheet: statusSheet, stars: stars, date: date };
})();
