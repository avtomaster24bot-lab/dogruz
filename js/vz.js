/* ВЕЗУ — генератор визиток водителя. Всё работает в браузере: никаких запросов с данными, никакого сервера.
   Формат ссылки: …/vizitka/#<base64url(байты)>
   байт 0: 0x10 | флаги (1 — текст сжат deflate-raw, 2 — есть фото, 4 — фото JPEG, иначе WebP)
   varint длина текстовой части, текстовая часть (JSON в UTF-8; если сжата — varint исходной длины + deflate-raw),
   остаток — байты фото как есть (оно уже сжато). */
(function () {
  'use strict';

  var SUPPORT_WA = '77714105797';
  // SHA-256('vezu-promo:' + код). Проверка на клиенте — это не защита, а удобство: тему можно включить и вручную.
  var PROMO = ['431e04c96b8578379bbbc708f590c8fa71b1d3e5082a0fb56eb09538423ff0a1', '72e7e107eae60f2217ed234dd8081d603d6fbd1cc91e653b17add16f425e99d4',
    '4818396df98eae1caf9eb573300a793e7654c710d5102906fab19711656c7fa3', 'a09110892ae076f53395ebf93099bee6b2841e6fd65f9f2a91a900ffee4accc5',
    'a5c45ea999025f642b9b71ec163a134c13de6bf880c69c9d2681741e85ed07bf'];
  var THEMES = 5, PREMIUM_THEME = 5;

  // ---------- языки ----------
  // Казахский текст переведён без носителя языка — нужна проверка.
  var I18N = {
    ru: {
      sub: 'визитка водителя', share: 'Поделиться', copy: 'Копировать', copied: 'Ссылка скопирована', open: 'Открыть',
      h1: 'Сделай визитку за 1 минуту', lead: 'Клиенты пишут тебе в WhatsApp напрямую. Бесплатно.', cta: 'Сделать визитку',
      privacy_note: '<b>Мы не храним ваши данные.</b> Всё генерируется в вашем браузере.',
      privacy_more: 'Ничего не отправляется на сервер: данные визитки живут только внутри ссылки.',
      s1: 'Заполни данные', s1d: 'Имя, WhatsApp, машина — можно добавить фото.', s2: 'Сгенерируй ссылку', s2d: 'Визитка собирается прямо в телефоне.', s3: 'Отправь ссылку клиентам или сохрани QR', s3d: 'Клиент открывает визитку и пишет тебе в WhatsApp.',
      form_t: 'Данные визитки', f_name: 'Имя', f_name_ph: 'Например, Александр', f_wa: 'WhatsApp', f_wa_ph: '+7 700 000 00 00', f_call: 'Телефон для звонка', f_call_ph: 'Если отличается от WhatsApp',
      f_car: 'Машина и грузоподъёмность', f_car_ph: 'Газель, до 1,5 т', f_desc: 'Описание и режим работы', f_desc_ph: 'Переезды, мебель, стройматериалы. Каждый день 8:00–22:00, Алматы',
      f_photo: 'Фото машины', f_photo_btn: 'Выбрать фото', f_photo_del: 'Убрать фото', f_photo_hint: 'Снимайте машину <b>без людей в кадре</b>. Фото сжимается в телефоне и попадает только в ссылку.',
      f_photo_busy: 'Сжимаем фото…', f_photo_err: 'Не удалось открыть это фото. Попробуйте другое.', f_photo_ok: 'Фото сжато до {0} КБ',
      f_theme: 'Оформление', req: 'обязательно', optional: 'необязательно',
      gen: 'Сгенерировать ссылку', err_name: 'Укажите имя', err_wa: 'Укажите номер WhatsApp полностью, например +7 700 123 45 67',
      draft_note: 'Черновик формы хранится только на этом устройстве.', clear: 'Очистить форму', cleared: 'Форма очищена',
      res_t: 'Визитка готова', res_full: 'Ссылка на визитку', res_full_photo: 'Ссылка с фото — для WhatsApp и Telegram', res_short: 'Короткая ссылка без фото — для QR и SMS',
      res_len: '{0} символов', qr_t: 'QR-код', qr_note_photo: 'QR ведёт на визитку <b>без фото</b>: ссылка с фото слишком длинная — такой QR был бы мелким и плохо читался бы камерой. Фото увидят те, кому вы отправите полную ссылку.',
      qr_note: 'Покажите QR клиенту — он наведёт камеру и откроет визитку.', qr_save: 'Сохранить QR', share_card: 'Отправить визитку', open_card: 'Открыть визитку', edit_hint: 'Чтобы изменить визитку, поправьте форму и сгенерируйте ссылку заново. Старая ссылка продолжит работать со старыми данными.',
      prem_t: 'Премиум-оформление', prem_d: 'Тема «Золото» включается промокодом.', promo_ph: 'Промокод', promo_btn: 'Применить', promo_ok: 'Тема «Золото» включена', promo_bad: 'Промокод не подошёл', promo_na: 'Проверка промокода недоступна в этом браузере',
      prem_lock: 'по промокоду', theme_names: ['Аврора', 'Лагуна', 'Закат', 'Неон', 'Хром', 'Золото'],
      sup_t: 'Поддержать проект', sup_d: 'Сервис бесплатный. Если он помог — можно поддержать переводом на Kaspi. Напишите в WhatsApp, пришлём реквизиты.', sup_btn: 'Поддержать проект', sup_msg: 'Здравствуйте! Хочу поддержать проект ВЕЗУ переводом на Kaspi.',
      foot: 'ВЕЗУ — бесплатный инструмент для визиток водителей. Без регистрации и без сервера.', priv_link: 'Конфиденциальность', home: 'На главную',
      share_text: 'ВЕЗУ — бесплатная визитка водителя за 1 минуту: клиенты пишут в WhatsApp напрямую.',
      card_wa: 'Написать в WhatsApp', card_call: 'Позвонить', card_contact: 'В контакты', card_share: 'Поделиться визиткой', card_qr: 'QR-код визитки', card_make: 'Вы водитель? <b>Сделайте такую визитку бесплатно →</b>',
      card_hello: 'Здравствуйте! Нашёл вашу визитку на ВЕЗУ.', card_driver: 'Водитель',
      err_t: 'Визитка не открылась', err_empty: 'В ссылке нет данных визитки. Возможно, ссылка обрезана или скопирована не полностью — попросите водителя прислать её ещё раз.',
      err_bad: 'Ссылка повреждена или скопирована не полностью. Попросите водителя прислать её ещё раз.', err_make: 'Сделать свою визитку',
      old_t: 'Эта визитка переехала', old_d: 'ВЕЗУ теперь работает без сервера: визитки хранятся только в ссылках. Старая облачная ссылка больше не открывается — попросите водителя прислать новую ссылку на визитку.',
      install: 'Установить на телефон', inst_t: 'Установить ВЕЗУ на телефон', inst_done: 'Готово! Иконка ВЕЗУ появилась на главном экране.', close: 'Закрыть',
      inst_android: '<ol class="inst"><li>Нажмите <b>⋮</b> (три точки) вверху справа в Chrome.</li><li>Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.</li><li>Нажмите <b>«Установить»</b> — иконка ВЕЗУ появится на главном экране.</li></ol>',
      inst_ios: '<ol class="inst"><li>Откройте сайт в <b>Safari</b>.</li><li>Нажмите <b>«Поделиться»</b> (квадрат со стрелкой) внизу экрана.</li><li>Выберите <b>«На экран „Домой“»</b> → <b>«Добавить»</b>.</li></ol>',
      inst_inapp: '<ol class="inst"><li>Сайт открыт внутри Telegram/WhatsApp/Instagram — отсюда установить нельзя.</li><li>Нажмите <b>⋮</b> или <b>…</b> вверху и выберите <b>«Открыть в браузере»</b> (Chrome или Safari).</li><li>В браузере снова нажмите <b>«Установить на телефон»</b>.</li></ol>',
      inst_desktop: '<ol class="inst"><li>В Chrome или Edge нажмите значок установки в адресной строке или меню <b>⋮</b> → <b>«Установить»</b>.</li><li>На телефоне откройте этот адрес в Chrome (Android) или Safari (iPhone).</li></ol>',
      inst_why: 'С иконки генератор открывается за секунду и работает без интернета — данные по-прежнему остаются только на вашем телефоне.',
      old_wait: 'Открываем визитку…', offline: 'Нет интернета — визитка всё равно откроется, QR сохраняется в телефоне.'
    },
    kk: {
      sub: 'жүргізуші визиткасы', share: 'Бөлісу', copy: 'Көшіру', copied: 'Сілтеме көшірілді', open: 'Ашу',
      h1: 'Визитканы 1 минутта жаса', lead: 'Клиенттер саған WhatsApp-қа тікелей жазады. Тегін.', cta: 'Визитка жасау',
      privacy_note: '<b>Біз деректеріңізді сақтамаймыз.</b> Барлығы сіздің браузеріңізде жасалады.',
      privacy_more: 'Серверге ештеңе жіберілмейді: визитка деректері тек сілтеменің ішінде болады.',
      s1: 'Деректерді толтыр', s1d: 'Аты, WhatsApp, көлік — фото қосуға болады.', s2: 'Сілтеме жаса', s2d: 'Визитка тікелей телефонда жасалады.', s3: 'Сілтемені клиенттерге жібер немесе QR-ды сақта', s3d: 'Клиент визитканы ашып, саған WhatsApp-қа жазады.',
      form_t: 'Визитка деректері', f_name: 'Аты', f_name_ph: 'Мысалы, Александр', f_wa: 'WhatsApp', f_wa_ph: '+7 700 000 00 00', f_call: 'Қоңырау шалуға арналған телефон', f_call_ph: 'WhatsApp нөмірінен басқа болса',
      f_car: 'Көлік және жүк көтергіштігі', f_car_ph: 'Газель, 1,5 т дейін', f_desc: 'Сипаттама және жұмыс уақыты', f_desc_ph: 'Көшу, жиһаз, құрылыс материалдары. Күн сайын 8:00–22:00, Алматы',
      f_photo: 'Көлік фотосы', f_photo_btn: 'Фото таңдау', f_photo_del: 'Фотоны алып тастау', f_photo_hint: 'Көлікті <b>кадрда адамдарсыз</b> түсіріңіз. Фото телефонда сығылып, тек сілтемеге енеді.',
      f_photo_busy: 'Фото сығылуда…', f_photo_err: 'Бұл фотоны ашу мүмкін болмады. Басқасын таңдаңыз.', f_photo_ok: 'Фото {0} КБ-қа дейін сығылды',
      f_theme: 'Безендіру', req: 'міндетті', optional: 'міндетті емес',
      gen: 'Сілтеме жасау', err_name: 'Атыңызды жазыңыз', err_wa: 'WhatsApp нөмірін толық жазыңыз, мысалы +7 700 123 45 67',
      draft_note: 'Форма жобасы тек осы құрылғыда сақталады.', clear: 'Форманы тазалау', cleared: 'Форма тазаланды',
      res_t: 'Визитка дайын', res_full: 'Визитка сілтемесі', res_full_photo: 'Фотосы бар сілтеме — WhatsApp пен Telegram үшін', res_short: 'Фотосыз қысқа сілтеме — QR және SMS үшін',
      res_len: '{0} таңба', qr_t: 'QR-код', qr_note_photo: 'QR визитканың <b>фотосыз</b> нұсқасына апарады: фотосы бар сілтеме тым ұзын — ондай QR ұсақ болып, камерамен нашар оқылар еді. Фотоны толық сілтеме жіберілгендер көреді.',
      qr_note: 'QR-ды клиентке көрсетіңіз — ол камераны бағыттап, визитканы ашады.', qr_save: 'QR-ды сақтау', share_card: 'Визитканы жіберу', open_card: 'Визитканы ашу', edit_hint: 'Визитканы өзгерту үшін форманы түзетіп, сілтемені қайта жасаңыз. Ескі сілтеме ескі деректермен жұмыс істей береді.',
      prem_t: 'Премиум безендіру', prem_d: '«Алтын» тақырыбы промокодпен қосылады.', promo_ph: 'Промокод', promo_btn: 'Қолдану', promo_ok: '«Алтын» тақырыбы қосылды', promo_bad: 'Промокод жарамады', promo_na: 'Бұл браузерде промокодты тексеру мүмкін емес',
      prem_lock: 'промокодпен', theme_names: ['Аврора', 'Лагуна', 'Шұғыла', 'Неон', 'Хром', 'Алтын'],
      sup_t: 'Жобаны қолдау', sup_d: 'Сервис тегін. Пайдасы тиген болса — Kaspi-ге аударым арқылы қолдауға болады. WhatsApp-қа жазыңыз, деректемелерді жібереміз.', sup_btn: 'Жобаны қолдау', sup_msg: 'Сәлеметсіз бе! ВЕЗУ жобасын Kaspi аударымымен қолдағым келеді.',
      foot: 'ВЕЗУ — жүргізушілер визиткасына арналған тегін құрал. Тіркеусіз және серверсіз.', priv_link: 'Құпиялылық', home: 'Басты бет',
      share_text: 'ВЕЗУ — жүргізушінің тегін визиткасы 1 минутта: клиенттер WhatsApp-қа тікелей жазады.',
      card_wa: 'WhatsApp-қа жазу', card_call: 'Қоңырау шалу', card_contact: 'Контактілерге', card_share: 'Визиткамен бөлісу', card_qr: 'Визитканың QR-коды', card_make: 'Жүргізушісіз бе? <b>Осындай визитканы тегін жасаңыз →</b>',
      card_hello: 'Сәлеметсіз бе! Визиткаңызды ВЕЗУ-дан таптым.', card_driver: 'Жүргізуші',
      err_t: 'Визитка ашылмады', err_empty: 'Сілтемеде визитка деректері жоқ. Сілтеме қысқарып қалған не толық көшірілмеген болуы мүмкін — жүргізушіден оны қайта жіберуін сұраңыз.',
      err_bad: 'Сілтеме бүлінген немесе толық көшірілмеген. Жүргізушіден оны қайта жіберуін сұраңыз.', err_make: 'Өз визиткаңды жаса',
      old_t: 'Бұл визитка көшті', old_d: 'ВЕЗУ енді серверсіз жұмыс істейді: визиткалар тек сілтемелерде сақталады. Ескі бұлттағы сілтеме ашылмайды — жүргізушіден визитканың жаңа сілтемесін сұраңыз.',
      install: 'Телефонға орнату', inst_t: 'ВЕЗУ-ды телефонға орнату', inst_done: 'Дайын! ВЕЗУ белгішесі басты экранға шықты.', close: 'Жабу',
      inst_android: '<ol class="inst"><li>Chrome-да жоғарғы оң жақтағы <b>⋮</b> (үш нүкте) басыңыз.</li><li><b>«Қолданбаны орнату»</b> немесе <b>«Басты экранға қосу»</b> таңдаңыз.</li><li><b>«Орнату»</b> басыңыз — ВЕЗУ белгішесі басты экранда пайда болады.</li></ol>',
      inst_ios: '<ol class="inst"><li>Сайтты <b>Safari</b>-де ашыңыз.</li><li>Төмендегі <b>«Бөлісу»</b> батырмасын басыңыз.</li><li><b>«Басты экранға»</b> → <b>«Қосу»</b> таңдаңыз.</li></ol>',
      inst_inapp: '<ol class="inst"><li>Сайт Telegram/WhatsApp/Instagram ішінде ашық — мұнда орнату мүмкін емес.</li><li>Жоғарыдағы <b>⋮</b> немесе <b>…</b> басып, <b>«Браузерде ашу»</b> таңдаңыз.</li><li>Браузерде қайтадан <b>«Телефонға орнату»</b> басыңыз.</li></ol>',
      inst_desktop: '<ol class="inst"><li>Chrome не Edge-де мекенжай жолындағы орнату белгішесін немесе <b>⋮</b> → <b>«Орнату»</b> басыңыз.</li><li>Телефонда бұл мекенжайды Chrome (Android) не Safari (iPhone) арқылы ашыңыз.</li></ol>',
      inst_why: 'Белгішеден генератор бір секундта ашылады және интернетсіз жұмыс істейді — деректер бұрынғыдай тек телефоныңызда қалады.',
      old_wait: 'Визитка ашылуда…', offline: 'Интернет жоқ — визитка бәрібір ашылады, QR телефонда сақталады.'
    }
  };
  var lang = 'ru';
  function t(key) {
    var s = (I18N[lang] && I18N[lang][key] != null) ? I18N[lang][key] : (I18N.ru[key] != null ? I18N.ru[key] : key);
    for (var i = 1; i < arguments.length; i++) s = String(s).replace('{' + (i - 1) + '}', arguments[i]);
    return s;
  }
  var langCbs = [];
  function setLang(l, persist) {
    lang = I18N[l] ? l : 'ru';
    document.documentElement.lang = lang;
    if (persist) try { localStorage.setItem('vezu-lang', lang); } catch (e) {}
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.innerHTML = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.querySelectorAll('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    langCbs.forEach(function (f) { f(lang); });
  }
  function savedLang() {
    try { var l = localStorage.getItem('vezu-lang'); if (I18N[l]) return l; } catch (e) {}
    return /^kk/i.test(navigator.language || '') ? 'kk' : 'ru';
  }
  function initLang(cb) {
    if (cb) langCbs.push(cb);
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.lang button[data-lang]');
      if (b) setLang(b.dataset.lang, true);
    });
    setLang(savedLang());
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // ---------- данные визитки ----------
  function normPhone(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
    else if (d.length === 10 && d[0] === '7') d = '7' + d;
    return d.length >= 10 && d.length <= 15 ? d : '';
  }
  function line(s, n) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, n); }
  function clean(d) {
    d = d || {}; var o = {};
    var n = line(d.n, 40); if (n) o.n = n;
    var w = normPhone(d.w); if (w) o.w = w;
    var p = normPhone(d.p); if (p && p !== w) o.p = p;
    var c = line(d.c, 60); if (c) o.c = c;
    var ds = String(d.d || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 300); if (ds) o.d = ds;
    var th = parseInt(d.th, 10); if (th > 0 && th <= PREMIUM_THEME) o.th = th;
    if (d.l === 'kk') o.l = 'kk';
    return o;
  }

  // ---------- байты / base64url ----------
  function b64(bytes) {
    var bin = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  }
  function b64u(bytes) { return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(s) {
    s = String(s).replace(/[^A-Za-z0-9_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (s.length % 4 === 1) throw new Error('length');
    while (s.length % 4) s += '=';
    var bin = atob(s), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  function varint(n) { var o = []; do { var x = n & 127; n = Math.floor(n / 128); o.push(n ? x | 128 : x); } while (n); return o; }
  function readVarint(b, pos) {
    var n = 0, m = 1, x;
    do { if (pos.p >= b.length) throw new Error('eof'); x = b[pos.p++]; n += (x & 127) * m; m *= 128; } while (x & 128 && m < 1e12);
    return n;
  }
  function concat(parts) {
    var len = 0; parts.forEach(function (p) { len += p.length; });
    var out = new Uint8Array(len), o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }
  function deflate(bytes) {
    if (!window.CompressionStream) return Promise.resolve(null);
    try {
      var cs = new CompressionStream('deflate-raw'), wr = cs.writable.getWriter();
      wr.write(bytes); wr.close();
      return new Response(cs.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); }, function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function dataUrlBytes(u) {
    var m = /^data:image\/(webp|jpeg);base64,(.+)$/.exec(u || '');
    if (!m) return null;
    var bin = atob(m[2]), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return { jpeg: m[1] === 'jpeg', bytes: b };
  }

  // d: данные визитки, photo: data:image/webp|jpeg;base64,… или null → Promise<строка для # в адресе>
  function encode(d, photo) {
    var json = new TextEncoder().encode(JSON.stringify(clean(d)));
    return deflate(json).then(function (z) {
      var flags = 0, text = json;
      if (z) {
        var packed = concat([new Uint8Array(varint(json.length)), z]);
        if (packed.length < json.length) { flags |= 1; text = packed; }
      }
      var ph = dataUrlBytes(photo), parts = [null, new Uint8Array(varint(text.length)), text];
      if (ph) { flags |= 2; if (ph.jpeg) flags |= 4; parts.push(ph.bytes); }
      parts[0] = new Uint8Array([0x10 | flags]);
      return b64u(concat(parts));
    });
  }
  // строка из # → { d, photo } или null
  function decode(code) {
    try {
      code = String(code || '').replace(/^#/, '');
      if (!code) return null;
      var b = unb64u(code), h = b[0];
      if ((h & 0xF0) !== 0x10) return null;
      var pos = { p: 1 }, len = readVarint(b, pos);
      if (pos.p + len > b.length) return null;
      var text = b.subarray(pos.p, pos.p + len), rest = b.subarray(pos.p + len);
      if (h & 1) {
        var tp = { p: 0 }, rawLen = readVarint(text, tp);
        if (rawLen > 20000) return null;
        var out = new Uint8Array(rawLen);
        window.tinyInflate(text.subarray(tp.p), out);
        text = out;
      }
      var d = clean(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(text)));
      if (!d.n || !d.w) return null;
      var photo = null;
      if ((h & 2) && rest.length > 20) photo = 'data:image/' + (h & 4 ? 'jpeg' : 'webp') + ';base64,' + b64(rest);
      return { d: d, photo: photo };
    } catch (e) { return null; }
  }

  function baseUrl() {
    var p = location.pathname.replace(/[^/]*$/, '').replace(/vizitka\/$/, '');
    return location.origin + p;
  }
  function cardUrl(code) { return baseUrl() + 'vizitka/#' + code; }

  // ---------- фото: сжатие в телефоне ----------
  var PHOTO_MAX = 2600; // байт: ссылка с фото остаётся < ~4000 символов (лимит сообщения Telegram — 4096)
  var webpOk = null;
  function canWebp() {
    if (webpOk == null) { var c = document.createElement('canvas'); c.width = c.height = 2; webpOk = c.toDataURL('image/webp').indexOf('data:image/webp') === 0; }
    return webpOk;
  }
  function compressPhoto(file) {
    return new Promise(function (ok, fail) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var type = canWebp() ? 'image/webp' : 'image/jpeg';
        var w0 = img.naturalWidth, h0 = img.naturalHeight;
        if (!w0 || !h0) return fail(new Error('bad image'));
        // кадр 16:10 по центру — как на визитке
        var ar = 1.6, sw = w0, sh = h0, sx = 0, sy = 0;
        if (w0 / h0 > ar) { sw = h0 * ar; sx = (w0 - sw) / 2; } else { sh = w0 / ar; sy = (h0 - sh) / 2; }
        var widths = [400, 360, 320, 280, 240, 200, 160], qs = [0.6, 0.5, 0.4, 0.32, 0.25, 0.18], best = null;
        for (var i = 0; i < widths.length; i++) {
          var cv = document.createElement('canvas'); cv.width = widths[i]; cv.height = Math.round(widths[i] / ar);
          var g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
          g.fillStyle = '#0d0c2b'; g.fillRect(0, 0, cv.width, cv.height);
          g.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
          for (var j = 0; j < qs.length; j++) {
            var out = cv.toDataURL(type, qs[j]), bytes = Math.floor((out.length - out.indexOf(',') - 1) * 3 / 4);
            best = { url: out, bytes: bytes, w: cv.width, h: cv.height };
            if (bytes <= PHOTO_MAX) return ok(best);
          }
        }
        ok(best);
      };
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('bad image')); };
      img.src = url;
    });
  }

  // ---------- QR (локальная библиотека js/vendor/qrcode.js) ----------
  function makeQR(text) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    var q = qrcode(0, 'M'); q.addData(text, 'Byte'); q.make(); return q;
  }
  function qrSvg(text) {
    var q = makeQR(text), n = q.getModuleCount(), m = 3, path = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) path += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    var s = n + m * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '" shape-rendering="crispEdges" role="img" aria-label="' + esc(t('card_qr')) + '">' +
      '<rect width="' + s + '" height="' + s + '" fill="#fff"/><path d="' + path + '" fill="#0b0b1f"/></svg>';
  }
  function qrPng(text, caption, sub) {
    var q = makeQR(text), n = q.getModuleCount(), quiet = 4, cell = Math.max(8, Math.floor(880 / (n + quiet * 2)));
    var qs = (n + quiet * 2) * cell, capH = caption ? 170 : 0;
    var cv = document.createElement('canvas'); cv.width = qs; cv.height = qs + capH;
    var g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#0b0b1f';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    if (caption) {
      g.textAlign = 'center';
      g.font = '800 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      g.fillText(String(caption).slice(0, 28), qs / 2, qs + 50);
      if (sub) { g.fillStyle = '#5a5a7a'; g.font = '500 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'; g.fillText(String(sub).slice(0, 40), qs / 2, qs + 110); }
    }
    return cv.toDataURL('image/png');
  }

  // ---------- мелочи ----------
  function toast(msg, ms) {
    var el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._h); el._h = setTimeout(function () { el.classList.remove('show'); }, ms || 2200);
  }
  function copy(text) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove(); toast(t('copied'));
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast(t('copied')); }, fallback);
    else fallback();
  }
  // Web Share API, иначе — копирование ссылки. Ничего не уходит на наш сервер.
  function share(url, title, text) {
    if (navigator.share) {
      navigator.share({ title: title, text: text, url: url }).catch(function (e) { if (e && e.name !== 'AbortError') copy(url); });
    } else copy(url);
  }
  function download(name, dataUrl) {
    var a = document.createElement('a'); a.href = dataUrl; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); }, 1000);
  }
  function fileName(s) { return String(s || 'vizitka').trim().replace(/[\\/:*?"<>|\s]+/g, '_') || 'vizitka'; }
  function fmtPhone(p) {
    var m = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(p || '');
    return m ? '+7 ' + m[1] + ' ' + m[2] + ' ' + m[3] + ' ' + m[4] : '+' + p;
  }
  function waUrl(phone, text) { return 'https://wa.me/' + phone + (text ? '?text=' + encodeURIComponent(text) : ''); }
  function supportUrl() { return waUrl(SUPPORT_WA, t('sup_msg')); }

  // ---------- промокод и премиум-тема (не защита: всё на клиенте) ----------
  function premium() { try { return localStorage.getItem('vezu-premium') === '1'; } catch (e) { return false; } }
  function checkPromo(code) {
    code = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!code) return Promise.resolve(false);
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('na'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode('vezu-promo:' + code)).then(function (buf) {
      var hex = Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      var ok = PROMO.indexOf(hex) >= 0;
      if (ok) try { localStorage.setItem('vezu-premium', '1'); } catch (e) {}
      return ok;
    });
  }
  function applyTheme(th) {
    for (var i = 0; i <= PREMIUM_THEME; i++) document.documentElement.classList.remove('th-' + i);
    document.documentElement.classList.add('th-' + (th || 0));
  }


  // ---------- «Установить на телефон»: видна всегда, кроме уже установленного приложения ----------
  var installEvt = null, installBtns = [];
  var UA = navigator.userAgent || '', IS_IOS = /iPhone|iPad|iPod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), IS_ANDROID = /Android/i.test(UA);
  function inApp() { return !!(window.TelegramWebviewProxy || /Telegram|FBAN|FBAV|FB_IAB|Instagram|Line\/|; wv\)/i.test(UA)); }
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
  window.addEventListener('appinstalled', function () { installEvt = null; toast(t('inst_done'), 4000); });
  function sheet(title, html) {
    var bg = document.createElement('div'); bg.className = 'sheet-bg';
    bg.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><button type="button" class="sheet-x" aria-label="' + esc(t('close')) + '">×</button><h2>' + esc(title) + '</h2><div class="sheet-b">' + html + '</div></div>';
    function close() { bg.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('.sheet-x')) close(); });
    document.addEventListener('keydown', key);
    document.body.appendChild(bg); bg.querySelector('.sheet-x').focus();
    return bg;
  }
  function installHelp() {
    var k = inApp() ? 'inst_inapp' : IS_IOS ? 'inst_ios' : IS_ANDROID ? 'inst_android' : 'inst_desktop';
    return sheet(t('inst_t'), t(k) + '<p class="hint" style="margin-top:12px">' + t('inst_why') + '</p>');
  }
  function doInstall() {
    if (installEvt) { var ev = installEvt; installEvt = null; ev.prompt(); ev.userChoice.catch(function () {}); }
    else installHelp();
  }
  function bindInstall() {
    document.querySelectorAll('[data-install]').forEach(function (b) {
      if (b._inst) return; b._inst = true; installBtns.push(b); b.hidden = standalone();
      b.addEventListener('click', function (e) { e.preventDefault(); doInstall(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindInstall); else bindInstall();

  // ---------- service worker ----------
  function registerSW(path) {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    window.addEventListener('load', function () { navigator.serviceWorker.register(path || 'sw.js').catch(function () {}); });
  }

  window.VZ = {
    t: t, setLang: setLang, initLang: initLang, lang: function () { return lang; }, esc: esc,
    normPhone: normPhone, clean: clean, encode: encode, decode: decode, cardUrl: cardUrl, baseUrl: baseUrl,
    compressPhoto: compressPhoto, PHOTO_MAX: PHOTO_MAX, qrSvg: qrSvg, qrPng: qrPng, toast: toast, copy: copy, share: share, download: download,
    fileName: fileName, fmtPhone: fmtPhone, waUrl: waUrl, supportUrl: supportUrl,
    premium: premium, checkPromo: checkPromo, applyTheme: applyTheme, THEMES: THEMES, PREMIUM_THEME: PREMIUM_THEME, registerSW: registerSW
  };
})();
