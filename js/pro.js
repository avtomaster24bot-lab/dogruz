/* ВЕЗУ Про в конструкторе (new.html, шаг 3): облако, короткий адрес, фото для всех, каталог, статистика. */
(function () {
  'use strict';
  var V = window.VEZU, C = window.VZC, B = window.VEZU_B, box = document.getElementById('pro');
  if (!box || !C || !B) return;
  var card = null, stats = null, period = 'd7', busy = false, slugTimer = 0, CFG = C.cfg;
  var PRICE = V.fmtNum(CFG.PRO_PRICE || 1500) + ' ₸/мес';

  // ключ из ссылки new.html#k=… (перенос на другой телефон)
  var hm = /[#&]k=([A-Za-z0-9_-]{32,64})/.exec(location.hash);
  if (hm) { C.setKey(hm[1]); history.replaceState(null, '', location.pathname + location.search); }
  // приглашение: new.html?ref=<код> — запоминаем до первого сохранения в облаке
  var rm = /[?&]ref=([0-9a-f]{8})\b/.exec(location.search);
  if (rm && !C.key()) C.ls('vezu-ref', rm[1]);

  function esc(s) { return V.esc(s == null ? '' : String(s)); }
  function dt(s) { var d = new Date(s); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
  function sig(img) { return img ? img.length + ':' + img.slice(-24) : ''; }
  function same(a, b) { return JSON.stringify(V.clean(a || {})) === JSON.stringify(V.clean(b || {})); }
  function isDirty() {
    if (!card) return false;
    var x = B.photo(), ph = card.pro && ((x && x.img && x.up !== sig(x.img)) || (!!localStorage.getItem('vezu-photo-del') && !!card.photo));
    return !same(B.data(), card.d) || !!ph;
  }
  function li(t) { return '<li><svg><use href="#i-check"/></svg><span>' + t + '</span></li>'; }

  function renderSoon() {
    box.innerHTML = '<h3>ВЕЗУ Про <em class="soon">скоро</em></h3><p class="muted">Короткий адрес, фото для всех клиентов, каталог водителей и статистика.</p><a class="tlink" href="tarify.html">Подробнее о тарифах →</a>';
  }
  function slugField(val) {
    return '<label class="fld"><span>Короткий адрес</span><div class="slugrow"><b>' + esc(C.siteBase().replace(/^https?:\/\//, '')) + '</b>' +
      '<input class="inp" id="slug" value="' + esc(val) + '" maxlength="20" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="aslan" inputmode="url"></div>' +
      '<small class="slugst" id="slugst"></small></label>';
  }
  function pubField(on) {
    return '<label class="check"><input type="checkbox" id="pub"' + (on ? ' checked' : '') + '><span>Показывать меня в <a href="catalog.html" target="_blank">каталоге водителей</a></span></label>';
  }
  function renderNew() {
    var d = B.data(), sugg = C.translit((d.n || '').split(' ')[0]);
    if (sugg.length < 3) sugg = '';
    box.innerHTML = '<h3>ВЕЗУ Про <span class="grad-text">— 7 дней бесплатно</span></h3>' +
      '<ul class="pro-ul">' + li('Короткий адрес: <b>' + esc(C.siteBase().replace(/^https?:\/\//, '')) + 'имя</b>') + li('Фото видят все клиенты') +
      li('Место в каталоге водителей') + li('Статистика: просмотры, WhatsApp, звонки') + li('Без надписи «Сделано на ВЕЗУ»') + '</ul>' +
      slugField(sugg) + pubField(true) +
      '<button type="button" class="btn btn-grad btn-block" id="psave">Сохранить в облаке и включить Про</button>' +
      '<p class="fine">Регистрация не нужна — телефон получит секретный ключ доступа. Через 7 дней — ' + PRICE + ', оплата Kaspi через WhatsApp. ' +
      'Если не продлить, визитка и короткий адрес продолжат работать, но без фото, каталога и статистики.</p>' +
      '<button type="button" class="lnk" id="haskey">У меня уже есть ключ доступа</button>';
    bindSlug(); checkSlug();
  }
  function statsHtml() {
    if (!stats) return '<p class="muted">Статистика загружается…</p>';
    var s = stats[period] || {};
    return '<div class="seg qchips" id="per"><button type="button" class="qchip' + (period === 'd7' ? ' on' : '') + '" data-p="d7">7 дней</button>' +
      '<button type="button" class="qchip' + (period === 'd30' ? ' on' : '') + '" data-p="d30">30 дней</button></div>' +
      '<div class="stat3"><div><b>' + (s.view || 0) + '</b><span>просмотры</span></div><div><b>' + (s.wa || 0) + '</b><span>WhatsApp</span></div><div><b>' + (s.call || 0) + '</b><span>звонки</span></div></div>' +
      '<p class="fine">Считается одно действие каждого вида с телефона в день. Ваши собственные просмотры не считаются.</p>';
  }
  function daysLeft() { return card.pro_until ? Math.ceil((new Date(card.pro_until) - Date.now()) / 864e5) : -1; }
  function dayWord(n) { var a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'день' : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 'дня' : 'дней'; }
  function warnHtml() {
    var n = daysLeft();
    if (card.is_blocked || card.lifetime || n > 3) return '';
    var txt = card.pro ? (n <= 1 ? '<b>Про заканчивается завтра</b>' : '<b>Про заканчивается через ' + n + ' ' + dayWord(n) + '</b>') +
        ' (' + dt(card.pro_until) + '). После этого клиенты перестанут видеть фото, а вы пропадёте из каталога.'
      : '<b>Про закончился.</b> Фото, каталог и статистика выключены. Визитка и короткий адрес работают.';
    return '<div class="pro-warn' + (card.pro ? '' : ' off') + '"><span>' + txt + '</span>' +
      (card.pay_pending ? '<span class="muted">Заявка на продление отправлена — ждём подтверждения оплаты.</span>' :
        '<button type="button" class="btn btn-grad btn-sm" data-pay="1">Продлить через Kaspi</button>') + '</div>';
  }
  function refHtml() {
    if (!card.ref_code) return '';
    var url = C.siteBase() + 'new.html?ref=' + card.ref_code, n = card.ref_count || 0;
    return '<div class="pro-ref"><h4>Приведи водителя — +7 дней Про</h4>' +
      '<p class="muted">Отправьте ссылку знакомому водителю. Когда он сохранит свою визитку в облаке, вам добавится 7 дней Про. За каждого нового водителя (новый номер) — один раз.</p>' +
      '<div class="linkrow"><input class="inp" readonly value="' + esc(url) + '" aria-label="Ссылка-приглашение"><button class="btn btn-glass" type="button" id="rcopy" aria-label="Копировать"><svg><use href="#i-link"/></svg></button></div>' +
      '<div class="row2"><button type="button" class="btn btn-wa btn-sm" id="rsend"><svg><use href="#i-wa"/></svg>Отправить в WhatsApp</button></div>' +
      '<p class="fine" id="rcount">Пришло по вашей ссылке: <b>' + n + '</b>' + (n ? ' · +' + (7 * n) + ' ' + dayWord(7 * n) + ' Про' : '') + '</p></div>';
  }
  function renderCard() {
    var pro = card.pro, until = card.pro_until ? dt(card.pro_until) : '';
    var dirty = isDirty(), n = daysLeft();
    box.innerHTML = '<h3>ВЕЗУ Про</h3>' + warnHtml() +
      '<p class="pro-st ' + (pro ? 'ok' : 'off') + '">' + (pro ? card.lifetime ? '★ Про · бессрочно' : 'Про активен до ' + until + (n > 3 ? ' (ещё ' + n + ' ' + dayWord(n) + ')' : '') + (card.paid ? '' : ' · пробный период') : 'Про закончился ' + until + ' — визитка работает без Про-функций') + '</p>' +
      (card.is_blocked ? '<p class="err-msg">Визитка скрыта администратором. Напишите в поддержку ВЕЗУ.</p>' : '') +
      (card.slug ? '<div class="linkrow"><input class="inp" readonly value="' + esc(C.shortUrl(card.slug)) + '" aria-label="Короткий адрес"><button class="btn btn-glass" type="button" id="scopy" aria-label="Копировать"><svg><use href="#i-link"/></svg></button>' +
        '<button class="btn btn-glass" type="button" id="sshare" aria-label="Поделиться"><svg><use href="#i-share"/></svg></button></div>' : '') +
      (dirty ? '<p class="dirty">Есть изменения, которых ещё нет в облаке — нажмите «Сохранить».</p>' : '') +
      (pro ? slugField(card.slug || '') : '') + pubField(card.is_published) +
      '<button type="button" class="btn ' + (dirty ? 'btn-grad' : 'btn-glass') + ' btn-block" id="psave">Сохранить в облаке</button>' +
      '<div class="pro-stats"><h4>Моя статистика</h4><div id="pstats">' + (pro ? statsHtml() : '<p class="muted">Статистика доступна с Про.</p>') + '</div></div>' +
      (card.lifetime ? '' : '<button type="button" class="btn btn-wa btn-block" data-pay="1"><svg><use href="#i-wa"/></svg>' + (pro ? 'Продлить Про' : 'Подключить Про') + ' · ' + PRICE + '</button>') +
      (card.pay_pending ? '<p class="pro-pend">Заявка на продление отправлена — Про продлим после проверки оплаты.</p>' : '') +
      refHtml() +
      '<details class="more"><summary>Ключ доступа и другие телефоны</summary><div class="f">' +
      '<p class="muted">Ключ — это пароль от облачной визитки. С ним визитку можно редактировать на другом телефоне. Никому его не пересылайте.</p>' +
      '<div class="linkrow"><input class="inp" readonly id="keyv" value="' + esc(C.key()) + '"><button class="btn btn-glass" type="button" id="kcopy" aria-label="Копировать ключ"><svg><use href="#i-link"/></svg></button></div>' +
      '<button type="button" class="btn btn-glass btn-sm" id="ksend"><svg><use href="#i-wa"/></svg>Сохранить себе в WhatsApp</button>' +
      '<button type="button" class="lnk" id="pdel">Удалить визитку из облака</button>' +
      '</div></details>';
    if (pro) { bindSlug(); checkSlug(); }
  }
  function render() {
    if (card) renderCard(); else renderNew();
  }

  function bindSlug() {
    var inp = document.getElementById('slug'); if (!inp) return;
    inp.addEventListener('input', function () {
      inp.value = inp.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
      clearTimeout(slugTimer); slugTimer = setTimeout(checkSlug, 350);
    });
  }
  function checkSlug() {
    var inp = document.getElementById('slug'), st = document.getElementById('slugst'); if (!inp || !st) return;
    var v = inp.value, c = C.slugCheck(v);
    var msg = { bad: 'Латиница, цифры и дефис, 3–20 символов', reserved: 'Этот адрес занят системой' };
    if (!v) { st.textContent = card ? 'Без короткого адреса' : ''; st.className = 'slugst'; return; }
    if (card && v === card.slug) { st.textContent = 'Ваш адрес ✓'; st.className = 'slugst ok'; return; }
    if (c !== 'ok') { st.textContent = msg[c]; st.className = 'slugst bad'; return; }
    st.textContent = 'Проверяем…'; st.className = 'slugst';
    C.rpc('vz_slug_free', { p_slug: v, p_key: C.key() }).then(function (r) {
      if (inp.value !== v) return;
      var m = { ok: ['Свободен ✓', 'ok'], mine: ['Ваш адрес ✓', 'ok'], taken: ['Уже занят — попробуйте другой', 'bad'], reserved: [msg.reserved, 'bad'], bad: [msg.bad, 'bad'] }[r] || ['', ''];
      st.textContent = m[0]; st.className = 'slugst ' + m[1];
    }, function () { st.textContent = ''; });
  }

  function loadStats() {
    if (!card || !card.pro) return;
    C.rpc('vz_my_stats', { p_key: C.key() }).then(function (s) { stats = s; var el = document.getElementById('pstats'); if (el) el.innerHTML = statsHtml(); }, function () {});
  }

  function syncPhoto() {
    var x = B.photo(), del = localStorage.getItem('vezu-photo-del');
    if (del && card.photo) return C.removePhoto().then(function () { card.photo = null; localStorage.removeItem('vezu-photo-del'); });
    localStorage.removeItem('vezu-photo-del');
    if (x && x.img && card.pro && x.up !== sig(x.img)) {
      return C.uploadPhoto(x.img).then(function (path) {
        card.photo = path; x.up = sig(x.img); x.p = card.d.p; localStorage.setItem('vezu-photo', JSON.stringify(x));
      });
    }
  }
  function save() {
    if (busy) return;
    var d = B.data();
    if (!d.n || !d.p) { V.toast('Сначала укажите имя и номер WhatsApp'); document.querySelector('[data-go="1"]').click(); return; }
    var inp = document.getElementById('slug'), slug = inp ? inp.value.trim() : null;
    if (slug && slug !== (card && card.slug) && C.slugCheck(slug) !== 'ok') { V.toast('Проверьте короткий адрес'); inp.focus(); return; }
    var pub = document.getElementById('pub');
    var first = !card, k = C.key() || C.newKey();
    busy = true; var btn = document.getElementById('psave'); btn.disabled = true; btn.textContent = 'Сохраняем…';
    C.rpc('vz_save_card', { p_key: k, p_data: d, p_slug: slug === null ? null : slug, p_veh: V.vehicle(d) || '', p_published: pub ? pub.checked : true,
      p_ref: first ? (C.ls('vezu-ref') || null) : null })
      .then(function (c) { card = c; C.ls('vezu-cloud-slug', c.slug || null); if (first) C.ls('vezu-ref', null); return syncPhoto(); })
      .then(function () {
        busy = false;
        B.setShort(card.slug ? C.shortUrl(card.slug) : '');
        render(); loadStats();
        V.toast(first ? 'Готово! Про включён на 7 дней' : 'Сохранено в облаке');
        if (first) keyHint();
      }, function (e) {
        busy = false; if (first && !card) C.forget();
        if (card) { B.setShort(card.slug ? C.shortUrl(card.slug) : ''); render(); }
        else { btn.disabled = false; btn.textContent = 'Сохранить в облаке и включить Про'; }
        V.toast(e.message);
      });
  }
  function keyHint() {
    V.sheet('Сохраните ключ доступа', '<p>Визитка теперь хранится в облаке ВЕЗУ. Редактировать её можно с этого телефона.</p>' +
      '<p><b>Ключ доступа</b> нужен, чтобы открыть визитку на другом телефоне или после очистки браузера. Сохраните его себе в WhatsApp или Избранное — внизу блока «ВЕЗУ Про».</p>' +
      '<p>Если ключ потеряется — напишите в поддержку ВЕЗУ, поможем.</p>');
  }
  function enterKey() {
    var s = V.sheet('Ключ доступа', '<p>Вставьте ключ, который вы сохранили при создании облачной визитки.</p>' +
      '<input class="inp" id="kin" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="ключ">' +
      '<button type="button" class="btn btn-grad btn-block" id="kgo">Открыть мою визитку</button><p class="err-msg" id="kerr" hidden></p>');
    s.el.querySelector('#kgo').addEventListener('click', function () {
      var v = s.el.querySelector('#kin').value.trim(), err = s.el.querySelector('#kerr');
      if (!/^[A-Za-z0-9_-]{32,64}$/.test(v)) { err.textContent = 'Ключ выглядит неправильно'; err.hidden = false; return; }
      C.rpc('vz_me', { p_key: v }).then(function (c) {
        if (!c) { err.textContent = 'Визитка с таким ключом не найдена'; err.hidden = false; return; }
        C.setKey(v); s.close(); adopt(c, true);
      }, function (e) { err.textContent = e.message; err.hidden = false; });
    });
  }
  // подхватить облачную визитку: заполнить форму (если пусто или явно попросили) и фото
  function adopt(c, force) {
    card = c; C.ls('vezu-cloud-slug', c.slug || null);
    if (force || !B.data().n) { try { localStorage.setItem('vezu-card', JSON.stringify(V.clean(c.d))); } catch (e) {} }
    var after = function () {
      if (force || !B.data().n) { location.replace('new.html?c=' + V.encodeSync(V.clean(c.d))); return; }
      B.setShort(c.slug ? C.shortUrl(c.slug) : ''); render(); loadStats();
    };
    var x = B.photo();
    if (c.photo && c.pro && (!x || !x.img) && !localStorage.getItem('vezu-photo-del')) {
      fetch(C.photoUrl(c.photo)).then(function (r) { return r.blob(); }).then(function (b) {
        return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.readAsDataURL(b); });
      }).then(function (img) { localStorage.setItem('vezu-photo', JSON.stringify({ p: c.d.p, img: img, up: sig(img) })); B.refresh(); }, function () {}).then(after);
    } else after();
  }

  box.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.id === 'psave') save();
    else if (t.id === 'haskey') enterKey();
    else if (t.id === 'scopy') V.copy(C.shortUrl(card.slug));
    else if (t.id === 'kcopy') V.copy(C.key());
    else if (t.id === 'ksend') V.openWA(card.d.p, 'Мой ключ ВЕЗУ (никому не пересылать). Открыть визитку на другом телефоне: ' + C.siteBase() + 'new.html#k=' + C.key());
    else if (t.dataset.pay) window.VEZU_PAY.open(card, function () { render(); });
    else if (t.id === 'sshare') V.share('Моя визитка — ' + card.d.n, 'Грузоперевозки: ' + card.d.n + '. Заказ в WhatsApp:', C.shortUrl(card.slug));
    else if (t.id === 'rcopy') V.copy(C.siteBase() + 'new.html?ref=' + card.ref_code);
    else if (t.id === 'rsend') V.openWA('', 'Сделай себе бесплатную визитку водителя на ВЕЗУ — клиенты пишут сразу в WhatsApp, есть QR и наклейка на машину: ' +
      C.siteBase() + 'new.html?ref=' + card.ref_code);
    else if (t.dataset.p) { period = t.dataset.p; document.getElementById('pstats').innerHTML = statsHtml(); }
    else if (t.id === 'pdel') {
      if (!confirm('Удалить визитку из облака? Короткий адрес, фото и статистика пропадут. Визитка-ссылка на этом телефоне останется.')) return;
      (card.photo ? C.removePhoto().catch(function () {}) : Promise.resolve()).then(function () { return C.rpc('vz_delete_card', { p_key: C.key() }); }).then(function () {
        card = null; stats = null; C.forget(); B.setShort('');
        var x = B.photo(); if (x) { delete x.up; localStorage.setItem('vezu-photo', JSON.stringify(x)); }
        render(); V.toast('Удалено из облака');
      }, function (e) { V.toast(e.message); });
    }
  });

  window.VEZU_PRO = {
    changed: function () {
      if (!card) return;
      var dirty = isDirty(), p = box.querySelector('.dirty'), b = document.getElementById('psave');
      if (!b) return;
      if (!!p !== dirty) { if (dirty) { var el = document.createElement('p'); el.className = 'dirty'; el.textContent = 'Есть изменения, которых ещё нет в облаке — нажмите «Сохранить».'; b.parentNode.insertBefore(el, b); } else p.remove(); }
      if (b) b.className = 'btn ' + (dirty ? 'btn-grad' : 'btn-glass') + ' btn-block';
    }
  };

  box.hidden = false;
  box.innerHTML = '<p class="muted">ВЕЗУ Про…</p>';
  C.ready().then(function (ok) {
    if (!ok) return renderSoon();
    if (!C.key()) return renderNew();
    // ?cab=1 — кабинет открыт из админки: подставить данные визитки из облака
    var cab = /[?&]cab=1\b/.test(location.search);
    return C.rpc('vz_me', { p_key: C.key() }).then(function (c) { if (c) adopt(c, cab); else renderNew(); }, function () { renderNew(); });
  });
})();
