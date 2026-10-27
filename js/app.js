/* ВЕЗУ: приложение клиента и водителя (app.html) — Заказ · Мои водители · Мои заказы · Лента (для водителей). */
(function () {
  'use strict';
  var V = window.VEZU, C = window.VZC, F = window.VEZU_FAV, CAB = window.VEZU_CAB;
  function esc(s) { return V.esc(s == null ? '' : String(s)); }
  function $(s, r) { return (r || document).querySelector(s); }
  var tabs = ['order', 'favs', 'orders', 'feed'], cur = '';
  var POLL = 20000, timer = 0;

  // устройство клиента: случайный токен на телефоне, в базе — только хэш
  function dev() {
    var t = C.ls('vezu-otok');
    if (!t) { var a = new Uint8Array(24); crypto.getRandomValues(a); t = 'od' + Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); C.ls('vezu-otok', t); }
    return t;
  }
  function me() { var m = C.ls('vezu-me'); return m && typeof m === 'object' ? m : {}; }
  function ago(s) { var m = Math.round((Date.now() - new Date(s)) / 60000); return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : m < 1440 ? Math.round(m / 60) + ' ч назад' : new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Asia/Almaty' }); }
  function when(o) { return o.when_at ? new Date(o.when_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' }) : o.when || ''; }
  function est(c) { return c && c.lo ? '≈ ' + V.fmtNum(c.lo) + ' – ' + V.fmtNum(c.hi) + ' ₸' : ''; }
  function route(o) { return '<p class="o-route"><i class="dot d1"></i>' + esc(o.from || '—') + '<br><i class="dot d2"></i>' + esc(o.to || '—') + '</p>'; }
  function facts(o) {
    var c = o.calc || {}, a = [];
    if (when(o)) a.push('🕑 ' + when(o));
    if (c.km) a.push(c.km + ' км' + (c.inter ? ' · межгород' : ''));
    if (c.loaders) a.push('грузчики: ' + c.loaders);
    if (c.floors) a.push('этажи без лифта: ' + c.floors);
    if (c.price) a.push('цена клиента: ' + V.fmtNum(c.price) + ' ₸');
    return a.length ? '<p class="o-facts">' + a.map(esc).join(' · ') + '</p>' : '';
  }
  function mapLink(c) { return c && c.a && c.b ? 'https://www.google.com/maps/dir/?api=1&origin=' + c.a.lat + ',' + c.a.lon + '&destination=' + c.b.lat + ',' + c.b.lon + '&travelmode=driving' : ''; }

  // ---------- вкладки ----------
  function show(t) {
    if (tabs.indexOf(t) < 0) t = 'order';
    cur = t;
    document.querySelectorAll('[data-tab]').forEach(function (s) { s.hidden = s.dataset.tab !== t; });
    document.querySelectorAll('.bnav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + t); a.setAttribute('aria-current', a.getAttribute('href') === '#' + t ? 'page' : 'false'); });
    if (t === 'favs') drawFavs();
    if (t === 'orders') loadOrders();
    if (t === 'feed') loadFeed();
    if (t === 'order') drawTargets();
    clearInterval(timer);
    if (t === 'orders' || t === 'feed') timer = setInterval(function () { if (!document.hidden) (t === 'orders' ? loadOrders : loadFeed)(true); }, POLL);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) badges(); });

  // ---------- заказ ----------
  var form = $('#nord'), target = 'all', picked = {};
  V.bindOrderForm(form, function () { return V.SITE_PHONE; }, null, { anchor: form.querySelector('[data-tg]').closest('.fld') });
  // кнопка «Отправить в WhatsApp» формы — прямой заказ; основной — в ленту водителей
  var m = me(); if (m.n) form.querySelector('[name=cn]').value = m.n; if (m.p) form.querySelector('[name=cp]').value = V.fmtPhone ? V.fmtPhone(m.p) : m.p;
  form.querySelector('[data-tg]').addEventListener('click', function (e) {
    var b = e.target.closest('[data-t]'); if (!b) return;
    target = b.dataset.t;
    form.querySelectorAll('[data-tg] .qchip').forEach(function (x) { x.classList.toggle('on', x === b); });
    drawTargets();
  });
  var catRows = null;
  function drawTargets() {
    var box = $('#tgl'), favs = F.list();
    var fb = form.querySelector('[data-t=fav]'); if (fb) fb.disabled = !favs.length;
    if (target === 'fav' && !favs.length) target = 'all';
    if (target === 'all') { box.innerHTML = '<p class="fine">Заказ увидят все водители ВЕЗУ в «Ленте». Ваш телефон увидит только водитель, который откликнется.</p>'; return; }
    var rows = target === 'fav' ? favs : favs.concat((catRows || []).filter(function (r) { return !F.has(r.slug); }));
    if (target === 'pick' && !catRows) {
      catRows = [];
      C.rpc('vz_catalog', { p_limit: 60 }).then(function (r) { catRows = (r || []).map(function (x) { var d = V.clean(x.d); return { slug: x.slug, n: d.n, c: d.c, w: d.w, t: d.t, st: x.status, rating: x.rating }; }); drawTargets(); }, function () {});
    }
    if (target === 'fav') { picked = {}; favs.forEach(function (f) { picked[f.slug] = 1; }); }
    box.innerHTML = (rows.length ? rows.map(function (r) {
      var si = V.statusInfo(r.st);
      return '<label class="tg-row"><input type="checkbox" value="' + esc(r.slug) + '"' + (picked[r.slug] ? ' checked' : '') + (target === 'fav' ? ' disabled checked' : '') + '><span><b>' + esc(r.n) + (F.has(r.slug) ? ' ★' : '') + '</b><small>' + esc([r.c, r.w, r.t].filter(Boolean).join(' · ')) + '</small></span>' +
        (si ? '<em class="st-' + si.s + '">' + esc(si.short) + '</em>' : '') + '</label>';
    }).join('') : '<p class="muted">Загружаю водителей…</p>') + '<p class="fine">Заказ увидят только выбранные водители.</p>';
  }
  var orderConsent = V.consentGate(form, 'order', $('#osend'));
  $('#tgl').addEventListener('change', function (e) { if (e.target.type === 'checkbox') { if (e.target.checked) picked[e.target.value] = 1; else delete picked[e.target.value]; } });
  $('#osend').addEventListener('click', function () {
    var err = $('#oerr'); err.hidden = true;
    var g = function (n) { var i = form.querySelector('[name=' + n + ']'); return i ? i.value.trim() : ''; };
    var phone = V.normPhone(g('cp'));
    var o = { what: g('what'), from: g('from'), to: g('to'), when: g('when'), note: g('note'), name: g('cn'), phone: phone || '' };
    var at = g('at'); if (at) { var d = new Date(at); if (!isNaN(d)) o.when_at = d.toISOString(); }
    var c = form._calc ? JSON.parse(JSON.stringify(form._calc)) : {}; delete c.how;
    var pr = +g('price').replace(/\D/g, ''); if (pr) c.price = pr;
    if (!c.a && form._geo) c.a = form._geo;
    o.calc = c;
    var fail = function (t) { err.textContent = t; err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    if (!o.what && !o.from) return fail('Напишите, что везём и откуда.');
    if (!phone) return fail('Укажите телефон — его увидит только водитель, который откликнется.');
    var slugs = target === 'all' ? null : target === 'fav' ? F.list().map(function (f) { return f.slug; }) : Object.keys(picked);
    if (slugs && !slugs.length) return fail('Отметьте хотя бы одного водителя.');
    C.ls('vezu-me', { n: o.name, p: phone });
    var b = this; b.disabled = true; b.textContent = 'Отправляю…';
    if (!orderConsent()) return fail('Поставьте галочку согласия на обработку данных.');
    C.rpc('vz_order_create', { p_dev: dev(), p_order: o, p_slugs: slugs, p_consent: orderConsent() }).then(function () {
      b.disabled = false; b.innerHTML = '<svg><use href="#i-feed"/></svg>Отправить водителям';
      ['what', 'from', 'to', 'note', 'price', 'at'].forEach(function (n) { var i = form.querySelector('[name=' + n + ']'); if (i) i.value = ''; });
      var cb = form.querySelector('[data-consent=order]'); cb.checked = false; cb.dispatchEvent(new Event('change'));
      if (form._calcReset) form._calcReset();
      V.toast('Заказ отправлен! Ответы водителей — в «Мои заказы»', 4000);
      location.hash = '#orders';
    }, function (e) { b.disabled = false; b.innerHTML = '<svg><use href="#i-feed"/></svg>Отправить водителям'; fail(e.message); });
  });

  // ---------- мои водители ----------
  function drawFavs() {
    var a = F.list(), box = $('#favl');
    box.innerHTML = a.length ? a.map(function (x) {
      return '<article class="fav glass' + (x.pin ? ' pinned' : '') + '"><a class="fav-top" href="' + esc(C.shortUrl(x.slug)) + '"><i class="cat-av">' + (x.photo ? '<img src="' + esc(x.photo) + '" alt="" onerror="this.remove()">' : '') + '<b>' + esc(V.initials(x.n)) + '</b></i>' +
        '<span><b>' + (x.pin ? '📌 ' : '') + esc(x.n) + '</b><small>' + esc([x.c, x.w, x.t].filter(Boolean).join(' · ')) + '</small><em class="fav-st" data-st="' + esc(x.slug) + '"></em></span></a>' +
        '<div class="fav-b">' + (x.p ? '<a class="btn btn-wa btn-sm" href="#" data-wa="' + esc(x.p) + '" data-n="' + esc(x.n) + '"><svg><use href="#i-wa"/></svg>WhatsApp</a><a class="btn btn-glass btn-sm" href="tel:+' + esc(x.p) + '"><svg><use href="#i-phone"/></svg></a>' : '') +
        '<button type="button" class="btn btn-glass btn-sm" data-pin="' + esc(x.slug) + '">' + (x.pin ? 'Открепить' : 'Закрепить') + '</button><button type="button" class="btn btn-glass btn-sm" data-rm="' + esc(x.slug) + '" aria-label="Убрать">✕</button></div></article>';
    }).join('') + '<a class="btn btn-grad btn-block" href="#order"><svg><use href="#i-feed"/></svg>Заказ «Только избранным»</a>' :
      '<div class="empty glass"><h2>Пока пусто</h2><p class="muted">Нажмите ☆ «В избранное» на визитке или в каталоге — водитель появится здесь.</p><a class="btn btn-grad" href="catalog.html">Найти водителя</a></div>';
    // статус «Свободен / Занят» — свежий из облака
    a.forEach(function (x) {
      C.rpc('vz_card', { p_slug: x.slug }).then(function (r) {
        if (!r) return; var si = V.statusInfo(r.status), el = box.querySelector('[data-st="' + x.slug + '"]');
        if (el) el.innerHTML = (si ? '<span class="st-' + si.s + '"><i></i>' + esc(si.short) + '</span>' : '') + (V.reviewsOn() && r.rating && r.rating.n ? ' ★ ' + String(r.rating.avg).replace('.', ',') : '');
      }, function () {});
    });
  }
  $('#favl').addEventListener('click', function (e) {
    if (e.target.closest('a[href="#order"]')) { target = 'fav'; form.querySelectorAll('[data-tg] .qchip').forEach(function (x) { x.classList.toggle('on', x.dataset.t === 'fav'); }); return; }
    var b = e.target.closest('[data-pin],[data-rm],[data-wa]'); if (!b) return;
    e.preventDefault();
    if (b.dataset.pin) F.pin(b.dataset.pin);
    else if (b.dataset.rm) { if (!confirm('Убрать водителя из избранного?')) return; F.remove(b.dataset.rm); }
    else return V.openWA(b.dataset.wa, 'Здравствуйте, ' + b.dataset.n.split(' ')[0] + '! Нужна перевозка.');
    drawFavs();
  });

  // ---------- мои заказы ----------
  var LABEL = { open: 'Отправлен', resp: 'Водитель откликнулся', taken: 'Взят', cancelled: 'Отменён', expired: 'Истёк' };
  function stateOf(o) { return o.state === 'open' && o.responses.length ? 'resp' : o.state; }
  function respHtml(o, r) {
    var chosen = o.taken === r.slug;
    return '<div class="resp' + (chosen ? ' chosen' : '') + '"><a class="resp-h" href="' + esc(C.shortUrl(r.slug)) + '"><i class="cat-av">' + (r.photo ? '<img src="' + esc(C.photoUrl(r.photo)) + '" alt="" onerror="this.remove()">' : '') + '<b>' + esc(V.initials(r.n)) + '</b></i>' +
      '<span><b>' + esc(r.n) + (chosen ? ' · выбран' : '') + '</b><small>' + esc([r.c, r.w].filter(Boolean).join(' · ')) + (V.reviewsOn() && r.rating && r.rating.n ? ' · ★ ' + String(r.rating.avg).replace('.', ',') : '') + '</small></span>' +
      (r.price ? '<em class="resp-p">' + V.fmtNum(r.price) + ' ₸</em>' : '') + '</a>' +
      (r.comment ? '<p class="resp-c">«' + esc(r.comment) + '»</p>' : '') +
      '<div class="resp-b"><a class="btn btn-wa btn-sm" href="#" data-wa="' + esc(r.p) + '" data-n="' + esc(r.n) + '"><svg><use href="#i-wa"/></svg>WhatsApp</a><a class="btn btn-glass btn-sm" href="tel:+' + esc(r.p) + '"><svg><use href="#i-phone"/></svg>Звонок</a>' +
      (o.state === 'open' ? '<button type="button" class="btn btn-grad btn-sm" data-pick="' + esc(r.slug) + '" data-o="' + o.id + '">Выбрать</button>' : '') + '</div></div>';
  }
  var lastOrders = null;
  function loadOrders(quiet) {
    var box = $('#ordl');
    if (!quiet && !lastOrders) box.innerHTML = '<p class="muted">Загружаю…</p>';
    if (!C.ls('vezu-otok')) { lastOrders = []; return drawOrders(); }
    C.rpc('vz_my_orders', { p_dev: dev() }).then(function (a) { lastOrders = a || []; drawOrders(); seenOrders(); }, function (e) { if (!quiet) box.innerHTML = '<p class="err-msg">' + esc(e.message) + '</p>'; });
  }
  function drawOrders() {
    var a = lastOrders || [], box = $('#ordl');
    box.innerHTML = a.length ? a.map(function (o) {
      var s = stateOf(o);
      return '<article class="ord glass st-o-' + s + '"><div class="ord-h"><span class="ost ost-' + s + '">' + LABEL[s] + (s === 'resp' ? ' · ' + o.responses.length : '') + '</span><span class="muted">' + esc(ago(o.at)) + '</span></div>' +
        '<h3>' + esc(o.what || 'Перевозка') + '</h3>' + route(o) + facts(o) + (est(o.calc) ? '<p class="o-est">' + est(o.calc) + '</p>' : '') +
        (o.scope === 'picked' ? '<p class="fine">Только для: ' + esc((o.targets || []).join(', ')) + '</p>' : '') +
        (o.responses.length ? o.responses.map(function (r) { return respHtml(o, r); }).join('') : o.state === 'open' ? '<p class="muted wait">Ждём отклики водителей… Страница обновляется сама.</p>' : '') +
        (V.reviewsOn() && o.state === 'taken' && !o.review_issued ? '<button type="button" class="btn btn-glass btn-block" data-rev="' + o.id + '"><svg><use href="#i-star"/></svg>Оставить отзыв водителю</button>' : '') +
        (o.state === 'open' || o.state === 'taken' ? '<button type="button" class="lnk" data-cancel="' + o.id + '">Отменить заказ</button>' : '') + '</article>';
    }).join('') : '<div class="empty glass"><h2>Заказов пока нет</h2><p class="muted">Опишите груз — водители ответят здесь со своей ценой.</p><a class="btn btn-grad" href="#order">Новый заказ</a></div>';
  }
  $('#ordl').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pick],[data-cancel],[data-rev],[data-wa]'); if (!b) return;
    e.preventDefault();
    if (b.dataset.wa) return V.openWA(b.dataset.wa, 'Здравствуйте, ' + b.dataset.n.split(' ')[0] + '! Это по моему заказу в ВЕЗУ.');
    if (b.dataset.pick) {
      if (!confirm('Выбрать этого водителя? Заказ закроется для остальных.')) return;
      C.rpc('vz_order_pick', { p_dev: dev(), p_id: b.dataset.o, p_slug: b.dataset.pick }).then(function () { V.toast('Готово! Свяжитесь с водителем'); loadOrders(); }, function (er) { V.toast(er.message); });
    } else if (b.dataset.cancel) {
      if (!confirm('Отменить заказ?')) return;
      C.rpc('vz_order_cancel', { p_dev: dev(), p_id: b.dataset.cancel }).then(function () { loadOrders(); }, function (er) { V.toast(er.message); });
    } else if (b.dataset.rev) {
      C.rpc('vz_order_review', { p_dev: dev(), p_id: b.dataset.rev }).then(function (r) { location.href = 'card.html?u=' + encodeURIComponent(r.slug) + '&r=' + r.token; }, function (er) { V.toast(er.message); });
    }
  });

  // ---------- лента водителя ----------
  var lastFeed = null, myCard = null;
  function loadFeed(quiet) {
    var box = $('#feedl');
    if (!C.key()) { box.innerHTML = '<div class="empty glass"><h2>Лента — для водителей</h2><p class="muted">Сохраните визитку в облаке ВЕЗУ — и здесь появятся заказы клиентов. Откликайтесь «Беру» со своей ценой.</p><a class="btn btn-grad" href="new.html">Создать визитку</a></div>'; $('#feedst').innerHTML = ''; return; }
    if (!quiet && !lastFeed) box.innerHTML = '<p class="muted">Загружаю заказы…</p>';
    if (!myCard) C.rpc('vz_me', { p_key: C.key() }).then(function (c) { myCard = c; var st = $('#feedst'); if (c && CAB) { st.innerHTML = '<section class="glass cab-sec">' + CAB.statusHtml(c.status) + '</section>'; } }, function () {});
    C.rpc('vz_feed', { p_key: C.key() }).then(function (a) { lastFeed = a || []; drawFeed(); seenFeed(); }, function (e) { if (!quiet) box.innerHTML = '<p class="err-msg">' + esc(e.message) + '</p>'; });
  }
  function drawFeed() {
    var a = lastFeed || [], box = $('#feedl');
    box.innerHTML = a.length ? a.map(function (o) {
      var tag = o.mine ? '<span class="ost ost-taken">Клиент выбрал вас</span>' : o.personal ? '<span class="ost ost-me">Лично вам</span>' : '<span class="ost">Всем водителям</span>';
      var ml = mapLink(o.calc);
      return '<article class="ord glass' + (o.personal ? ' personal' : '') + (o.mine ? ' mine' : '') + '"><div class="ord-h">' + tag + '<span class="muted">' + esc(ago(o.at)) + (o.responses ? ' · откликов: ' + o.responses : '') + '</span></div>' +
        '<h3>' + esc(o.what || 'Перевозка') + '</h3>' + route(o) + facts(o) + (est(o.calc) ? '<p class="o-est">Оценка: ' + est(o.calc) + '</p>' : '') +
        (o.note ? '<p class="resp-c">' + esc(o.note) + '</p>' : '') +
        (o.phone ? '<p class="fine">Клиент: ' + esc(o.name || 'без имени') + ' · +' + esc(o.phone) + '</p>' : '<p class="fine">' + (o.my ? 'Телефон появится, когда клиент выберет вас. Клиент видит ваш отклик и может написать вам в WhatsApp.' : 'Телефон клиента увидит только водитель, которого клиент выберет.') + '</p>') +
        (ml ? '<a class="lnk" href="' + esc(ml) + '" target="_blank" rel="noopener">Маршрут на карте</a>' : '') +
        (o.my ? '<p class="my-resp">Ваш отклик: ' + (o.my.price ? V.fmtNum(o.my.price) + ' ₸' : 'без цены') + (o.my.comment ? ' · ' + esc(o.my.comment) : '') + '</p>' : '') +
        '<div class="resp-b">' + (o.phone ? '<a class="btn btn-wa btn-sm" href="#" data-wa="' + esc(o.phone) + '" data-id="' + o.id + '"><svg><use href="#i-wa"/></svg>WhatsApp</a><a class="btn btn-glass btn-sm" href="tel:+' + esc(o.phone) + '"><svg><use href="#i-phone"/></svg>Звонок</a>' : '') +
        (o.status === 'open' ? '<button type="button" class="btn ' + (o.my ? 'btn-glass' : 'btn-grad') + ' btn-sm" data-take="' + o.id + '">' + (o.my ? 'Изменить отклик' : 'Беру') + '</button>' : '') + '</div></article>';
    }).join('') : '<div class="empty glass"><h2>Пока заказов нет</h2><p class="muted">Новые заказы появятся здесь сами — лента обновляется каждые 20 секунд. Поставьте статус «Свободен», чтобы клиенты видели вас первым.</p></div>';
  }
  $('#feedst').addEventListener('click', function () {});
  if (CAB) CAB.bindStatus($('#feedst'), function (s) { if (myCard) myCard.status = s; });
  $('#feedl').addEventListener('click', function (e) {
    var b = e.target.closest('[data-take],[data-wa]'); if (!b) return;
    e.preventDefault();
    var o = (lastFeed || []).filter(function (x) { return x.id === (b.dataset.take || b.dataset.id); })[0]; if (!o) return;
    if (b.dataset.wa) return V.openWA(o.phone, 'Здравствуйте' + (o.name ? ', ' + o.name : '') + '! Я водитель с ВЕЗУ, по вашему заказу: ' + (o.what || 'перевозка') + (o.from ? ', ' + o.from : '') + (o.to ? ' → ' + o.to : '') + '.' + (o.my && o.my.price ? ' Цена: ' + V.fmtNum(o.my.price) + ' ₸.' : ''));
    var s = V.sheet('Беру заказ', '<p class="muted">' + esc(o.what || 'Перевозка') + '</p>' +
      '<label class="fld"><span>Ваша цена (необязательно)</span><input class="inp" name="tp" inputmode="numeric" placeholder="' + (o.calc && o.calc.lo ? V.fmtNum(o.calc.lo) : '10 000') + '" value="' + (o.my && o.my.price ? V.fmtNum(o.my.price) : '') + '"><b class="suffix">₸</b></label>' +
      '<label class="fld"><span>Комментарий</span><input class="inp" name="tc" maxlength="200" placeholder="Буду через 30 минут" value="' + esc(o.my ? o.my.comment : '') + '"></label>' +
      '<button type="button" class="btn btn-grad btn-block" data-go>Откликнуться</button><p class="fine">Клиент увидит ваш отклик и сможет написать вам в WhatsApp. Когда клиент выберет вас, здесь появится его телефон; заказ закроется для остальных.</p>', 'take-sheet');
    var tp = s.el.querySelector('[name=tp]'); tp.addEventListener('input', function () { tp.value = V.fmtNum(tp.value.replace(/\D/g, '').slice(0, 8)); });
    s.el.querySelector('[data-go]').addEventListener('click', function () {
      C.rpc('vz_order_respond', { p_key: C.key(), p_id: o.id, p_price: +tp.value.replace(/\D/g, '') || null, p_comment: s.el.querySelector('[name=tc]').value }).then(function () {
        s.close(); V.toast('Отклик отправлен! Клиент увидит его и напишет вам'); loadFeed();
      }, function (er) { V.toast(er.message); });
    });
  });

  // ---------- счётчики на нижней панели ----------
  function setBadge(t, n) { var el = document.querySelector('.bnav a[href="#' + t + '"] em'); if (el) { el.textContent = n > 9 ? '9+' : n; el.hidden = !n; } }
  function respCount(a) { return (a || []).reduce(function (s, o) { return s + (o.state === 'open' || o.state === 'taken' ? o.responses.length : 0); }, 0); }
  function seenOrders() { C.ls('vezu-seen-resp', String(respCount(lastOrders))); setBadge('orders', 0); }
  function seenFeed() { C.ls('vezu-seen-feed', (lastFeed || []).map(function (o) { return o.id; }).slice(0, 200)); setBadge('feed', 0); }
  function badges() {
    if (C.ls('vezu-otok') && cur !== 'orders') C.rpc('vz_my_orders', { p_dev: dev() }).then(function (a) { setBadge('orders', Math.max(0, respCount(a) - (+C.ls('vezu-seen-resp') || 0))); }, function () {});
    if (C.key() && cur !== 'feed') C.rpc('vz_feed', { p_key: C.key() }).then(function (a) {
      var seen = C.ls('vezu-seen-feed'); if (!Array.isArray(seen)) seen = [];
      setBadge('feed', (a || []).filter(function (o) { return o.status === 'open' && !o.my && seen.indexOf(o.id) < 0; }).length);
    }, function () {});
  }
  if (C.key()) document.body.classList.add('is-driver');
  F.on(function () { if (cur === 'favs') drawFavs(); });
  C.ready().then(function (ok) {
    if (!ok) { $('#app').insertAdjacentHTML('afterbegin', '<p class="err-msg">Нет связи с сервером ВЕЗУ — заказ можно отправить сразу в WhatsApp.</p>'); }
    show(location.hash.slice(1) || 'order'); badges();
    setInterval(function () { if (!document.hidden) badges(); }, POLL * 3);
  });
})();
