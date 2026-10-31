/* Админка ВЕЗУ Про (admin.html): найти водителя и продлить Про после оплаты Kaspi. Вход — ключ админа. */
(function () {
  'use strict';
  var V = window.VEZU, C = window.VZC, app = document.getElementById('adm'), AK = 'vezu-admin';
  var akey = '', timer = 0;
  try { akey = sessionStorage.getItem(AK) || localStorage.getItem(AK) || ''; } catch (e) {}
  function forgetKey() { try { sessionStorage.removeItem(AK); localStorage.removeItem(AK); } catch (e) {} }
  function esc(s) { return V.esc(s == null ? '' : String(s)); }
  function dt(s) { if (!s) return '—'; var d = new Date(s); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
  function call(fn, args) { return C.rpc(fn, Object.assign({ p_admin: akey }, args || {})); }

  // ключ из буфера: убрать пробелы, переносы, неразрывные и невидимые символы, кавычки
  function cleanKey(v) { return String(v || '').replace(/[\s\u00a0\u200b-\u200f\u2028\u2029\u2060\ufeff"'«»`]/g, ''); }
  function withTimeout(p, ms) {
    return new Promise(function (ok, no) {
      var t = setTimeout(function () { no(new Error('Сервер не ответил за ' + ms / 1000 + ' с. Проверьте интернет и попробуйте ещё раз')); }, ms);
      p.then(function (x) { clearTimeout(t); ok(x); }, function (e) { clearTimeout(t); no(e); });
    });
  }
  function login(msg) {
    app.innerHTML = '<form class="glass panel f adm-login" id="lf" novalidate><h1>Админка ВЕЗУ</h1><p class="muted">Введите ключ админа. Он хранится только у владельца; в базе — лишь его отпечаток (SHA-256).</p>' +
      '<div class="keyrow"><input class="inp" id="ak" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Ключ админа" aria-label="Ключ админа">' +
      '<button class="btn btn-glass eye" type="button" id="eye" aria-label="Показать ключ" aria-pressed="false">👁</button></div>' +
      '<small class="slugst" id="klen"></small>' +
      '<label class="check"><input type="checkbox" id="remember"><span>Запомнить на этом устройстве</span></label>' +
      '<button class="btn btn-grad btn-block" id="go" type="submit">Войти</button>' +
      '<p class="err-msg" id="lerr" role="alert"' + (msg ? '' : ' hidden') + '>' + esc(msg || '') + '</p></form>';
    var f = document.getElementById('lf'), inp = document.getElementById('ak'), btn = document.getElementById('go'),
      err = document.getElementById('lerr'), klen = document.getElementById('klen'), busy = false;
    function show(m) { err.textContent = m; err.hidden = !m; if (m) try { err.scrollIntoView({ block: 'center' }); } catch (e) {} }
    function count() {
      var raw = inp.value, k = cleanKey(raw);
      klen.textContent = raw ? 'Символов: ' + k.length + (k.length !== raw.length ? ' (лишние пробелы и невидимые символы убраны)' : '') : '';
      klen.className = 'slugst' + (raw ? (/^[A-Za-z0-9_-]{32,64}$/.test(k) ? ' ok' : ' bad') : '');
    }
    inp.addEventListener('input', function () { count(); if (!busy) show(''); });
    document.getElementById('eye').addEventListener('click', function () {
      var on = inp.type === 'password'; inp.type = on ? 'text' : 'password';
      this.setAttribute('aria-pressed', on ? 'true' : 'false'); this.setAttribute('aria-label', on ? 'Скрыть ключ' : 'Показать ключ');
    });
    function go(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (busy) return;
      var v = cleanKey(inp.value);
      if (!v) { show('Вставьте ключ админа'); return; }
      if (!/^[A-Za-z0-9_-]{32,64}$/.test(v)) { show('Ключ выглядит неправильно: ' + v.length + ' символов, нужны латиница, цифры, «-» и «_» (обычно 43 символа)'); return; }
      busy = true; btn.disabled = true; btn.textContent = 'Проверяю…'; show('');
      var done = function (m) { busy = false; btn.disabled = false; btn.textContent = 'Войти'; show(m); };
      try {
        withTimeout(C.rpc('vz_is_admin', { p_admin: v }), 10000).then(function (ok) {
          if (ok !== true) return done('Ключ не подходит (' + v.length + ' символов). Проверьте, что скопировали его целиком');
          akey = v;
          try { sessionStorage.setItem(AK, v); if (document.getElementById('remember').checked) localStorage.setItem(AK, v); } catch (x) {}
          try { main(); } catch (x) { done('Ошибка страницы: ' + x.message); }
        }, function (er) { done((er && er.message) || 'Не удалось проверить ключ'); });
      } catch (x) { done('Ошибка: ' + x.message); }
    }
    f.addEventListener('submit', go);
    count();
  }

  function main() {
    app.innerHTML = '<div class="adm-head"><h1>Водители ВЕЗУ Про</h1><button class="lnk" id="out" type="button">Выйти</button></div>' +
      '<div class="adm-stats" id="st"></div>' +
      '<section class="adm-sec" id="vfy"></section><section class="adm-sec" id="reqs"></section><section class="adm-sec" id="exp"></section>' +
      '<section class="adm-sec" id="revs"></section><section class="adm-sec" id="ords"></section>' +
      '<details class="adm-sec glass adm-rates" id="rates"><summary><b>Примерная цена: тарифы по умолчанию</b></summary><div data-rates><p class="muted">Загрузка…</p></div></details>' +
      '<h3>Все водители</h3>' +
      '<input class="inp" id="q" placeholder="Имя, телефон, адрес (slug), город или @telegram" autocomplete="off">' +
      '<label class="fld"><span>Комментарий к продлению (например: Kaspi 1 500 ₸, 26.10)</span><input class="inp" id="note" maxlength="200"></label>' +
      '<div id="rows" class="adm-rows"></div>';
    document.getElementById('out').addEventListener('click', function () { forgetKey(); akey = ''; login(); });
    document.getElementById('q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(find, 300); });
    ['rows', 'reqs', 'exp'].forEach(function (id) { document.getElementById(id).addEventListener('click', act); });
    document.getElementById('revs').addEventListener('click', revAct);
    document.getElementById('ords').addEventListener('click', ordAct);
    document.getElementById('vfy').addEventListener('click', vfyAct);
    stats(); find(); lists(); reviews(); orders(); verifs(); ratesUI();
  }
  // ---------- тарифы «примерной цены» (для общей формы заказа и водителей без своих тарифов) ----------
  var RL = [['Минимальный заказ', '₸'], ['Км по городу (сверх минимума)', '₸/км'], ['Км межгород', '₸/км'], ['Грузчик', '₸'], ['Этаж без лифта', '₸'], ['Км входит в минимум', 'км']];
  function ratesUI() {
    var box = app.querySelector('[data-rates]');
    C.rpc('vz_calc_rates', {}).then(function (v) {
      var a = String(v || '').split(',');
      box.innerHTML = '<p class="muted">Клиент видит «примерно X – Y ₸» по правилу: минимальный заказ + км × тариф + грузчики + этажи, верхняя граница +20%. ' +
        'Обязательны минимальный заказ и оба тарифа за км; пусто — цену не показываем (только расстояние). Водители со своими тарифами — по своим.</p>' +
        '<div class="rates-g">' + RL.map(function (l, i) { return '<label class="fld"><span>' + l[0] + '</span><input class="inp" data-r="' + i + '" inputmode="numeric" maxlength="7" value="' + esc(a[i] || '') + '"><b class="suffix">' + l[1] + '</b></label>'; }).join('') + '</div>' +
        '<div class="row2"><button type="button" class="btn btn-grad btn-sm" data-rsave>Сохранить</button><button type="button" class="btn btn-glass btn-sm" data-rclear>Выключить оценку</button></div>' +
        '<p class="fine" data-rnow>' + (v ? 'Сейчас: ' + esc(v) : 'Сейчас тарифы не заданы — общая форма заказа цену не показывает.') + '</p>';
      box.querySelectorAll('[data-r]').forEach(function (i) { i.addEventListener('input', function () { i.value = i.value.replace(/\D/g, '').slice(0, 7); }); });
      function save(val) {
        call('vz_admin_set_rates', { p_rates: val }).then(function (r) { V.toast(r ? 'Тарифы сохранены' : 'Оценка выключена'); ratesUI(); }, function (er) { V.toast(er.message); });
      }
      box.querySelector('[data-rsave]').addEventListener('click', function () {
        var vals = RL.map(function (l, i) { return box.querySelector('[data-r="' + i + '"]').value; });
        if (!vals[0] || !vals[1] || !vals[2]) return V.toast('Заполните минимальный заказ и оба тарифа за км');
        save(vals.join(','));
      });
      box.querySelector('[data-rclear]').addEventListener('click', function () { if (confirm('Выключить примерную цену в общей форме заказа?')) save(''); });
    }, function (er) { box.innerHTML = '<p class="err-msg">' + esc(er.message) + '</p>'; });
  }
  // ---------- значок «Проверен»: заявки (фото — по ссылкам на 10 минут из закрытого хранилища) ----------
  function verifs() {
    C.verifyCall({ admin: akey, list: true }).then(function (j) {
      var l = j.items || [];
      document.getElementById('vfy').innerHTML = l.length ? '<h3>Проверка водителей: ' + l.length + '</h3>' + l.map(function (r) {
        return '<article class="adm-row glass vf-adm" data-card="' + esc(r.card) + '"><div class="adm-main"><b>' + esc(r.n) + '</b> <span class="muted">+' + esc(r.p) + '</span>' +
          (r.slug ? ' · <a href="' + esc(C.shortUrl(r.slug)) + '" target="_blank">/' + esc(r.slug) + '</a>' : '') + '<br><span class="muted">' + esc([r.car, r.city].filter(Boolean).join(' · ')) + ' · ' + ago(r.at) + '</span>' +
          '<br>Госномер: <b class="vf-plate">' + esc(r.plate) + '</b>' +
          '<div class="vf-ph">' + [['car_url', 'Машина']].map(function (x) { return r[x[0]] ? '<a href="' + esc(r[x[0]]) + '" target="_blank" rel="noopener"><img src="' + esc(r[x[0]]) + '" alt="' + x[1] + '" loading="lazy"><small>' + x[1] + '</small></a>' : '<span class="muted">' + x[1] + ': нет файла</span>'; }).join('') +
          (r.photo ? '<a href="' + esc(C.photoUrl(r.photo)) + '" target="_blank" rel="noopener"><img src="' + esc(C.photoUrl(r.photo)) + '" alt="Фото визитки" loading="lazy"><small>На визитке</small></a>' : '') + '</div>' +
          '<p class="fine">Сверьте: номер на фото = указанный, машина = тип на визитке. Если в кадре люди — отклоните с причиной «Переснимите без людей». После решения фото и номер удаляются.</p></div>' +
          '<div class="adm-act"><button class="btn btn-grad btn-sm" data-vok="1">Одобрить</button><button class="btn btn-glass btn-sm" data-vno="1">Отклонить</button></div></article>';
      }).join('') : '';
    }, function (er) { document.getElementById('vfy').innerHTML = '<p class="err-msg">Заявки на проверку не загрузились: ' + esc(er.message) + '</p>'; });
  }
  function vfyAct(e) {
    var b = e.target.closest('button'); if (!b) return;
    var card = b.closest('[data-card]').dataset.card, note = '';
    if (b.dataset.vno) { note = prompt('Причина отказа (увидит водитель):', 'Номер на фото не читается'); if (note === null) return; }
    b.disabled = true;
    C.verifyCall({ admin: akey, card: card, decide: b.dataset.vok ? 'ok' : 'no', note: note }).then(function () {
      V.toast(b.dataset.vok ? 'Водитель проверен ✓' : 'Отклонено'); verifs(); find();
    }, function (er) { b.disabled = false; V.toast(er.message); });
  }
  // ---------- отзывы: модерация и жалобы ----------
  var RST = { pub: 'опубликован', pending: 'ждёт проверки', hidden: 'скрыт' };
  function reviews() {
    call('vz_admin_reviews').then(function (l) {
      var pend = l.filter(function (r) { return r.status === 'pending'; }).length, comp = l.filter(function (r) { return r.complaints.length; }).length;
      document.getElementById('revs').innerHTML = '<h3>Отзывы: на проверке ' + pend + ' · с жалобами ' + comp + '</h3>' +
        (V.reviewsOn() ? '' : '<p class="pro-pend">Отзывы выключены: на сайте их не видно, новые принять нельзя. Данные сохранены. Включить: REVIEWS_ENABLED: true в js/config.js и reviews_enabled = true в vz_settings.</p>') + (l.length ? l.map(function (r) {
        var st = '★★★★★'.slice(0, r.stars) + '☆☆☆☆☆'.slice(0, 5 - r.stars);
        return '<article class="adm-row glass rv-adm st-r-' + r.status + '" data-rv="' + r.id + '"><div class="adm-main"><b>' + st + '</b> ' + esc(r.author || 'Клиент') +
          ' → <a href="' + esc(C.shortUrl(r.slug)) + '" target="_blank">' + esc(r.n) + '</a> · <span class="muted">' + ago(r.at) + ' · ' + (r.invite ? 'по приглашению' : 'открытая форма') + '</span>' +
          '<br><b class="ost ost-' + r.status + '">' + RST[r.status] + '</b>' + (r.flag ? ' · причина: <b>' + esc(r.flag) + '</b>' : '') +
          (r.body ? '<p>' + esc(r.body) + '</p>' : '') + (r.reply ? '<p class="rv-reply">Ответ водителя: ' + esc(r.reply) + '</p>' : '') +
          (r.complaints.length ? '<p class="err-msg">Жалобы (' + r.complaints.length + '): ' + r.complaints.map(function (c) { return esc(c.reason || 'без причины'); }).join('; ') + '</p>' : '') + '</div>' +
          '<div class="adm-act">' + (r.status !== 'pub' ? '<button class="btn btn-grad btn-sm" data-rs="pub">' + (r.status === 'hidden' ? 'Восстановить' : 'Одобрить') + '</button>' : '<button class="btn btn-glass btn-sm" data-rs="pub">Оставить (жалоба отклонена)</button>') +
          (r.status !== 'hidden' ? '<button class="btn btn-glass btn-sm" data-rs="hidden">Скрыть</button>' : '') + '</div></article>';
      }).join('') : '<p class="empty">Нет отзывов на проверке и жалоб.</p>');
    }, function () {});
  }
  function revAct(e) {
    var b = e.target.closest('[data-rs]'); if (!b) return;
    call('vz_admin_review_set', { p_id: +b.closest('[data-rv]').dataset.rv, p_status: b.dataset.rs }).then(function () { V.toast(b.dataset.rs === 'pub' ? 'Отзыв опубликован' : 'Отзыв скрыт'); reviews(); }, function (er) { V.toast(er.message); });
  }
  // ---------- заказы: просмотр, скрыть, блок устройства ----------
  var OST = { open: 'открыт', taken: 'взят', cancelled: 'отменён', hidden: 'скрыт', expired: 'истёк' };
  function orders() {
    call('vz_admin_orders').then(function (l) {
      document.getElementById('ords').innerHTML = '<h3>Заказы за 30 дней (' + l.length + ')</h3>' + (l.length ? l.slice(0, 60).map(function (o) {
        return '<article class="adm-row glass" data-ord="' + o.id + '"><div class="adm-main"><b>' + (o.cargo && V.cargoLabel(o.cargo) ? '[' + esc(V.cargoLabel(o.cargo)) + '] ' : '') + esc(o.what || 'Перевозка') + '</b> · <span class="ost ost-' + o.state + '">' + OST[o.state] + '</span> · <span class="muted">' + ago(o.at) + '</span><br>' +
          esc((o.from || '—') + ' → ' + (o.to || '—')) + '<br><span class="muted">' + esc(o.name || 'без имени') + ' · +' + esc(o.phone) + ' · ' + (o.scope === 'picked' ? 'выбранным' : 'всем') + ' · откликов: ' + o.responses +
          ' · устройство ' + esc(o.dev) + ' (заказов: ' + o.dev_orders + ')' + (o.blocked ? ' · <b class="err-msg">устройство заблокировано</b>' : '') + '</span>' + (o.note ? '<p>' + esc(o.note) + '</p>' : '') + '</div>' +
          '<div class="adm-act">' + (o.status === 'hidden' ? '<button class="btn btn-glass btn-sm" data-oh="0">Вернуть</button>' : '<button class="btn btn-glass btn-sm" data-oh="1">Скрыть</button>') +
          '<button class="lnk" data-ob="' + (o.blocked ? 0 : 1) + '">' + (o.blocked ? 'Разблокировать устройство' : 'Заблокировать устройство') + '</button></div></article>';
      }).join('') : '<p class="empty">Заказов пока нет.</p>');
    }, function () {});
  }
  function ordAct(e) {
    var b = e.target.closest('[data-oh],[data-ob]'); if (!b) return;
    var id = b.closest('[data-ord]').dataset.ord;
    if (b.dataset.ob === '1' && !confirm('Заблокировать устройство? Его открытые заказы скроются, новые оно отправить не сможет.')) return;
    call('vz_admin_order_set', { p_id: id, p_hide: b.dataset.oh !== undefined ? b.dataset.oh === '1' : null, p_block: b.dataset.ob !== undefined ? b.dataset.ob === '1' : null })
      .then(function () { V.toast('Готово'); orders(); }, function (er) { V.toast(er.message); });
  }
  function stats() {
    call('vz_admin_stats').then(function (s) {
      document.getElementById('st').innerHTML = [['Визиток', s.cards], ['Про активен', s.pro], ['Оплачено', s.paid], ['Пробных', s.trial], ['Просмотров за 7 дн.', s.views7], ['Поделились за 7 дн.', s.shares7 || 0], ['Поделились за 30 дн.', s.shares30 || 0], ['Поделились всего', s.shares_all || 0]]
        .map(function (x) { return '<div><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('');
      var by = s.shares_by || {}, N = { native: 'меню телефона', wa: 'WhatsApp', tg: 'Telegram', copy: 'ссылка', qr: 'QR' };
      var t = Object.keys(N).filter(function (k) { return by[k]; }).map(function (k) { return N[k] + ' ' + by[k]; }).join(' · ');
      if (t) document.getElementById('st').insertAdjacentHTML('beforeend', '<p class="fine" style="grid-column:1/-1;margin:0">«Поделиться» за 30 дн.: ' + esc(t) + '</p>');
    }, function () {});
  }
  function row(r) {
    var pro = r.pro_until && new Date(r.pro_until) > new Date();
    return '<article class="adm-row glass" data-id="' + esc(r.id) + '">' +
      '<div class="adm-main"><b>' + esc(r.n) + '</b> <span class="muted">+' + esc(r.p) + '</span>' +
      (r.tg ? ' <span class="muted">@' + esc(r.tg) + '</span>' : '') + '<br>' +
      '<span class="muted">' + esc([r.c, r.city].filter(Boolean).join(' · ')) + '</span><br>' +
      (r.slug ? '<a href="' + esc(C.shortUrl(r.slug)) + '" target="_blank">/' + esc(r.slug) + '</a>' : '<span class="muted">без адреса</span>') +
      ' · <span class="pro-st ' + (pro ? 'ok' : 'off') + '">' + (r.lifetime ? '★ Про бессрочно' : pro ? 'Про до ' + dt(r.pro_until) + (r.is_paid ? '' : ' (пробный)') : 'без Про') + '</span>' +
      ' · просмотров за 30 дн.: ' + (r.views30 || 0) + (r.refs ? ' · пригласил: ' + r.refs : '') + (r.is_blocked ? ' · <b class="err-msg">скрыта</b>' : '') + (r.is_published ? '' : ' · не в каталоге') + (r.verified_at ? ' · <b class="vf-b">✓ Проверен ' + dt(r.verified_at) + '</b>' : '') +
      ' · создана ' + dt(r.created_at) + '</div>' +
      '<div class="adm-act"><button class="btn btn-grad btn-sm" data-m="1">+1 мес</button><button class="btn btn-glass btn-sm" data-m="3">+3 мес</button>' +
      '<button class="btn btn-glass btn-sm" data-m="12">+12 мес</button><button class="lnk" data-m="0">Отключить Про</button>' +
      '<button class="lnk" data-block="' + (r.is_blocked ? 0 : 1) + '">' + (r.is_blocked ? 'Показать' : 'Скрыть') + '</button>' +
      '<button class="btn btn-glass btn-sm" data-cab="' + esc(r.slug || '') + '">Открыть кабинет на этом устройстве</button>' +
      (r.verified_at ? '<button class="lnk" data-unvf="1">Снять «Проверен»</button>' : '') +
      '<button class="lnk" data-log="1">История</button><button class="lnk" data-del="1">Удалить</button></div></article>';
  }
  function ago(s) { var m = Math.round((Date.now() - new Date(s)) / 60000); return m < 60 ? m + ' мин назад' : m < 1440 ? Math.round(m / 60) + ' ч назад' : dt(s); }
  function mini(r, extra, btns) {
    var pro = r.pro_until && new Date(r.pro_until) > new Date();
    return '<article class="adm-row glass" data-id="' + esc(r.id) + '"' + (r.req_id ? ' data-req="' + r.req_id + '"' : '') + '>' +
      '<div class="adm-main"><b>' + esc(r.n) + '</b> <span class="muted">+' + esc(r.p) + '</span>' +
      (r.slug ? ' · <a href="' + esc(C.shortUrl(r.slug)) + '" target="_blank">/' + esc(r.slug) + '</a>' : '') + '<br>' + extra +
      ' · <span class="pro-st ' + (pro ? 'ok' : 'off') + '">' + (pro ? 'Про до ' + dt(r.pro_until) : 'Про закончился ' + dt(r.pro_until)) + '</span></div>' +
      '<div class="adm-act">' + btns + '</div></article>';
  }
  function lists() {
    call('vz_admin_lists').then(function (l) {
      var rq = l.requests || [], ex = l.expiring || [];
      document.getElementById('reqs').innerHTML = '<h3>Заявки на продление (' + rq.length + ')</h3>' + (rq.length ? rq.map(function (r) {
        var m = r.req_months || 1;
        return mini(r, '«Я оплатил»: <b>' + m + ' мес · ' + V.fmtNum(1500 * m) + ' ₸</b>, ' + ago(r.req_at),
          '<button class="btn btn-grad btn-sm" data-m="' + m + '">Подтвердить +' + m + ' мес</button>' + (m !== 1 ? '<button class="btn btn-glass btn-sm" data-m="1">+1 мес</button>' : '') +
          '<button class="lnk" data-dismiss="1">Оплаты нет — убрать</button>');
      }).join('') : '<p class="empty">Новых заявок нет. Заявка появляется, когда водитель нажимает «Я оплатил».</p>');
      document.getElementById('exp').innerHTML = '<h3>Истекает скоро (' + ex.length + ')</h3>' + (ex.length ? ex.map(function (r) {
        return mini(r, r.is_paid ? 'платный' : 'пробный',
          '<button class="btn btn-grad btn-sm" data-m="1">+1 мес</button><button class="btn btn-glass btn-sm" data-remind="1"><svg><use href="#i-wa"/></svg>Напомнить</button>');
      }).join('') : '<p class="empty">Ни у кого Про не заканчивается в ближайшие 3 дня.</p>');
      document.getElementById('exp').dataset.rows = JSON.stringify(ex.map(function (r) { return [r.id, r.p, r.n, r.pro_until]; }));
    }, function () {});
  }
  function find() {
    var q = document.getElementById('q').value;
    call('vz_admin_find', { p_q: q }).then(function (r) {
      document.getElementById('rows').innerHTML = r.length ? r.map(row).join('') : '<p class="muted">Ничего не найдено</p>';
    }, function (e) { if (/прав/i.test(e.message)) login('Ключ больше не действует'); else V.toast(e.message); });
  }
  function act(e) {
    var b = e.target.closest('button'); if (!b) return;
    var id = b.closest('[data-id]').dataset.id, note = document.getElementById('note').value;
    if (b.dataset.unvf) {
      if (!confirm('Снять значок «Проверен»?')) return;
      return C.verifyCall({ admin: akey, card: id, revoke: true }).then(function () { V.toast('Значок снят'); find(); }, function (er) { V.toast(er.message); });
    }
    if (b.dataset.m !== undefined) {
      var m = +b.dataset.m;
      if (m === 0 && !confirm('Отключить Про сейчас?')) return;
      call('vz_admin_extend', { p_card: id, p_months: m, p_note: note }).then(function (r) {
        V.toast(m ? 'Про продлён до ' + dt(r.pro_until) : 'Про отключён'); find(); stats(); lists();
      }, function (er) { V.toast(er.message); });
    } else if (b.dataset.cab !== undefined) {
      if (!confirm('Открыть кабинет этой визитки на этом телефоне?\n\nТелефон получит новый ключ доступа. Старый ключ (на других телефонах) перестанет работать.')) return;
      b.disabled = true; b.textContent = 'Открываю…';
      call('vz_admin_issue_key', { p_card: id }).then(function (k) {
        if (!C.setKey(k)) throw new Error('Не удалось сохранить ключ');
        C.ls('vezu-cloud-slug', b.dataset.cab || null);
        location.href = 'new.html?cab=1';
      }).catch(function (er) { b.disabled = false; b.textContent = 'Открыть кабинет на этом устройстве'; V.toast(er.message); });
    } else if (b.dataset.dismiss) {
      call('vz_admin_dismiss', { p_req: +b.closest('[data-req]').dataset.req }).then(function () { V.toast('Заявка убрана'); lists(); }, function (er) { V.toast(er.message); });
    } else if (b.dataset.remind) {
      var x = JSON.parse(document.getElementById('exp').dataset.rows || '[]').filter(function (r) { return r[0] === id; })[0];
      if (x) V.openWA(x[1], 'Здравствуйте, ' + x[2] + '! ' + (new Date(x[3]) > new Date() ? 'ВЕЗУ Про заканчивается ' + dt(x[3]) : 'ВЕЗУ Про закончился ' + dt(x[3])) +
        '. Продлить — 1 500 ₸/мес переводом Kaspi на +7 771 410 57 97, затем «Я оплатил» в конструкторе: ' + C.siteBase() + 'new.html');
    } else if (b.dataset.block !== undefined) {
      call('vz_admin_block', { p_card: id, p_blocked: b.dataset.block === '1' }).then(function () { find(); }, function (er) { V.toast(er.message); });
    } else if (b.dataset.del) {
      if (!confirm('Удалить визитку из облака навсегда? Водитель сможет создать её заново.')) return;
      C.adminPhoto(akey, { card: id, remove: true }).then(function () { return call('vz_admin_delete', { p_card: id }); }).then(function () { V.toast('Удалено'); find(); stats(); }, function (er) { V.toast(er.message); });
    } else if (b.dataset.log) {
      call('vz_admin_log', { p_card: id }).then(function (l) {
        V.sheet('История Про', l.length ? '<ul class="why">' + l.map(function (x) {
          return '<li>' + dt(x.created_at) + ': ' + (x.months ? '+' + x.months + ' мес' : 'отключён') + ' → до ' + dt(x.pro_until) + (x.note ? ' — ' + esc(x.note) : '') + '</li>';
        }).join('') + '</ul>' : '<p>Продлений ещё не было.</p>');
      }, function (er) { V.toast(er.message); });
    }
  }

  window.addEventListener('error', function (e) {
    var el = document.getElementById('lerr'); if (el && e && e.message) { el.textContent = 'Ошибка страницы: ' + e.message + '. Обновите страницу.'; el.hidden = false; }
  });
  if (!C || !C.rpc) { app.innerHTML = '<section class="glass panel"><h1>Админка ВЕЗУ</h1><p class="err-msg">Не загрузились файлы сайта. Обновите страницу.</p></section>'; return; }
  // Форму входа показываем сразу, не дожидаясь проверки облака (на медленном интернете страница не «висит»)
  if (!window.fetch || !window.Promise) { app.innerHTML = '<section class="glass panel"><h1>Админка ВЕЗУ</h1><p class="err-msg">Этот браузер слишком старый. Откройте страницу в Chrome.</p></section>'; return; }
  if (!akey) login();
  else withTimeout(C.rpc('vz_is_admin', { p_admin: akey }), 10000).then(function (a) { if (a === true) main(); else { forgetKey(); akey = ''; login('Сохранённый ключ больше не действует'); } },
    function (e) { login(e.message); });
})();
