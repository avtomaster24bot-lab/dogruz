#!/usr/bin/env python3
"""Страницы-превью для коротких адресов ВЕЗУ Про: …/dogruz/<адрес>.html (GitHub Pages отдаёт её по …/dogruz/<адрес> без редиректа).

GitHub Pages — статический хостинг, а WhatsApp/Telegram не выполняют JS, поэтому превью
(имя, машина, город, фото водителя) берём из статических Open Graph тегов. Скрипт получает
список визиток из Supabase (RPC vz_og_list, защищён токеном VZ_OG_TOKEN — секрет репозитория)
и пишет по папке на каждый адрес. Человека страница сразу перекидывает на card.html?u=<адрес>.
Запускается GitHub Actions (.github/workflows/og-pages.yml) по расписанию.
Только stdlib. Удаляет лишь папки из своего манифеста tools/og-slugs.json.
"""
import html, json, os, re, shutil, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, 'tools', 'og-slugs.json')
SITE = os.environ.get('VZ_SITE', 'https://avtomaster24bot-lab.github.io/dogruz/')
URL = os.environ.get('VZ_SUPABASE_URL', 'https://sfgrwquitlnzlkyzashb.supabase.co').rstrip('/')
KEY = os.environ.get('VZ_SUPABASE_KEY', 'sb_publishable_YAwB9N3mFTTnrb4SjD4-TQ_equzK7-s')
SLUG = re.compile(r'^[a-z0-9]([a-z0-9-]{1,18})[a-z0-9]$')
VEH = {'kabluk': ('Каблук', '0,5 т'), 'gazel': ('Газель', '1,5 т'), 'gazel-long': ('Газель удлинённая', '2 т'), 'truck3': ('Грузовик', '3 т')}


def fetch(token):
    req = urllib.request.Request(URL + '/rest/v1/rpc/vz_og_list', data=json.dumps({'p_token': token}).encode(),
                                 headers={'apikey': KEY, 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def fmt_num(s):
    s = re.sub(r'\D', '', str(s or ''))
    return re.sub(r'\B(?=(\d{3})+(?!\d))', '\u00a0', s)


def page(c):
    slug = c['slug']
    name = (c.get('n') or 'Водитель').strip()[:40]
    car = (c.get('c') or '').strip()   # тип машины по весу не угадываем — только то, что написал водитель
    w = (c.get('w') or '').strip() or VEH.get(c.get('veh') or '', ('', ''))[1]
    city = (c.get('t') or '').strip()
    title = name + ' — грузоперевозки' + (', ' + car + (' ' + w if w else '') if car else (' до ' + w if w else ''))
    bits = [x for x in [city] if x]
    if c.get('pr'):
        bits.append('от ' + fmt_num(c['pr']) + ' ₸ ' + ('в час' if str(c.get('pu')) == '1' else 'за рейс'))
    desc = ' · '.join(bits + ['Заказ в WhatsApp в один клик'])
    own = 'img/own/' + re.sub(r'\D', '', str(c.get('p') or '')) + '.jpg'
    if c.get('p') and os.path.isfile(os.path.join(ROOT, own)):
        img, iw, ih = SITE + own, 1040, 638
    elif c.get('photo'):
        img, iw, ih = URL + '/storage/v1/object/public/vz_photos/' + c['photo'], 256, 256
    elif c.get('veh') in VEH:
        img, iw, ih = SITE + 'img/og-' + c['veh'] + '.jpg', 1200, 630
    else:
        img, iw, ih = SITE + 'og.png', 1200, 630
    url = SITE + slug
    e = lambda s: html.escape(s, quote=True)
    js_slug = json.dumps(slug)
    phone = re.sub(r'\D', '', str(c.get('p') or ''))
    keep = {k: c[k] for k in ('n', 'c', 'w', 't', 'pr', 'pu') if c.get(k) not in (None, '')}
    if phone: keep['p'] = phone
    # запасные данные для card.html (если облако не ответит) + сама страница показывает имя и WhatsApp без JS
    js_data = json.dumps(keep, ensure_ascii=False).replace('<', '\\u003c')
    wa = f'<p><a class="b" href="https://wa.me/{phone}">Написать в WhatsApp</a></p>' if phone else ''
    return f'''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{e(url)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="ВЕЗУ">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{e(img)}">
<meta property="og:image:width" content="{iw}">
<meta property="og:image:height" content="{ih}">
<meta property="og:image:alt" content="{e(name)}">
<meta name="twitter:card" content="{'summary' if iw == 256 else 'summary_large_image'}">
<meta name="theme-color" content="#06061a">
<style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#06061a;color:#f2f1ff;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:20px;box-sizing:border-box}}a{{color:#7fe7ff}}h1{{font-size:26px;margin:0 0 6px}}.b{{display:inline-block;margin-top:8px;padding:12px 22px;border-radius:14px;background:#25d366;color:#04210f;font-weight:700;text-decoration:none}}</style>
<script>try{{sessionStorage.setItem('vezu-og-' + {js_slug}, JSON.stringify({js_data}));}}catch(e){{}}
location.replace('card.html?u=' + {js_slug} + location.hash);</script>
</head>
<body>
<main><h1>{e(name)}</h1><p>{e(desc)}</p>{wa}<p><a href="card.html?u={e(slug)}">Открыть визитку →</a></p></main>
</body>
</html>
'''


def main():
    token = os.environ.get('VZ_OG_TOKEN', '').strip()
    if not token:
        sys.exit('VZ_OG_TOKEN не задан')
    cards = [c for c in fetch(token) if SLUG.match(c.get('slug') or '') and '--' not in c['slug']]
    try:
        old = set(json.load(open(MANIFEST)))
    except FileNotFoundError:
        old = set()
    new = set()
    # старый формат (папка <адрес>/index.html, давал редирект 301) — убрать
    for sl in sorted(old):
        d = os.path.join(ROOT, sl)
        if SLUG.match(sl) and os.path.isdir(d) and os.path.isfile(os.path.join(d, 'index.html')):
            shutil.rmtree(d); print('remove legacy dir', sl)
    for c in cards:
        f = os.path.join(ROOT, c['slug'] + '.html')
        if os.path.exists(f) and c['slug'] not in old:
            print('skip (не наш файл):', c['slug']); continue
        body = page(c)
        if not os.path.exists(f) or open(f, encoding='utf-8').read() != body:
            open(f, 'w', encoding='utf-8').write(body)
            print('write', c['slug'])
        new.add(c['slug'])
    for sl in sorted(old - new):
        f = os.path.join(ROOT, sl + '.html')
        if SLUG.match(sl) and os.path.isfile(f):
            os.remove(f); print('remove', sl)
    if new != old or not os.path.exists(MANIFEST):
        json.dump(sorted(new), open(MANIFEST, 'w'), indent=0)
        open(MANIFEST, 'a').write('\n')
    print(len(new), 'pages')


if __name__ == '__main__':
    main()
