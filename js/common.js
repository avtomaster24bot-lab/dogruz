/* ВЕЗУ — общие функции: кодирование визитки, языки, темы, WhatsApp, геолокация, QR, vCard, PWA */
(function () {
  'use strict';

  // Номер WhatsApp для заявок с главной страницы (только цифры).
  var SITE_PHONE = '77714105797';

  var SERVICES = ['Переезды', 'Стройматериалы', 'Мебель', 'Вывоз мусора', 'Грузчики', 'Бытовая техника', 'Межгород', 'Мелкий груз'];
  var CAPACITY = ['0,5 т', '1 т', '1,5 т', '2 т', '3 т'];
  var EXTRAS = ['ex_loaders', 'ex_tent', 'ex_straps'];        // биты 0–2
  var PAYMENTS = ['pay_cash', 'pay_kaspi', 'pay_card'];       // биты 3–5
  var THEMES = ['Аврора', 'Лагуна', 'Закат', 'Неон', 'Хром'];

  var DEMO = { n: 'Имя Водителя', p: '77000000000', c: 'Газель', w: '1,5 т', t: 'Алматы', s: '01234', m: 'Пример визитки — данные вымышленные',
    pr: '8000', pu: 0, hs: 8, he: 22, z: 'Весь город и пригороды', f: 1 | 4 | 8 | 16, x: 1 };

  // ---------- языки (на визитке: рус / қаз) ----------
  var I18N = {
    ru: {
      tag: 'Грузоперевозки до 3 т', demo: 'Пример', upto: 'до {0}', your_name: 'Ваше имя', driver: 'Водитель', ph_meta: 'Машина · до 1,5 т · Город',
      wa: 'Написать в WhatsApp', call: 'Позвонить', contact: 'В контакты', tg: 'Telegram',
      order: 'Быстрый заказ', order_sub: 'Заполните — сообщение уйдёт водителю в WhatsApp.', what: 'Что везём?', from: 'Откуда', to: 'Куда', price: 'Ваша цена',
      when_now: 'Сейчас', when_today: 'Сегодня', when_tomorrow: 'Завтра', when_week: 'На этой неделе', when_any: 'Договоримся',
      q_move: 'Переезд', q_build: 'Стройматериалы', q_furn: 'Мебель', q_trash: 'Вывоз мусора',
      send: 'Отправить заказ', qr_t: 'QR этой визитки', qr_s: 'Покажите клиенту — он наведёт камеру и откроет визитку.', share: 'Поделиться', copy: 'Копировать',
      made: 'Вы водитель? <b>Создайте такую визитку бесплатно →</b>', edit: 'Редактировать визитку', install: 'Установить на телефон',
      open_now: 'Сейчас работает', closed_now: 'Сейчас не работает', h24: 'Круглосуточно', from_h: 'с {0}',
      price_from: 'от {0}', per_trip: 'поездка', per_hour: 'час',
      zones: 'Районы', pay: 'Оплата', extras: 'Есть', ex_loaders: 'Грузчики', ex_tent: 'Тент', ex_straps: 'Ремни', pay_cash: 'Наличные', pay_kaspi: 'Kaspi перевод', pay_card: 'Безнал',
      svc: SERVICES,
      copied: 'Ссылка скопирована', num_copied: 'Номер скопирован: {0}', need_what: 'Укажите хотя бы, что и куда везём',
      geo_btn: 'Где я', geo_aria: 'Определить, где я', geo_busy: 'Ищу…', geo_ok: '📍 Точка сохранена — водитель получит ссылку на карту.', geo_map: 'На карте',
      geo_e1: 'Доступ к геопозиции запрещён. Разрешите его: нажмите на значок слева от адреса сайта (замок или «ⓘ») → «Разрешения» → «Геоданные» → «Разрешить» и снова нажмите «Где я». На iPhone: Настройки → Конфиденциальность → Службы геолокации → включите их и разрешите для Safari/браузера.',
      geo_e2: 'Не удалось определить, где вы. Включите геолокацию (GPS) на телефоне и попробуйте ещё раз — или впишите адрес вручную.',
      geo_e3: 'Телефон слишком долго искал вас. Попробуйте ещё раз (лучше у окна или на улице) — или впишите адрес вручную.',
      geo_e0: 'Этот браузер не умеет определять местоположение. Впишите адрес вручную.',
      wah_inapp: '<b>Если WhatsApp не открылся</b> — нажмите <b>⋮</b> (или «…») вверху и выберите «Открыть в браузере».',
      wah_plain: '<b>Если WhatsApp не открылся</b> — нажмите «Открыть WhatsApp» ещё раз или скопируйте номер.',
      wah_open: 'Открыть WhatsApp', wah_copy: 'Скопировать номер', wah_web: 'Через сайт WhatsApp', wah_aria: 'WhatsApp не открылся', close: 'Закрыть',
      ios_install: 'На iPhone: нажмите «Поделиться» внизу экрана → «На экран „Домой“».',
      nf_t: 'Визитка не найдена', nf_s: 'Похоже, ссылка обрезана или скопирована не полностью. Попросите водителя прислать её ещё раз.', nf_new: 'Создать свою визитку', nf_home: 'На главную',
      sub_card: 'визитка водителя', qr_aria: 'QR-код визитки', details: 'Подробнее', made_by: 'Сделано на ВЕЗУ — сделай свою визитку', wa_short: 'WhatsApp', qr: 'QR-код', save: 'В контакты', why_geo: 'Что это?'
    },
    kk: {
      tag: '3 т дейін жүк тасымалы', demo: 'Үлгі', upto: '{0} дейін', your_name: 'Атыңыз', driver: 'Жүргізуші', ph_meta: 'Көлік · 1,5 т дейін · Қала',
      wa: 'WhatsApp-қа жазу', call: 'Қоңырау шалу', contact: 'Контактілерге', tg: 'Telegram',
      order: 'Жылдам тапсырыс', order_sub: 'Толтырыңыз — хабарлама жүргізушіге WhatsApp арқылы жетеді.', what: 'Не тасимыз?', from: 'Қайдан', to: 'Қайда', price: 'Бағаңыз',
      when_now: 'Қазір', when_today: 'Бүгін', when_tomorrow: 'Ертең', when_week: 'Осы аптада', when_any: 'Келісеміз',
      q_move: 'Көшу', q_build: 'Құрылыс материалдары', q_furn: 'Жиһаз', q_trash: 'Қоқыс шығару',
      send: 'Тапсырыс жіберу', qr_t: 'Визитканың QR-коды', qr_s: 'Клиентке көрсетіңіз — ол камераны бағыттап, визитканы ашады.', share: 'Бөлісу', copy: 'Көшіру',
      made: 'Жүргізушісіз бе? <b>Осындай визитканы тегін жасаңыз →</b>', edit: 'Визитканы өзгерту', install: 'Телефонға орнату',
      open_now: 'Қазір жұмыс істейді', closed_now: 'Қазір жұмыс істемейді', h24: 'Тәулік бойы', from_h: '{0} бастап',
      price_from: '{0} бастап', per_trip: 'рейс', per_hour: 'сағат',
      zones: 'Аудандар', pay: 'Төлем', extras: 'Бар', ex_loaders: 'Жүк тиеушілер', ex_tent: 'Тент', ex_straps: 'Белдіктер', pay_cash: 'Қолма-қол', pay_kaspi: 'Kaspi аударым', pay_card: 'Қолма-қолсыз',
      svc: ['Көшу', 'Құрылыс материалдары', 'Жиһаз', 'Қоқыс шығару', 'Жүк тиеушілер', 'Тұрмыстық техника', 'Қалааралық', 'Ұсақ жүк'],
      copied: 'Сілтеме көшірілді', num_copied: 'Нөмір көшірілді: {0}', need_what: 'Кем дегенде не және қайда тасымалдайтынын жазыңыз',
      geo_btn: 'Орным', geo_aria: 'Орнымды анықтау', geo_busy: 'Іздеуде…', geo_ok: '📍 Нүкте сақталды — жүргізуші картаға сілтеме алады.', geo_map: 'Картада',
      geo_e1: 'Геолокацияға рұқсат жоқ. Сайт мекенжайының сол жағындағы белгішені (құлып немесе «ⓘ») басыңыз → «Рұқсаттар» → «Геодеректер» → «Рұқсат ету», содан кейін «Орным» батырмасын қайта басыңыз. iPhone-да: Параметрлер → Құпиялылық → Геолокация қызметтері → қосып, браузерге рұқсат беріңіз.',
      geo_e2: 'Орныңызды анықтау мүмкін болмады. Телефонда геолокацияны (GPS) қосып, қайталап көріңіз — немесе мекенжайды қолмен жазыңыз.',
      geo_e3: 'Телефон орныңызды тым ұзақ іздеді. Қайталап көріңіз (терезе жанында не далада) — немесе мекенжайды қолмен жазыңыз.',
      geo_e0: 'Бұл браузер орынды анықтай алмайды. Мекенжайды қолмен жазыңыз.',
      wah_inapp: '<b>WhatsApp ашылмаса</b> — жоғарыдағы <b>⋮</b> (немесе «…») басып, «Браузерде ашу» таңдаңыз.',
      wah_plain: '<b>WhatsApp ашылмаса</b> — «WhatsApp ашу» батырмасын қайта басыңыз немесе нөмірді көшіріңіз.',
      wah_open: 'WhatsApp ашу', wah_copy: 'Нөмірді көшіру', wah_web: 'WhatsApp сайты арқылы', wah_aria: 'WhatsApp ашылмады', close: 'Жабу',
      ios_install: 'iPhone-да: төмендегі «Бөлісу» батырмасын басыңыз → «Басты экранға».',
      nf_t: 'Визитка табылмады', nf_s: 'Сілтеме толық көшірілмеген сияқты. Жүргізушіден оны қайта жіберуін сұраңыз.', nf_new: 'Өз визиткаңызды жасау', nf_home: 'Басты бет',
      sub_card: 'жүргізуші визиткасы', qr_aria: 'Визитканың QR-коды', details: 'Толығырақ', made_by: 'ВЕЗУ-да жасалған — өз визиткаңды жаса', wa_short: 'WhatsApp', qr: 'QR-код', save: 'Контактілерге', why_geo: 'Бұл не?'
    }
  };
  var lang = 'ru';
  function t(key) {
    var s = (I18N[lang] && I18N[lang][key] != null) ? I18N[lang][key] : (I18N.ru[key] != null ? I18N.ru[key] : key);
    for (var i = 1; i < arguments.length; i++) s = String(s).replace('{' + (i - 1) + '}', arguments[i]);
    return s;
  }
  function setLang(l, persist) {
    lang = I18N[l] ? l : 'ru';
    document.documentElement.lang = lang === 'kk' ? 'kk' : 'ru';
    if (persist) try { localStorage.setItem('vezu-lang', lang); } catch (e) {}
    applyI18n(document);
  }
  function savedLang() {
    try { var l = localStorage.getItem('vezu-lang'); if (l) return l; } catch (e) {}
    return /^kk/i.test(navigator.language || '') ? 'kk' : 'ru';
  }
  function applyI18n(root) {
    root.querySelectorAll('[data-i18n]').forEach(function (el) { el.innerHTML = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.dataset.i18nPh); });
    root.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    root.querySelectorAll('.geo-btn:not(.busy) span').forEach(function (el) { el.textContent = t('geo_btn'); });
    root.querySelectorAll('.geo-btn').forEach(function (el) { el.setAttribute('aria-label', t('geo_aria')); });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- кодирование визитки ----------
  function b64urlFromBytes(bytes) {
    var bin = ''; for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function bytesFromB64url(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var bin = atob(s), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  // v1 (старые ссылки ?d=…): base64url(JSON)
  function decodeLegacy(code) {
    try { return clean(JSON.parse(new TextDecoder().decode(bytesFromB64url(code)))); } catch (e) { return null; }
  }

  function clean(d) {
    d = d || {};
    var out = {};
    ['n', 'c', 't', 'm', 'z', 'i'].forEach(function (k) { if (d[k]) out[k] = String(d[k]).replace(/\s+/g, ' ').trim().slice(0, k === 'i' ? 300 : 80); });
    if (out.i && !/^https:\/\/[^\s"'<>]+$/i.test(out.i)) delete out.i;
    var p = normPhone(d.p); if (p) out.p = p;
    if (d.w && CAPACITY.indexOf(d.w) >= 0) out.w = d.w;
    if (d.s) { var s = ''; String(d.s).replace(/[^0-7]/g, '').split('').sort().forEach(function (c) { if (s.indexOf(c) < 0) s += c; }); if (s) out.s = s; }
    var pr = String(d.pr || '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
    if (pr) { out.pr = pr; out.pu = +d.pu === 1 ? 1 : 0; }
    var hs = parseInt(d.hs, 10), he = parseInt(d.he, 10);
    if (hs >= 0 && hs <= 24 && he >= 0 && he <= 24 && hs !== he) { out.hs = hs; out.he = he; }
    var tg = String(d.tg || '').trim().replace(/^(https?:\/\/)?(t\.me\/|telegram\.me\/)?@?/i, '');
    if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(tg)) out.tg = tg;
    var f = parseInt(d.f, 10) & 127; if (f) out.f = f;
    var th = parseInt(d.th, 10); if (th > 0 && th < THEMES.length) out.th = th;
    if (d.x) out.x = 1;
    return out;
  }

  // v2: компактный бинарный формат + однобайтовая кириллица (+ deflate, если короче)
  var CY = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя';
  var EX = 'ЁёӘәҒғҚқҢңӨөҰұҮүҺһІі₸«»—–№…';
  function txt(s) {
    var o = [];
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], c = s.charCodeAt(i), k;
      if (c < 128) o.push(c);
      else if ((k = CY.indexOf(ch)) >= 0) o.push(0x80 + k);
      else if ((k = EX.indexOf(ch)) >= 0) o.push(0xC0 + k);
      else o.push(0xFF, c >> 8, c & 255);
    }
    return o;
  }
  function untxt(b) {
    var s = '';
    for (var i = 0; i < b.length; i++) {
      var c = b[i];
      if (c < 128) s += String.fromCharCode(c);
      else if (c < 0xC0) s += CY[c - 0x80];
      else if (c === 0xFF) { s += String.fromCharCode((b[i + 1] << 8) | b[i + 2]); i += 2; }
      else s += EX[c - 0xC0] || '';
    }
    return s;
  }
  function W() { this.b = []; }
  W.prototype.u = function (n) { do { var x = n % 128; n = Math.floor(n / 128); this.b.push(n ? x | 128 : x); } while (n); };
  W.prototype.s = function (str) { var t = txt(str); this.u(t.length); for (var i = 0; i < t.length; i++) this.b.push(t[i]); };
  function R(b, p) { this.b = b; this.p = p || 0; }
  R.prototype.byte = function () { if (this.p >= this.b.length) throw new Error('eof'); return this.b[this.p++]; };
  R.prototype.u = function () { var n = 0, m = 1, x; do { x = this.byte(); n += (x & 127) * m; m *= 128; } while (x & 128); return n; };
  R.prototype.s = function () { var l = this.u(); if (this.p + l > this.b.length) throw new Error('eof'); var v = untxt(this.b.slice(this.p, this.p + l)); this.p += l; return v; };

  function pack(d) {
    var w = new W(), mask = 0, body = new W();
    if (d.p) { mask |= 1; var n = +d.p.slice(1); for (var i = 4; i >= 0; i--) body.b.push(Math.floor(n / Math.pow(256, i)) % 256); }
    if (d.n) { mask |= 2; body.s(d.n); }
    if (d.c) { mask |= 4; body.s(d.c); }
    if (d.w) { mask |= 8; body.b.push(CAPACITY.indexOf(d.w)); }
    if (d.t) { mask |= 16; body.s(d.t); }
    if (d.s) { mask |= 32; var sm = 0; d.s.split('').forEach(function (c) { sm |= 1 << +c; }); body.b.push(sm); }
    if (d.m) { mask |= 64; body.s(d.m); }
    if (d.i) { mask |= 128; body.s(d.i.replace(/^https:\/\//i, '')); }
    if (d.pr) { mask |= 256; body.u(+d.pr); body.b.push(d.pu ? 1 : 0); }
    if (d.hs != null) { mask |= 512; body.b.push(d.hs, d.he); }
    if (d.tg) { mask |= 1024; body.s(d.tg); }
    if (d.z) { mask |= 2048; body.s(d.z); }
    if (d.f) { mask |= 4096; body.b.push(d.f); }
    if (d.th) { mask |= 8192; body.b.push(d.th); }
    if (d.x) mask |= 16384;
    w.u(mask); return w.b.concat(body.b);
  }
  function unpack(b) {
    var r = new R(b), mask = r.u(), d = {};
    if (mask & 1) { var n = 0; for (var i = 0; i < 5; i++) n = n * 256 + r.byte(); d.p = '7' + ('0000000000' + n).slice(-10); }
    if (mask & 2) d.n = r.s();
    if (mask & 4) d.c = r.s();
    if (mask & 8) d.w = CAPACITY[r.byte()];
    if (mask & 16) d.t = r.s();
    if (mask & 32) { var sm = r.byte(), s = ''; for (var k = 0; k < 8; k++) if (sm & (1 << k)) s += k; d.s = s; }
    if (mask & 64) d.m = r.s();
    if (mask & 128) d.i = 'https://' + r.s();
    if (mask & 256) { d.pr = String(r.u()); d.pu = r.byte(); }
    if (mask & 512) { d.hs = r.byte(); d.he = r.byte(); }
    if (mask & 1024) d.tg = r.s();
    if (mask & 2048) d.z = r.s();
    if (mask & 4096) d.f = r.byte();
    if (mask & 8192) d.th = r.byte();
    if (mask & 16384) d.x = 1;
    return d;
  }
  function encodeSync(d) { return b64urlFromBytes([2].concat(pack(clean(d)))); }
  function encode(d) {
    var raw = pack(clean(d)), plain = b64urlFromBytes([2].concat(raw));
    if (!window.CompressionStream) return Promise.resolve(plain);
    try {
      var cs = new CompressionStream('deflate-raw'), wr = cs.writable.getWriter();
      wr.write(new Uint8Array(raw)); wr.close();
      return new Response(cs.readable).arrayBuffer().then(function (buf) {
        var hd = new W(); hd.b.push(3); hd.u(raw.length);
        var z = b64urlFromBytes(hd.b.concat(Array.prototype.slice.call(new Uint8Array(buf))));
        return z.length < plain.length ? z : plain;
      }, function () { return plain; });
    } catch (e) { return Promise.resolve(plain); }
  }
  function decode(code) {
    try {
      var b = bytesFromB64url(code);
      if (b[0] === 2) return clean(unpack(b.slice(1)));
      if (b[0] === 3) {
        var r = new R(b, 1), len = r.u(), out = new Uint8Array(len);
        window.tinyInflate(b.slice(r.p), out);
        return clean(unpack(out));
      }
    } catch (e) {}
    return null;
  }
  // Данные визитки из адреса страницы: ?demo, ?c=… (новый формат) или ?d=… (старые ссылки)
  function readCard(search) {
    var q = new URLSearchParams(search == null ? location.search : search);
    if (q.has('demo')) return Object.assign({}, DEMO);
    if (q.get('c')) return decode(q.get('c'));
    if (q.get('d')) return decodeLegacy(q.get('d'));
    return null;
  }

  function baseUrl() { return location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, ''); }
  function cardUrl(d) { return d && d.x ? baseUrl() + 'card.html?demo' : baseUrl() + 'card.html?c=' + encodeSync(d); }
  function cardUrlAsync(d) {
    if (d && d.x) return Promise.resolve(baseUrl() + 'card.html?demo');
    return encode(d).then(function (c) { return baseUrl() + 'card.html?c=' + c; });
  }
  function editUrl(d) {
    if (d && d.x) { var x = Object.assign({}, d); delete x.x; return encode(x).then(function (c) { return baseUrl() + 'new.html?c=' + c; }); }
    return encode(d).then(function (c) { return baseUrl() + 'new.html?c=' + c; });
  }

  function normPhone(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
    if (d.length === 10) d = '7' + d;
    return /^7\d{10}$/.test(d) ? d : '';
  }
  function fmtPhone(d) {
    d = normPhone(d); if (!d) return '';
    return '+7 ' + d.slice(1, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7, 9) + ' ' + d.slice(9, 11);
  }
  function waLink(phone, text) {
    var p = normPhone(phone);
    return 'https://wa.me/' + p + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  // ---------- WhatsApp: открываем приложение напрямую на мобильных (в т.ч. из Telegram/Instagram) ----------
  var UA = navigator.userAgent || '';
  var IS_ANDROID = /Android/i.test(UA);
  var IS_IOS = /iPhone|iPad|iPod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var IS_MOBILE = IS_ANDROID || IS_IOS;
  function inAppBrowser() {
    return !!(window.TelegramWebviewProxy || window.TelegramWebview || window.TelegramWebviewProxyProto ||
      /Telegram|FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|MicroMessenger|VKClient|OKApp|; wv\)/i.test(UA));
  }
  function waQuery(phone, text) {
    var p = normPhone(phone), q = [];
    if (p) q.push('phone=' + p);
    if (text) q.push('text=' + encodeURIComponent(text));
    return q.join('&');
  }
  function waApp(phone, text) { return 'whatsapp://send?' + waQuery(phone, text); }
  function waApi(phone, text) { return 'https://api.whatsapp.com/send?' + waQuery(phone, text); }
  function waIntent(phone, text) {
    return 'intent://send?' + waQuery(phone, text) + '#Intent;scheme=whatsapp;S.browser_fallback_url=' + encodeURIComponent(waApi(phone, text)) + ';end';
  }
  function waHref(phone, text) {
    if (IS_ANDROID) return waIntent(phone, text);
    if (IS_IOS) return waApp(phone, text);
    return waLink(phone, text);
  }
  function nav(u) { VEZU._nav(u); }
  var waTimer = null;
  // Вызывать только из обработчика нажатия (жест пользователя)
  function openWA(phone, text) {
    if (!IS_MOBILE) { window.open(waLink(phone, text), '_blank', 'noopener'); return; }
    hideWaHint();
    var left = false, mark = function () { left = true; };
    document.addEventListener('visibilitychange', function h() { if (document.hidden) mark(); document.removeEventListener('visibilitychange', h); });
    window.addEventListener('pagehide', mark, { once: true });
    window.addEventListener('blur', mark, { once: true });
    nav(waHref(phone, text));
    clearTimeout(waTimer);
    waTimer = setTimeout(function () {
      if (left || document.hidden) return;
      if (inAppBrowser() || IS_ANDROID) showWaHint(phone, text);
      else nav(waApi(phone, text));
    }, IS_ANDROID ? 1800 : 2000);
  }
  function hideWaHint() { var h = document.querySelector('.wa-hint'); if (h) h.remove(); }
  function showWaHint(phone, text) {
    hideWaHint();
    var p = normPhone(phone);
    var h = document.createElement('div'); h.className = 'wa-hint'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-label', t('wah_aria'));
    h.innerHTML = '<button type="button" class="wa-x" aria-label="' + esc(t('close')) + '">×</button>' +
      '<p>' + (inAppBrowser() ? t('wah_inapp') : t('wah_plain')) + '</p>' +
      '<div class="wa-hint-btns">' +
      '<a class="btn btn-wa btn-sm" data-act="retry" href="' + esc(waApp(phone, text)) + '">' + esc(t('wah_open')) + '</a>' +
      (p ? '<button type="button" class="btn btn-glass btn-sm" data-act="copy">' + esc(t('wah_copy')) + '</button>' : '') +
      '<a class="btn btn-glass btn-sm" data-act="web" href="' + esc(waApi(phone, text)) + '">' + esc(t('wah_web')) + '</a>' +
      '</div>';
    document.body.appendChild(h);
    h.querySelector('.wa-x').addEventListener('click', hideWaHint);
    var cp = h.querySelector('[data-act=copy]');
    if (cp) cp.addEventListener('click', function () { copy('+' + p, t('num_copied', fmtPhone(p))); });
    h.querySelector('[data-act=retry]').addEventListener('click', function (e) { e.preventDefault(); nav(waApp(phone, text)); });
  }
  // Привязать <a> к WhatsApp: рабочий href + открытие приложения по нажатию
  function bindWaLink(a, phone, text) {
    a.href = waHref(phone, text);
    if (IS_MOBILE) a.removeAttribute('target');
    a.addEventListener('click', function (e) { if (IS_MOBILE) { e.preventDefault(); openWA(phone, text); } });
  }

  function fmtNum(v) { var n = String(v || '').replace(/\D/g, ''); return n ? Number(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ') : ''; }
  function fmtPrice(v) { var n = fmtNum(v); return n ? n + ' ₸' : ''; }

  function orderText(o, toName) {
    var lines = [toName ? 'Здравствуйте, ' + String(toName).split(' ')[0] + '! Нужна перевозка.' : 'Здравствуйте! Нужна грузоперевозка.'];
    if (o.from) lines.push('Откуда: ' + o.from);
    if (o.geo) {
      lines.push('Точка на карте (2ГИС): ' + gisLink(o.geo));
      lines.push('Google Maps: ' + gmapsLink(o.geo));
    }
    if (o.to) lines.push('Куда: ' + o.to);
    if (o.what) lines.push('Что везём: ' + o.what);
    if (o.when) lines.push('Когда: ' + o.when);
    if (o.price) lines.push('Моя цена: ' + fmtPrice(o.price));
    return lines.join('\n');
  }

  function gisLink(g) { return 'https://2gis.kz/geo/' + g.lon.toFixed(6) + ',' + g.lat.toFixed(6); }
  function gmapsLink(g) { return 'https://maps.google.com/?q=' + g.lat.toFixed(6) + ',' + g.lon.toFixed(6); }

  // ---------- геолокация: «Где я» → координаты → короткий адрес (Nominatim) ----------
  function shortAddress(j) {
    var a = (j && j.address) || {};
    var street = a.road || a.pedestrian || a.footway || a.residential || '';
    var place = street ? street + (a.house_number ? ', ' + a.house_number : '') : (a.neighbourhood || a.suburb || a.quarter || a.hamlet || a.village || '');
    var city = a.city || a.town || a.village || a.county || a.state || '';
    var r = [place, city !== place ? city : ''].filter(Boolean).join(', ');
    if (!r && j && j.display_name) r = j.display_name.split(',').slice(0, 3).join(',').trim();
    return r;
  }
  function reverseGeocode(lat, lon) {
    var ctl = window.AbortController ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctl) ctl.abort(); }, 7000);
    return fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ru&zoom=18&addressdetails=1&lat=' + lat + '&lon=' + lon, ctl ? { signal: ctl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(tm); return shortAddress(j); });
  }
  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9.5" r="2.6" fill="currentColor"/></svg>';
  function bindGeo(form) {
    var from = form.querySelector('[name=from]'); if (!from) return;
    var label = from.closest('label');
    label.classList.add('has-geo');
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'geo-btn'; btn.setAttribute('aria-label', t('geo_aria'));
    btn.innerHTML = PIN + '<span>' + esc(t('geo_btn')) + '</span>';
    label.appendChild(btn);
    var msg = document.createElement('div'); msg.className = 'geo-msg'; msg.setAttribute('aria-live', 'polite'); msg.hidden = true;
    var route = form.querySelector('.route') || label;
    route.parentNode.insertBefore(msg, route.nextSibling);
    function show(html, err) { msg.innerHTML = html; msg.hidden = !html; msg.classList.toggle('geo-err', !!err); }
    function showMap() {
      var g = form._geo;
      show(g ? '<span>' + esc(t('geo_ok')) + '</span> <a href="' + esc(gisLink(g)) + '" target="_blank" rel="noopener">' + esc(t('geo_map')) + '</a>' : '');
    }
    from.addEventListener('input', function () {
      if (form._geo && !from.value.trim()) { form._geo = null; show(''); }
    });
    btn.addEventListener('click', function () {
      if (!navigator.geolocation) { show(esc(t('geo_e0')), true); return; }
      btn.classList.add('busy'); btn.disabled = true; btn.querySelector('span').textContent = t('geo_busy');
      show('');
      var done = function () { btn.classList.remove('busy'); btn.disabled = false; btn.querySelector('span').textContent = t('geo_btn'); };
      navigator.geolocation.getCurrentPosition(function (pos) {
        var g = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        var coords = g.lat.toFixed(5) + ', ' + g.lon.toFixed(5);
        reverseGeocode(g.lat, g.lon).then(function (addr) { return addr || coords; }, function () { return coords; }).then(function (addr) {
          from.value = addr; form._geo = g; done(); showMap();
          from.dispatchEvent(new Event('change'));
        });
      }, function (e) {
        var c = e && e.code;
        done(); show(esc(t(c === 1 ? 'geo_e1' : c === 3 ? 'geo_e3' : 'geo_e2')), true);
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    });
  }

  // ---------- визитка ----------
  function services(d) {
    var names = t('svc');
    return String(d.s || '').split('').map(function (i) { return names[+i]; }).filter(Boolean);
  }
  function servicesRu(d) { return String(d.s || '').split('').map(function (i) { return SERVICES[+i]; }).filter(Boolean); }
  function initials(name) {
    var w = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
  }
  function metaLine(d) {
    return [d.c, d.w ? t('upto', d.w) : '', d.t].filter(Boolean).join(' · ');
  }
  function hh(h) { return ('0' + h).slice(-2) + ':00'; }
  function is24(d) { return d.hs === 0 && d.he === 24; }
  function hoursText(d) { return d.hs == null ? '' : is24(d) ? t('h24') : hh(d.hs) + '–' + hh(d.he); }
  // Казахстан — единый часовой пояс UTC+5 (с 2024 г.)
  function almatyHour(now) { var x = new Date((now || Date.now()) + 5 * 3600 * 1000); return x.getUTCHours() + x.getUTCMinutes() / 60; }
  function isOpen(d, now) {
    if (d.hs == null) return null;
    if (is24(d)) return true;
    var h = almatyHour(now);
    return d.hs < d.he ? (h >= d.hs && h < d.he) : (h >= d.hs || h < d.he);
  }
  function priceText(d) { return d.pr ? t('price_from', fmtPrice(d.pr)) + ' / ' + t(d.pu ? 'per_hour' : 'per_trip') : ''; }
  function flagList(d, keys, shift) { var o = []; keys.forEach(function (k, i) { if ((d.f || 0) & (1 << (i + shift))) o.push(t(k)); }); return o; }

  function cardHero(d, placeholder, opts) {
    opts = opts || {};
    var name = d.n || (placeholder ? t('your_name') : t('driver'));
    var meta = metaLine(d) || (placeholder ? t('ph_meta') : '');
    var open = isOpen(d), ph = photoSrc(d, opts.local);
    var pills = '';
    if (open !== null) pills += '<span class="pill ' + (open ? 'on' : 'off') + '"><i></i>' + esc(open ? (is24(d) ? t('h24') : t('open_now')) : t('closed_now')) +
      (is24(d) ? '' : ' · ' + esc(open ? hoursText(d) : t('from_h', hh(d.hs)))) + '</span>';
    if (d.pr) pills += '<span class="pill price">' + esc(priceText(d)) + '</span>';
    return '<div class="hero-card">' +
      '<div class="hc-media"><img class="veh" src="' + vehicleImg(d) + '" alt="" width="520" height="319" decoding="async">' +
      '<span class="hc-tag">' + esc(t('tag')) + '</span>' + (d.x ? '<span class="hc-demo">' + esc(t('demo')) + '</span>' : '') +
      '<div class="av"><span>' + esc(initials(name)) + '</span>' +
      (ph ? '<img src="' + esc(ph) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '</div></div>' +
      '<h1 class="hc-name">' + esc(name) + '</h1>' +
      (meta ? '<p class="hc-meta">' + esc(meta) + '</p>' : '') +
      (pills ? '<div class="pills">' + pills + '</div>' : '') +
      '</div>';
  }
  // Подробности под первым экраном: услуги, районы, «есть», оплата, заметка
  function cardDetails(d) {
    var sv = services(d), ex = flagList(d, EXTRAS, 0), pay = flagList(d, PAYMENTS, 3), facts = '';
    var ticks = function (a) { return a.map(function (x) { return '<span class="tick">' + esc(x) + '</span>'; }).join(''); };
    if (d.z) facts += '<div class="fact"><dt>' + esc(t('zones')) + '</dt><dd>' + esc(d.z) + '</dd></div>';
    if (ex.length) facts += '<div class="fact"><dt>' + esc(t('extras')) + '</dt><dd>' + ticks(ex) + '</dd></div>';
    if (pay.length) facts += '<div class="fact"><dt>' + esc(t('pay')) + '</dt><dd>' + ticks(pay) + '</dd></div>';
    if (!sv.length && !facts && !d.m) return '';
    return (sv.length ? '<ul class="chips">' + sv.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      (d.m ? '<p class="hc-note">' + esc(d.m) + '</p>' : '') +
      (facts ? '<dl class="facts">' + facts + '</dl>' : '');
  }
  function applyTheme(el, th) {
    for (var i = 0; i < THEMES.length; i++) el.classList.remove('th-' + i);
    el.classList.add('th-' + (th || 0));
  }

  // ---------- машина и фото ----------
  var VEHICLES = [
    { k: 'kabluk', l: 'Каблук', c: 'Каблук', w: '0,5 т' },
    { k: 'gazel', l: 'Газель', c: 'Газель', w: '1,5 т' },
    { k: 'gazel-long', l: 'Газель длинная', c: 'Газель удлинённая', w: '2 т' },
    { k: 'truck3', l: 'Грузовик 3 т', c: 'Грузовик', w: '3 т' }
  ];
  function vehicle(d) {
    var c = String(d.c || '').toLowerCase();
    if (/каблук|ларгус|largus|caddy|партн[её]р|berlingo|kangoo|doblo|citan/.test(c)) return 'kabluk';
    if (/удлин|длинн|long|фермер/.test(c)) return 'gazel-long';
    if (/грузовик|бычок|isuzu|исузу|hino|валдай|зил|камаз|foton|jac|hd ?\d|3 ?т/.test(c)) return 'truck3';
    if (d.w === '0,5 т') return 'kabluk';
    if (d.w === '3 т') return 'truck3';
    if (d.w === '2 т') return 'gazel-long';
    return 'gazel';
  }
  function vehicleImg(d) { return 'img/v-' + vehicle(d) + '.webp'; }
  var TG_PHOTO = 64;
  // Фото с телефона хранится только на этом устройстве и показывается на визитке с тем же номером
  function localPhoto(d, any) {
    try { var x = JSON.parse(localStorage.getItem('vezu-photo') || 'null'); if (x && x.img && (any || (d && d.p && x.p === d.p))) return x.img; } catch (e) {}
    return '';
  }
  function photoSrc(d, anyLocal) {
    return localPhoto(d, anyLocal) || d.i || ((d.f & TG_PHOTO) && d.tg ? 'https://t.me/i/userpic/320/' + d.tg + '.jpg' : '');
  }
  // Сжать фото с телефона до маленького квадрата (для хранения на устройстве)
  function resizePhoto(file, size) {
    size = size || 128;
    return new Promise(function (ok, fail) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(img.naturalWidth, img.naturalHeight), cv = document.createElement('canvas');
        cv.width = cv.height = size;
        var g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
        g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        var out = cv.toDataURL('image/webp', 0.7);
        if (out.indexOf('data:image/webp') !== 0) out = cv.toDataURL('image/jpeg', 0.72);
        ok(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('bad image')); };
      img.src = url;
    });
  }

  // ---------- всплывающие окна (bottom-sheet) ----------
  var INFO = {
    ru: {
      why: ['Почему это удобнее бумажной визитки', '<ul class="why"><li><b>Не теряется.</b> Ссылка остаётся в WhatsApp и Telegram клиента.</li><li><b>Один клик до WhatsApp.</b> Не нужно переписывать номер.</li><li><b>Адрес и точка на карте приходят сами.</b> Меньше звонков «а где вы?».</li><li><b>Как приложение.</b> Можно установить на телефон — открывается даже без интернета.</li><li><b>Без комиссий.</b> Клиент пишет вам напрямую, без агрегатора.</li></ul>'],
      qr: ['Зачем QR-код', '<p>Клиент наводит камеру телефона на QR — и сразу открывается ваша визитка. Не нужно диктовать номер.</p><p>Распечатайте QR на визитках или на наклейке для машины — его увидят на парковке, у магазина, в пробке.</p>'],
      geo: ['Что такое «Где я»', '<p>Кнопка определяет, где сейчас клиент, и подставляет адрес в поле «Откуда».</p><p>В сообщение водителю добавляется ссылка на точку в 2ГИС и Google Maps — сразу видно, куда ехать.</p><p>Телефон спросит разрешение. Место отправляется только в этом сообщении.</p>'],
      install: ['Зачем установить на телефон', '<p>Визитка появится иконкой на главном экране, как приложение. Открывается за секунду и работает даже без интернета — удобно быстро показать QR клиенту.</p><p><b>Android:</b> кнопка «Установить». <b>iPhone:</b> «Поделиться» → «На экран „Домой“».</p>'],
      pricefrom: ['Что значит «цена от»', '<p>Это ваша минимальная цена — за поездку или за час. Клиент сразу понимает порядок цен.</p><p>Точную сумму вы обсуждаете в WhatsApp: она зависит от расстояния, этажа и грузчиков. Клиент может предложить свою цену прямо в заказе.</p>'],
      photo: ['Как работает фото', '<p><b>Бесплатно:</b> фото с телефона хранится только на этом устройстве — вы видите его на своей визитке и на печатных визитках. В ссылку фото не помещается.</p><p><b>С ВЕЗУ Про</b> (7 дней бесплатно) фото загружается в облако ВЕЗУ и его видят все клиенты — включается на шаге 3, «Сохранить в облаке».</p><p>Ещё варианты: «Фото из Telegram» (аватар открытого профиля) или ссылка на фото из интернета.</p><p>Если фото нет — на визитке показывается картинка вашей машины.</p>']
    },
    kk: {
      why: ['Неге бұл қағаз визиткадан ыңғайлы', '<ul class="why"><li><b>Жоғалмайды.</b> Сілтеме клиенттің WhatsApp пен Telegram-ында қалады.</li><li><b>WhatsApp-қа бір басу.</b> Нөмірді қайта жазудың қажеті жоқ.</li><li><b>Мекенжай мен картадағы нүкте өзі келеді.</b></li><li><b>Қосымша сияқты.</b> Телефонға орнатуға болады — интернетсіз де ашылады.</li><li><b>Комиссиясыз.</b> Клиент сізге тікелей жазады.</li></ul>'],
      qr: ['QR-код не үшін', '<p>Клиент телефон камерасын QR-ға бағыттайды — визиткаңыз бірден ашылады. Нөмірді айтып тұрудың қажеті жоқ.</p><p>QR-ды визиткаға немесе көліктегі жапсырмаға басып шығарыңыз.</p>'],
      geo: ['«Орным» деген не', '<p>Батырма клиенттің қазір қай жерде екенін анықтап, «Қайдан» жолына мекенжайды қояды.</p><p>Жүргізушіге хабарламада 2ГИС және Google Maps сілтемесі барады — қайда бару керегі бірден көрінеді.</p><p>Телефон рұқсат сұрайды. Орын тек осы хабарламада жіберіледі.</p>'],
      install: ['Телефонға не үшін орнату', '<p>Визитка басты экранда қосымша сияқты белгіше болып тұрады. Бір секундта ашылады және интернетсіз де жұмыс істейді.</p><p><b>Android:</b> «Орнату» батырмасы. <b>iPhone:</b> «Бөлісу» → «Басты экранға».</p>'],
      pricefrom: ['«Бастап» баға деген не', '<p>Бұл ең төменгі баға — бір рейс немесе бір сағат үшін.</p><p>Нақты соманы WhatsApp-та келісесіз: қашықтыққа, қабатқа және жүк тиеушілерге байланысты. Клиент тапсырыста өз бағасын ұсына алады.</p>']
    }
  };
  var openSheet = null;
  function sheet(title, html, cls) {
    if (openSheet) openSheet();
    var prev = document.activeElement;
    var bg = document.createElement('div'); bg.className = 'sheet-bg';
    var el = document.createElement('div'); el.className = 'sheet' + (cls ? ' ' + cls : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="sheet-grab" aria-hidden="true"></div><button type="button" class="sheet-x" aria-label="' + esc(t('close')) + '">×</button>' +
      (title ? '<h2 class="sheet-t">' + esc(title) + '</h2>' : '') + '<div class="sheet-b">' + html + '</div>';
    if (title) el.setAttribute('aria-label', title);
    bg.appendChild(el); document.body.appendChild(bg);
    document.body.classList.add('noscroll');
    requestAnimationFrame(function () { bg.classList.add('in'); });
    function close() {
      if (openSheet !== close) return;
      openSheet = null; document.removeEventListener('keydown', key);
      document.body.classList.remove('noscroll');
      bg.classList.remove('in'); setTimeout(function () { bg.remove(); }, 220);
      if (prev && prev.focus) try { prev.focus({ preventScroll: true }); } catch (e) {}
    }
    function key(e) { if (e.key === 'Escape') close(); }
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    el.querySelector('.sheet-x').addEventListener('click', close);
    document.addEventListener('keydown', key);
    openSheet = close;
    setTimeout(function () { el.querySelector('.sheet-x').focus({ preventScroll: true }); }, 30);
    return { el: el, close: close };
  }
  function info(key) {
    var x = (INFO[lang] && INFO[lang][key]) || INFO.ru[key]; if (!x) return;
    return sheet(x[0], x[1], 'sheet-info');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-info]');
    if (b) { e.preventDefault(); info(b.dataset.info); }
  });

  // ---------- QR ----------
  function makeQR(text) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    var q = qrcode(0, 'L'); q.addData(text, 'Byte'); q.make(); return q;
  }
  function qrSvg(text, fg, bg) {
    var q = makeQR(text), n = q.getModuleCount(), m = 2, path = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) path += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    var s = n + m * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '" shape-rendering="crispEdges" role="img" aria-label="' + esc(t('qr_aria')) + '">' +
      '<rect width="' + s + '" height="' + s + '" fill="' + (bg || '#fff') + '"/><path d="' + path + '" fill="' + (fg || '#0b0b1f') + '"/></svg>';
  }
  function qrPng(text, caption, sub) {
    var q = makeQR(text), n = q.getModuleCount(), quiet = 4, cell = Math.max(8, Math.floor(880 / (n + quiet * 2)));
    var qs = (n + quiet * 2) * cell, capH = caption ? 170 : 0;
    var cv = document.createElement('canvas'); cv.width = qs; cv.height = qs + capH;
    var g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#0b0b1f';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    if (caption) {
      g.textAlign = 'center';
      g.font = '800 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      g.fillText(caption, qs / 2, qs + 40);
      if (sub) { g.fillStyle = '#5a5a7a'; g.font = '500 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'; g.fillText(sub, qs / 2, qs + 100); }
    }
    return cv.toDataURL('image/png');
  }

  // ---------- vCard ----------
  function vcf(d, url) {
    var e = function (s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); };
    var L = ['BEGIN:VCARD', 'VERSION:3.0', 'N:;' + e(d.n) + ';;;', 'FN:' + e(d.n),
      'ORG:' + e('Грузоперевозки' + (d.c ? ' — ' + d.c : '')),
      'TITLE:' + e([d.c, d.w ? 'до ' + d.w : '', d.t].filter(Boolean).join(' · '))];
    if (d.p) L.push('TEL;TYPE=CELL:+' + d.p);
    if (d.t) L.push('ADR;TYPE=WORK:;;;' + e(d.t) + ';;;Казахстан');
    if (url) L.push('URL:' + url);
    if (d.tg) L.push('X-SOCIALPROFILE;TYPE=telegram:https://t.me/' + d.tg);
    var sv = servicesRu(d); if (sv.length || d.m) L.push('NOTE:' + e([sv.join(', '), d.m].filter(Boolean).join('. ')));
    L.push('END:VCARD');
    return L.join('\r\n') + '\r\n';
  }
  function download(name, data, type) {
    var a = document.createElement('a');
    a.href = typeof data === 'string' && data.indexOf('data:') === 0 ? data : URL.createObjectURL(new Blob([data], { type: type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); }, 1000);
  }
  function fileName(s) { return (String(s || 'vizitka').trim().replace(/[\\/:*?"<>|\s]+/g, '_') || 'vizitka'); }

  function toast(msg, ms) {
    var el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._h); el._h = setTimeout(function () { el.classList.remove('show'); }, ms || 2200);
  }
  function copy(text, okMsg) {
    var done = function () { toast(okMsg || t('copied')); };
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    fallbackCopy(text); done();
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove();
  }
  function share(title, text, url) {
    if (navigator.share) return navigator.share({ title: title, text: text, url: url }).catch(function () {});
    copy(url);
  }

  // ---------- форма заказа ----------
  function bindOrderForm(form, getPhone, getName) {
    bindGeo(form);
    form.querySelectorAll('[data-fill]').forEach(function (b) {
      b.addEventListener('click', function () {
        var inp = form.querySelector('[name="' + b.dataset.fill + '"]');
        inp.value = b.dataset.v || b.textContent.trim();
        form.querySelectorAll('[data-fill="' + b.dataset.fill + '"]').forEach(function (x) { x.classList.toggle('on', x === b); });
        inp.dispatchEvent(new Event('input'));
      });
    });
    var price = form.querySelector('[name=price]');
    if (price) price.addEventListener('input', function () { price.value = fmtNum(price.value.replace(/\D/g, '').slice(0, 9)); });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var o = {}; ['from', 'to', 'what', 'when', 'price'].forEach(function (k) { var i = form.querySelector('[name=' + k + ']'); o[k] = i ? i.value.trim() : ''; });
      if (form._geo && o.from) o.geo = form._geo;
      if (!o.from && !o.to && !o.what) { toast(t('need_what')); (form.querySelector('[name=what]') || form.querySelector('input')).focus(); return; }
      openWA(getPhone(), orderText(o, getName && getName()));
    });
  }

  // ---------- PWA ----------
  var installEvt = null, installBtns = [];
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); installEvt = e;
    installBtns.forEach(function (b) { b.hidden = false; });
  });
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function bindInstall(btn) {
    if (!btn) return;
    installBtns.push(btn);
    btn.hidden = !(installEvt || (IS_IOS && !standalone() && !inAppBrowser()));
    btn.addEventListener('click', function () {
      if (installEvt) { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; btn.hidden = true; }); }
      else toast(t('ios_install'), 6000);
    });
  }
  // Свой манифест для визитки: установленная иконка открывает именно эту визитку
  function cardManifest(d, url) {
    var base = baseUrl();
    var m = {
      name: (d.n || 'Визитка') + ' — грузоперевозки', short_name: String(d.n || 'ВЕЗУ').split(' ')[0].slice(0, 12),
      id: url, start_url: url, scope: base, display: 'standalone', background_color: '#06061a', theme_color: '#06061a', lang: 'ru',
      icons: [{ src: base + 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: base + 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: base + 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
    };
    var link = document.querySelector('link[rel=manifest]');
    if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
    link.href = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' }));
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    // новая версия сайта: сразу активировать и один раз перезагрузить страницу
    var hadCtrl = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadCtrl || reloaded) return; reloaded = true;
      if (!document.querySelector('input:focus, textarea:focus')) location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (r) { if (r.update) r.update(); }).catch(function () {});
    });
  }

  var VEZU = window.VEZU = {
    SITE_PHONE: SITE_PHONE, SERVICES: SERVICES, CAPACITY: CAPACITY, EXTRAS: EXTRAS, PAYMENTS: PAYMENTS, THEMES: THEMES, DEMO: DEMO,
    VEHICLES: VEHICLES, vehicle: vehicle, vehicleImg: vehicleImg, TG_PHOTO: TG_PHOTO, localPhoto: localPhoto, photoSrc: photoSrc, resizePhoto: resizePhoto,
    sheet: sheet, info: info, t: t, setLang: setLang, savedLang: savedLang, applyI18n: applyI18n, lang: function () { return lang; },
    esc: esc, clean: clean, encode: encode, encodeSync: encodeSync, decode: decode, decodeLegacy: decodeLegacy, decodeCard: decodeLegacy, readCard: readCard,
    cardUrl: cardUrl, cardUrlAsync: cardUrlAsync, editUrl: editUrl,
    normPhone: normPhone, fmtPhone: fmtPhone, waLink: waLink, waApp: waApp, waApi: waApi, waIntent: waIntent, waHref: waHref, openWA: openWA, bindWaLink: bindWaLink, inAppBrowser: inAppBrowser,
    IS_MOBILE: IS_MOBILE, IS_ANDROID: IS_ANDROID, IS_IOS: IS_IOS, _nav: function (u) { location.href = u; }, gisLink: gisLink, gmapsLink: gmapsLink, fmtNum: fmtNum, fmtPrice: fmtPrice, orderText: orderText,
    services: services, initials: initials, metaLine: metaLine, hoursText: hoursText, isOpen: isOpen, almatyHour: almatyHour, priceText: priceText, cardHero: cardHero, cardDetails: cardDetails, applyTheme: applyTheme,
    qrSvg: qrSvg, qrPng: qrPng, vcf: vcf, download: download, fileName: fileName,
    toast: toast, copy: copy, share: share, bindOrderForm: bindOrderForm, bindInstall: bindInstall, cardManifest: cardManifest
  };
})();
