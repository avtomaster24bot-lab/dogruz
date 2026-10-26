# Генератор HTML-страниц ВЕЗУ: python3 tools/build_pages.py
import os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SP=open('tools/sprite.html').read()
BASE='https://avtomaster24bot-lab.github.io/dogruz/'
def head(title,desc,url,extra='',robots=''):
    return f'''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">{robots}
<meta name="theme-color" content="#06061a">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{BASE}{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ВЕЗУ">
<meta property="og:locale" content="ru_RU">
<meta property="og:image" content="{BASE}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="ВЕЗУ — грузоперевозки до 3 тонн и визитки водителей">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{BASE}og.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ВЕЗУ">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="css/style.css">
{extra}</head>
<body>
'''+SP
LOGO=lambda sub: f'<a class="logo" href="./" aria-label="ВЕЗУ — на главную"><svg><use href="#logo"/></svg><span>везу<small>{sub}</small></span></a>'
FOOT='''<footer class="foot">
  <div class="wrap">
    <span>© 2026 ВЕЗУ · грузоперевозки до 3 тонн</span>
    <span><a href="new.html">Создать визитку</a> · <a href="catalog.html">Водители</a> · <a href="tarify.html">Тарифы</a></span>
  </div>
</footer>
'''
ORDER_FIELDS='''    <label class="fld"><span class="sr">Что везём</span><input class="inp" name="what" placeholder="{ph_what}" data-i18n-ph="what" maxlength="120"></label>
    <div class="route">
      <i class="dot d1"></i><i class="dot d2"></i>
      <label class="fld"><span class="sr" data-i18n="from">Откуда</span><input class="inp" name="from" placeholder="Откуда" data-i18n-ph="from" maxlength="120" autocomplete="street-address"></label>
      <label class="fld"><span class="sr" data-i18n="to">Куда</span><input class="inp" name="to" placeholder="Куда" data-i18n-ph="to" maxlength="120"></label>
    </div>
    <div class="row2">
      <label class="fld"><span class="sr">Когда</span>
        <select class="inp" name="when"><option value="Сейчас" data-i18n="when_now">Сейчас</option><option value="Сегодня" data-i18n="when_today">Сегодня</option><option value="Завтра" data-i18n="when_tomorrow">Завтра</option><option value="На этой неделе" data-i18n="when_week">На этой неделе</option><option value="" data-i18n="when_any">Договоримся</option></select>
      </label>
      <label class="fld"><span class="sr" data-i18n="price">Ваша цена</span><input class="inp" name="price" inputmode="numeric" placeholder="Ваша цена" data-i18n-ph="price"><b class="suffix">₸</b></label>
    </div>
'''
QCHIPS='''    <div class="qchips" aria-label="Что везём">
      <button type="button" class="qchip" data-fill="what" data-v="Переезд" data-i18n="q_move">Переезд</button>
      <button type="button" class="qchip" data-fill="what" data-v="Стройматериалы" data-i18n="q_build">Стройматериалы</button>
      <button type="button" class="qchip" data-fill="what" data-v="Мебель" data-i18n="q_furn">Мебель</button>
      <button type="button" class="qchip" data-fill="what" data-v="Вывоз мусора" data-i18n="q_trash">Вывоз мусора</button>
    </div>
'''
SCRIPTS=lambda *xs: ''.join(f'<script src="{x}"></script>\n' for x in xs)

# ---------------- index ----------------
index=head('ВЕЗУ — перевезём что угодно по лучшей цене','Грузоперевозки до 3 тонн по Казахстану: переезды, стройматериалы, мебель, вывоз мусора. Заказ в WhatsApp за 2 касания. Водителям — бесплатная визитка с QR.','',
 '<link rel="preload" as="image" href="img/hero-van-720.webp" imagesrcset="img/hero-van-720.webp 720w, img/hero-van-1280.webp 1280w" imagesizes="(min-width:880px) 1120px, 100vw">\n')+f'''
<header class="top">
  <div class="wrap">
    {LOGO('грузы до 3 тонн')}
    <nav class="topnav"><a href="catalog.html">Водители</a><a href="tarify.html">Тарифы</a><a class="btn btn-glass btn-sm" href="new.html">Я водитель</a></nav>
  </div>
</header>

<main class="wrap">
  <section class="banner">
    <img src="img/hero-van-720.webp" srcset="img/hero-van-720.webp 720w, img/hero-van-1280.webp 1280w" sizes="(min-width:880px) 1120px, 100vw" alt="Грузовая машина едет по ночному городу" width="1280" height="720" fetchpriority="high">
    <div class="banner-txt">
      <span class="badge"><i></i>Казахстан · грузы до 3 тонн</span>
      <h1 class="h1">Перевезём <span class="grad-text">что угодно</span> по лучшей цене</h1>
    </div>
  </section>

  <ol class="how" aria-label="Как это работает">
    <li><svg><use href="#i-box"/></svg><b>Опишите груз</b><span>что, откуда, куда</span></li>
    <li><svg><use href="#i-wa"/></svg><b>Отправьте в WhatsApp</b><span>одним нажатием</span></li>
    <li><svg><use href="#i-hand"/></svg><b>Договоритесь</b><span>с водителем напрямую</span></li>
  </ol>

  <section class="home-grid">
    <form class="order glass glow f" id="order" novalidate>
      <div class="order-h">
        <h2>Заказ <b>2 касания</b></h2>
        <button type="button" class="info-btn" data-info="geo" aria-label="Что такое «Где я»"><svg><use href="#i-info"/></svg>Где я?</button>
      </div>
{QCHIPS}{ORDER_FIELDS.replace('{ph_what}','Что везём? Например: диван и 10 коробок')}      <button class="btn btn-wa btn-lg btn-block" type="submit"><svg><use href="#i-wa"/></svg>Отправить в WhatsApp</button>
      <p class="hint">Откроется WhatsApp с готовым сообщением. Цену можно не указывать.</p>
    </form>

    <div class="svc4" aria-label="Что возим">
      <button type="button" data-svc="Переезд"><img src="img/s-move.webp" alt="" width="320" height="320" loading="lazy" decoding="async"><span>Переезды</span></button>
      <button type="button" data-svc="Мебель"><img src="img/s-furniture.webp" alt="" width="320" height="320" loading="lazy" decoding="async"><span>Мебель</span></button>
      <button type="button" data-svc="Стройматериалы"><img src="img/s-build.webp" alt="" width="320" height="320" loading="lazy" decoding="async"><span>Стройка</span></button>
      <button type="button" data-svc="Вывоз мусора"><img src="img/s-trash.webp" alt="" width="320" height="320" loading="lazy" decoding="async"><span>Вывоз мусора</span></button>
    </div>
  </section>

  <section class="drivers glass glow" id="drivers">
    <div>
      <span class="badge"><i></i>Для водителей · бесплатно</span>
      <h2>Ваша визитка <span class="grad-text">за 1 минуту</span></h2>
      <p class="muted">Ссылка и QR-код — клиенты пишут вам в WhatsApp напрямую, без комиссий.</p>
      <button type="button" class="info-link" data-info="why"><svg><use href="#i-info"/></svg>Почему это удобнее бумажной визитки</button>
      <div class="btns">
        <a class="btn btn-grad" href="new.html">Создать визитку<svg><use href="#i-arrow"/></svg></a>
        <a class="btn btn-glass" href="card.html?demo">Пример</a>
      </div>
      <a class="tlink" href="tarify.html">ВЕЗУ Про — 7 дней бесплатно: короткий адрес, фото, каталог →</a>
    </div>
    <a class="mock" href="card.html?demo" aria-label="Пример визитки водителя" id="mock"></a>
  </section>
</main>
{FOOT}
{SCRIPTS('js/common.js')}<script>
(function () {{
  var V = window.VEZU, form = document.getElementById('order');
  V.bindOrderForm(form, function () {{ return V.SITE_PHONE; }});
  document.querySelectorAll('[data-svc]').forEach(function (b) {{
    b.addEventListener('click', function () {{
      var w = form.querySelector('[name=what]'); w.value = b.dataset.svc;
      form.querySelectorAll('[data-fill]').forEach(function (x) {{ x.classList.toggle('on', x.dataset.v === b.dataset.svc); }});
      form.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
      setTimeout(function () {{ form.querySelector('[name=from]').focus({{ preventScroll: true }}); }}, 400);
    }});
  }});
  if (matchMedia('(min-width:880px)').matches) document.getElementById('mock').innerHTML = V.cardHero(V.DEMO);
}})();
</script>
</body>
</html>
'''
open('index.html','w').write(index)

# ---------------- card ----------------
card=head('Визитка водителя — ВЕЗУ','Грузоперевозки до 3 тонн. Напишите водителю в WhatsApp, позвоните или сохраните контакт.','card.html')+f'''
<header class="top">
  <div class="wrap narrow">
    {LOGO('<span data-i18n="sub_card">визитка водителя</span>')}
    <div class="lang" role="group" aria-label="Язык / Тіл">
      <button type="button" data-lang="ru" aria-pressed="true">Рус</button><button type="button" data-lang="kk" aria-pressed="false">Қаз</button>
    </div>
  </div>
</header>

<main class="wrap narrow card-page" id="app">
  <div id="hero"></div>

  <div class="big2">
    <a class="btn btn-wa btn-xl" id="wa" href="#" target="_blank" rel="noopener"><svg><use href="#i-wa"/></svg><span data-i18n="wa_short">WhatsApp</span></a>
    <a class="btn btn-call btn-xl" id="call" href="#"><svg><use href="#i-phone"/></svg><span data-i18n="call">Позвонить</span></a>
  </div>

  <nav class="iconrow" aria-label="Действия">
    <button type="button" id="vcf"><svg><use href="#i-user"/></svg><span data-i18n="save">В контакты</span></button>
    <button type="button" id="share"><svg><use href="#i-share"/></svg><span data-i18n="share">Поделиться</span></button>
    <button type="button" id="qrbtn"><svg><use href="#i-qr"/></svg><span data-i18n="qr">QR-код</span></button>
    <a id="tg" href="#" target="_blank" rel="noopener" hidden><svg><use href="#i-tg"/></svg><span>Telegram</span></a>
  </nav>

  <section class="panel glass" id="details" hidden></section>

  <form class="panel glass f" id="order" novalidate>
    <div class="order-h">
      <div><h2 data-i18n="order">Быстрый заказ</h2><p class="sub" data-i18n="order_sub">Заполните — сообщение уйдёт водителю в WhatsApp.</p></div>
      <button type="button" class="info-btn" data-info="geo" data-i18n-aria="why_geo" aria-label="Что это?"><svg><use href="#i-info"/></svg></button>
    </div>
{QCHIPS}{ORDER_FIELDS.replace('{ph_what}','Что везём?')}    <button class="btn btn-wa btn-block" type="submit"><svg><use href="#i-wa"/></svg><span data-i18n="send">Отправить заказ</span></button>
  </form>

  <div class="card-foot">
    <button class="lnk" id="install" type="button" hidden><svg><use href="#i-install"/></svg><span data-i18n="install">Установить на телефон</span></button>
    <a class="lnk" id="edit" href="new.html"><svg><use href="#i-edit"/></svg><span data-i18n="edit">Редактировать визитку</span></a>
  </div>
  <a class="made" id="made" href="./" data-i18n="made_by">Сделано на ВЕЗУ — сделай свою визитку</a>
</main>

{SCRIPTS('js/vendor/qrcode.js','js/vendor/inflate.js','js/common.js','js/config.js','js/cloud.js','js/card.js')}</body>
</html>
'''
open('card.html','w').write(card)

# ---------------- builder ----------------
VEH=''.join(f'<button type="button" class="veh-tile" data-k="{k}" data-c="{c}" data-w="{w}" aria-pressed="false"><img src="img/v-{k}.webp" alt="" width="520" height="319" loading="lazy" decoding="async"><span>{l}</span></button>'
  for k,l,c,w in [('kabluk','Каблук','Каблук','0,5 т'),('gazel','Газель','Газель','1,5 т'),('gazel-long','Газель длинная','Газель удлинённая','2 т'),('truck3','Грузовик 3 т','Грузовик','3 т')])
new=head('Создать визитку водителя — ВЕЗУ','Бесплатная цифровая визитка для водителя грузотакси: ссылка, QR-код, кнопка WhatsApp, печать визиток и наклейки на машину.','new.html')+f'''
<header class="top">
  <div class="wrap">
    {LOGO('конструктор визитки')}
    <nav class="topnav"><a href="catalog.html">Водители</a><a class="btn btn-glass btn-sm" href="card.html?demo">Пример</a></nav>
  </div>
</header>

<main class="wrap build" id="build" data-step="1">
  <div class="steps">
    <h1>Визитка водителя <span class="grad-text">за 1 минуту</span></h1>
    <div class="progress" role="tablist" aria-label="Шаги">
      <button type="button" data-go="1" role="tab"><i></i><span>1 · О себе</span></button>
      <button type="button" data-go="2" role="tab"><i></i><span>2 · Машина</span></button>
      <button type="button" data-go="3" role="tab"><i></i><span>3 · Готово</span></button>
    </div>

    <form id="f" class="f" novalidate autocomplete="on">
      <section class="step glass f" data-step="1">
        <div class="photo-row">
          <div class="ph-av" id="phav"><span>?</span></div>
          <div class="ph-act">
            <label class="btn btn-glass btn-sm" for="photo"><svg><use href="#i-cam"/></svg>Загрузить фото</label>
            <input type="file" id="photo" accept="image/*" class="sr">
            <button type="button" class="lnk" id="phdel" hidden>Удалить фото</button>
            <button type="button" class="info-link" data-info="photo"><svg><use href="#i-info"/></svg>Кто увидит фото?</button>
          </div>
        </div>
        <label class="fld"><span>Имя *</span><input class="inp" name="n" maxlength="40" placeholder="Например: Ерлан" autocomplete="name" required></label>
        <label class="fld"><span>Номер WhatsApp *</span><input class="inp" name="p" type="tel" inputmode="tel" placeholder="+7 7__ ___ __ __" autocomplete="tel" required></label>
        <label class="fld"><span>Город</span><input class="inp" name="t" list="cities" maxlength="40" placeholder="Алматы"></label>
        <details class="more">
          <summary>Ещё (необязательно)</summary>
          <div class="f">
            <label class="fld"><span>Telegram</span><input class="inp" name="tg" maxlength="40" placeholder="@username" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
            <label class="check"><input type="checkbox" id="tgphoto"><span>Показывать фото профиля из Telegram — его увидят клиенты</span></label>
            <label class="fld"><span>Ссылка на фото (https://…)</span><input class="inp" name="i" type="url" inputmode="url" placeholder="https://…/photo.jpg"></label>
            <label class="fld"><span>Коротко о себе <em class="counter" id="cnt">0/80</em></span><textarea class="inp" name="m" maxlength="80" rows="2" placeholder="Аккуратно, без опозданий."></textarea></label>
          </div>
        </details>
        <p class="err-msg" id="err1" hidden>Укажите имя и номер WhatsApp — это всё, что нужно.</p>
        <button type="button" class="btn btn-grad btn-block" data-next="2">Далее<svg><use href="#i-arrow"/></svg></button>
      </section>

      <section class="step glass f" data-step="2">
        <div class="fld"><span>Ваша машина</span><div class="veh-grid" id="veh">{VEH}</div></div>
        <label class="fld"><span>Марка / модель</span><input class="inp" name="c" list="cars" maxlength="40" placeholder="Газель"></label>
        <div class="fld"><span>Грузоподъёмность</span><div class="qchips" id="cap"></div></div>
        <div class="fld"><span>Что возите</span><div class="qchips" id="svc"></div></div>
        <div class="row2">
          <label class="fld"><span>Цена от <button type="button" class="info-i" data-info="pricefrom" aria-label="Что значит «цена от»"><svg><use href="#i-info"/></svg></button></span><input class="inp" name="pr" inputmode="numeric" placeholder="8 000"><b class="suffix">₸</b></label>
          <div class="fld"><span>За</span><div class="qchips seg" id="pu"><button type="button" class="qchip" data-v="0">поездку</button><button type="button" class="qchip" data-v="1">час</button></div></div>
        </div>
        <details class="more">
          <summary>Ещё (необязательно)</summary>
          <div class="f">
            <div class="fld"><span>Часы работы</span>
              <div class="hours">
                <select class="inp" name="hs" aria-label="С"></select><span class="muted">—</span><select class="inp" name="he" aria-label="До"></select>
                <button type="button" class="qchip" id="h24">24/7</button>
              </div>
            </div>
            <label class="fld"><span>Районы / направления</span><input class="inp" name="z" maxlength="60" placeholder="Весь город, пригород, межгород"></label>
            <div class="fld"><span>Есть с собой</span><div class="qchips" id="ex"></div></div>
            <div class="fld"><span>Оплата</span><div class="qchips" id="pay"></div></div>
          </div>
        </details>
        <div class="navrow">
          <button type="button" class="btn btn-glass" data-next="1">← Назад</button>
          <button type="button" class="btn btn-grad" data-next="3">Готово<svg><use href="#i-arrow"/></svg></button>
        </div>
      </section>
    </form>

    <section class="step glass f" data-step="3" id="result">
      <div class="fld"><span>Цвет визитки</span><div class="themes" id="themes"></div></div>
      <div id="rbody" class="f">
        <div class="linkrow">
          <input class="inp" id="link" readonly aria-label="Ссылка на визитку">
          <button class="btn btn-glass" type="button" id="copy" aria-label="Копировать ссылку"><svg><use href="#i-link"/></svg></button>
        </div>
        <div class="res-grid">
          <div class="qr" id="qr"></div>
          <div class="res-btns">
            <a class="btn btn-grad btn-sm" id="open" href="#" target="_blank" rel="noopener">Открыть визитку</a>
            <button class="btn btn-glass btn-sm" type="button" id="share"><svg><use href="#i-share"/></svg>Отправить</button>
            <button class="btn btn-glass btn-sm" type="button" id="png"><svg><use href="#i-down"/></svg>QR в PNG</button>
          </div>
        </div>
        <button type="button" class="info-link" data-info="qr"><svg><use href="#i-info"/></svg>Зачем QR-код и как его использовать</button>
        <div class="btns">
          <button class="btn btn-glass btn-sm" type="button" id="pcards" style="flex:1"><svg><use href="#i-print"/></svg>Визитки A4</button>
          <button class="btn btn-glass btn-sm" type="button" id="psticker" style="flex:1"><svg><use href="#i-print"/></svg>Наклейка на авто</button>
        </div>
        <div class="btns">
          <button class="btn btn-glass btn-sm" type="button" id="install" hidden style="flex:1"><svg><use href="#i-install"/></svg>Установить на телефон</button>
          <button type="button" class="info-link" data-info="install"><svg><use href="#i-info"/></svg>Зачем устанавливать</button>
        </div>
        <a class="tlink" href="tarify.html">Печать под ключ и тарифы →</a>
      </div>
      <section class="pro-box" id="pro" hidden></section>
      <button type="button" class="btn btn-glass btn-block" data-next="2">← Изменить данные</button>
    </section>
  </div>

  <aside class="preview">
    <p class="lbl">Так увидит клиент</p>
    <div id="pvwrap" class="th-0">
      <div id="pv"></div>
      <div class="big2" aria-hidden="true">
        <span class="btn btn-wa btn-xl"><svg><use href="#i-wa"/></svg>WhatsApp</span>
        <span class="btn btn-call btn-xl"><svg><use href="#i-phone"/></svg>Позвонить</span>
      </div>
      <div class="panel glass pv-details" id="pvd" hidden></div>
    </div>
  </aside>
</main>

<datalist id="cities"><option>Алматы</option><option>Астана</option><option>Шымкент</option><option>Караганда</option><option>Актобе</option><option>Тараз</option><option>Павлодар</option><option>Усть-Каменогорск</option><option>Семей</option><option>Атырау</option><option>Костанай</option><option>Кызылорда</option><option>Уральск</option><option>Петропавловск</option><option>Актау</option><option>Туркестан</option><option>Кокшетау</option><option>Талдыкорган</option><option>Экибастуз</option></datalist>
<datalist id="cars"><option>Газель</option><option>Газель Next</option><option>Газель удлинённая</option><option>Каблук</option><option>Hyundai Porter</option><option>Бычок</option><option>Isuzu</option><option>Mercedes Sprinter</option><option>Ford Transit</option></datalist>

<div id="print-area"></div>

{SCRIPTS('js/vendor/qrcode.js','js/vendor/inflate.js','js/common.js','js/config.js','js/cloud.js','js/new.js','js/pay.js','js/pro.js')}</body>
</html>
'''
open('new.html','w').write(new)

# ---------------- tarify ----------------
def li(txt, soon=False): return f'<li><svg><use href="#i-check"/></svg><span>{txt}</span>{"<em>скоро</em>" if soon else ""}</li>'
tar=head('Тарифы и ВЕЗУ Про — визитки водителей','Базовая визитка водителя — бесплатно. ВЕЗУ Про, печать визиток и наклейки на машину, реклама для партнёров.','tarify.html')+f'''
<header class="top">
  <div class="wrap">
    {LOGO('тарифы')}
    <nav class="topnav"><a href="catalog.html">Водители</a><a class="btn btn-glass btn-sm" href="new.html">Создать визитку</a></nav>
  </div>
</header>

<main class="wrap tarify">
  <h1>Тарифы <span class="grad-text">ВЕЗУ</span></h1>
  <p class="muted lead2">Визитка водителя бесплатна. Платно — то, что экономит ваше время.</p>

  <div class="plans">
    <section class="plan glass">
      <h2>Базовая</h2>
      <p class="price">0 ₸<small>навсегда</small></p>
      <ul>{li('Визитка-ссылка и QR-код')}{li('Кнопки WhatsApp и «Позвонить»')}{li('Печать визиток и наклейки сами')}{li('Русский и казахский')}</ul>
      <a class="btn btn-glass btn-block" href="new.html">Создать визитку</a>
    </section>
    <section class="plan glass glow pro">
      <span class="tag-soon">7 дней бесплатно</span>
      <h2>Про</h2>
      <p class="price">1 500 ₸<small>в месяц · первые 7 дней бесплатно</small></p>
      <ul>{li('Короткий адрес: …/dogruz/ваше-имя')}{li('Фото видят все клиенты')}{li('Место в каталоге водителей')}{li('Статистика: просмотры, WhatsApp, звонки')}{li('Без надписи «Сделано на ВЕЗУ»')}</ul>
      <a class="btn btn-grad btn-block" href="new.html">Попробовать 7 дней бесплатно</a>
      <button type="button" class="btn btn-wa btn-block" id="payPro"><svg><use href="#i-wa"/></svg>Оплатить через Kaspi</button>
    </section>
    <section class="plan glass">
      <h2>Визитки + наклейка</h2>
      <p class="price">Уточняйте<small>печать под ключ</small></p>
      <ul>{li('Пачка бумажных визиток с QR')}{li('Наклейка с QR на машину')}{li('Под цвет вашей визитки')}</ul>
      <button type="button" class="btn btn-wa btn-block" data-wa="print"><svg><use href="#i-wa"/></svg>Заказать печать</button>
    </section>
  </div>

  <div class="plans2">
    <section class="plan glass mini">
      <h2>Партнёрам</h2>
      <p class="muted">СТО, шиномонтаж, строймагазины, мебельные: реклама на визитках водителей и на сайте ВЕЗУ.</p>
      <button type="button" class="btn btn-glass btn-sm" data-wa="partner"><svg><use href="#i-wa"/></svg>Обсудить</button>
    </section>
    <section class="plan glass mini">
      <h2>Приведи водителя</h2>
      <p class="muted">Знакомый водитель создал визитку по вашей ссылке и сохранил её в облаке — вам <b>+7 дней Про</b>. За каждого нового водителя (новый номер). Ваша ссылка — в конструкторе: шаг 3 → «ВЕЗУ Про».</p>
      <p class="fine" id="refInfo" hidden></p>
      <button type="button" class="btn btn-glass btn-sm" id="shareApp"><svg><use href="#i-share"/></svg>Пригласить водителя</button>
    </section>
  </div>
  <p class="fine">Про включается в конструкторе: шаг 3 → «ВЕЗУ Про» → «Сохранить в облаке» (регистрация не нужна). Оплата — перевод Kaspi на номер +7 771 410 57 97, затем «Я оплатил»: Про продлеваем вручную, обычно в течение дня. Если не продлить — визитка-ссылка и короткий адрес продолжают работать, без фото, каталога и статистики. Базовая визитка — бесплатно навсегда.</p>
</main>
{FOOT}
{SCRIPTS('js/vendor/inflate.js','js/common.js','js/config.js','js/cloud.js','js/pay.js')}<script>
(function () {{
  var V = window.VEZU, C = window.VZC, mine = '', card = null;
  try {{ var d = JSON.parse(localStorage.getItem('vezu-card') || 'null'); if (d && d.n && d.p) mine = V.cardUrl(d); }} catch (e) {{}}
  try {{ var sl = JSON.parse(localStorage.getItem('vezu-cloud-slug') || 'null'); if (sl) mine = location.href.replace(/[^/]*$/, '') + sl; }} catch (e) {{}}
  var T = {{
    print: 'Здравствуйте! Хочу заказать печать визиток и наклейку на машину (ВЕЗУ).',
    partner: 'Здравствуйте! Интересует реклама/партнёрство с ВЕЗУ.'
  }};
  document.querySelectorAll('[data-wa]').forEach(function (b) {{
    b.addEventListener('click', function () {{ V.openWA(V.SITE_PHONE, T[b.dataset.wa] + (mine ? '\\nМоя визитка: ' + mine : '')); }});
  }});
  function invite() {{ return location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '') + 'new.html' + (card && card.ref_code ? '?ref=' + card.ref_code : ''); }}
  if (C && C.key()) C.ready().then(function (ok) {{
    if (ok) return C.rpc('vz_me', {{ p_key: C.key() }}).then(function (c) {{
      card = c;
      if (c && c.ref_code) {{ var el = document.getElementById('refInfo'); el.hidden = false; el.innerHTML = 'Пришло по вашей ссылке: <b>' + (c.ref_count || 0) + '</b>'; }}
    }});
  }}).catch(function () {{}});
  document.getElementById('payPro').addEventListener('click', function () {{ window.VEZU_PAY.open(card); }});
  document.getElementById('shareApp').addEventListener('click', function () {{
    V.share('ВЕЗУ — визитка водителя', 'Сделай бесплатную визитку водителя с WhatsApp и QR:', invite());
  }});
}})();
</script>
</body>
</html>
'''
open('tarify.html','w').write(tar)

# ---------------- catalog ----------------
cat=head('Водители ВЕЗУ — каталог грузоперевозок до 3 тонн','Водители грузотакси с визитками ВЕЗУ: Газель, Каблук, грузовик до 3 т. Фильтр по городу, машине и услугам. Пишите напрямую в WhatsApp.','catalog.html')+f'''
<header class="top">
  <div class="wrap">
    {LOGO('каталог водителей')}
    <nav class="topnav"><a href="tarify.html">Тарифы</a><a class="btn btn-glass btn-sm" href="new.html">Я водитель</a></nav>
  </div>
</header>
<main class="wrap catalog">
  <h1>Водители <span class="grad-text">ВЕЗУ</span> <small class="muted" id="cnt"></small></h1>
  <p class="muted lead2">Пишите водителю напрямую в WhatsApp — без посредников и комиссий.</p>
  <section class="filters glass f" id="filters">
    <label class="fld"><span>Город</span><input class="inp" id="city" list="citylist" placeholder="Любой город" maxlength="40"></label>
    <datalist id="citylist"></datalist>
    <div class="fld"><span>Машина</span><div class="qchips" id="vehf"></div></div>
    <div class="fld"><span>Что нужно</span><div class="qchips" id="svcf"></div></div>
  </section>
  <section class="cat-list" id="list" aria-live="polite"></section>
  <p class="fine">В каталоге — водители с активным ВЕЗУ Про; сначала те, кто оплатил Про, потом новые. ВЕЗУ не проверяет водителей и не отвечает за перевозку — договаривайтесь напрямую.</p>
</main>
{FOOT}
{SCRIPTS('js/common.js','js/config.js','js/cloud.js','js/catalog.js')}</body>
</html>
'''
open('catalog.html','w').write(cat)
# ---------------- admin ----------------
adm=head('Админка — ВЕЗУ','Служебная страница','admin.html',robots='\n<meta name="robots" content="noindex, nofollow">')+f'''
<header class="top">
  <div class="wrap">
    {LOGO('админка')}
    <nav class="topnav"><a href="catalog.html">Каталог</a></nav>
  </div>
</header>
<main class="wrap admin" id="adm"><p class="muted">Загрузка…</p></main>
{SCRIPTS('js/common.js','js/config.js','js/cloud.js','js/admin.js')}</body>
</html>
'''
open('admin.html','w').write(adm)
# ---------------- короткие адреса: /dogruz/<slug> и /dogruz/d/?<slug> ----------------
REDIR='''<script>
(function () {{
  var p = location.pathname, m = /^(.*\\/)([A-Za-z0-9-]{{3,20}})\\/?$/.exec(p), q = location.search.replace(/^\\?/, '');
  var base = m ? m[1] : p.replace(/[^/]*$/, ''), slug = '';
  if ({mode} === 'd') {{ base = p.replace(/d\\/(index\\.html)?$/, ''); slug = q.split('&')[0]; }}
  else if (m && !/\\.[a-z]+$/i.test(p)) slug = m[2];
  slug = slug.toLowerCase();
  if (/^[a-z0-9][a-z0-9-]{{1,18}}[a-z0-9]$/.test(slug)) location.replace(base + 'card.html?u=' + slug);
  else document.getElementById('nf').hidden = false;
}})();
</script>'''
def redirect_page(mode, prefix):
    return f'''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ВЕЗУ — визитка водителя</title>
<meta name="robots" content="noindex">
<meta property="og:title" content="Визитка водителя — ВЕЗУ">
<meta property="og:description" content="Грузоперевозки до 3 тонн. Напишите водителю в WhatsApp или позвоните.">
<meta property="og:image" content="{BASE}og.png">
<meta name="theme-color" content="#06061a">
<style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#06061a;color:#f2f1ff;font:16px/1.5 system-ui,sans-serif;text-align:center}}a{{color:#7fe7ff}}</style>
</head>
<body>
<main><p>Открываем визитку…</p><div id="nf" hidden><h1>Страница не найдена</h1><p><a href="{BASE}">На главную ВЕЗУ</a> · <a href="{BASE}catalog.html">Водители</a></p></div></main>
{REDIR.format(mode=repr(mode))}
</body>
</html>
'''
open('404.html','w').write(redirect_page('404',''))
os.makedirs('d', exist_ok=True)
open('d/index.html','w').write(redirect_page('d','../'))
print('ok')

