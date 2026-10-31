/* ВЕЗУ: калькулятор ПРИМЕРНОЙ цены по простому правилу (мин. заказ + км × тариф + грузчики + этажи).
   Тарифы: водителя (d.rt, в конструкторе) или тарифы по умолчанию, которые владелец задаёт в админке (vz_settings.calc_rates).
   Своих «рыночных» цен в коде нет: если тарифы не заданы — цену не показываем, только расстояние. */
(function () {
  'use strict';
  var V = window.VEZU; if (!V) return;
  // min — минимальный заказ (включает inc км по городу), city/inter — ₸ за км, loader — ₸ за грузчика, floor — ₸ за этаж без лифта
  var KEYS = ['min', 'city', 'inter', 'loader', 'floor', 'inc'];
  var OWNER = '';                // тарифы владельца (строка того же формата), грузятся из базы
  try { OWNER = JSON.parse(localStorage.getItem('vezu-rates') || '""') || ''; } catch (e) {}
  var RATES = parse(OWNER);
  function parse(rt) { var r = {}, a = String(rt || '').split(','); KEYS.forEach(function (k, i) { var v = parseInt(a[i], 10); r[k] = isFinite(v) && a[i] !== '' && a[i] != null ? v : null; }); return r; }
  // rt — строка «мин,км город,км межгород,грузчик,этаж,км в минимуме»; пустые поля — из тарифов владельца.
  // Нет мин. заказа или тарифа за км → null (цену не считаем). Грузчик/этаж/км в минимуме без значения = 0.
  function rates(rt) {
    var a = parse(rt), o = parse(OWNER), r = {};
    KEYS.forEach(function (k) { r[k] = a[k] != null ? a[k] : o[k]; });
    if (r.min == null || r.city == null || r.inter == null) return null;
    ['loader', 'floor', 'inc'].forEach(function (k) { if (r[k] == null) r[k] = 0; });
    r.own = !!String(rt || '').replace(/,/g, '');
    return r;
  }
  var waiters = [];
  function load() {
    var CFG = window.VEZU_CFG || {}; if (!CFG.SUPABASE_URL || CFG.FORCE_OFF || !window.fetch) return;
    fetch(CFG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/vz_calc_rates', { method: 'POST', headers: { apikey: CFG.SUPABASE_KEY, 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (v) {
      v = typeof v === 'string' ? v : '';
      if (v === OWNER) return;
      OWNER = v; RATES = parse(v); try { localStorage.setItem('vezu-rates', JSON.stringify(v)); } catch (e) {}
      waiters.forEach(function (f) { try { f(); } catch (e) {} });
    }, function () {});
  }
  function packRates(o) { var s = KEYS.map(function (k) { return o[k] === '' || o[k] == null ? '' : String(parseInt(o[k], 10) || 0); }).join(','); return /^,*$/.test(s) ? '' : s; }
  function r500(x) { return Math.round(x / 500) * 500; }
  function estimate(o, R) {      // o: {km, inter, loaders, floors}
    if (!R) return null;
    var km = Math.max(0, +o.km || 0), lines = [], base;
    if (o.inter) { base = Math.max(R.min, km * R.inter); lines.push(['Межгород ' + km + ' км × ' + V.fmtNum(R.inter) + ' ₸', base]); }
    else { base = R.min + Math.max(0, km - R.inc) * R.city; lines.push(['Минимальный заказ (до ' + R.inc + ' км)', R.min]); if (km > R.inc) lines.push(['+' + Math.round(km - R.inc) + ' км × ' + V.fmtNum(R.city) + ' ₸', base - R.min]); }
    var total = base;
    if (o.loaders && R.loader) { total += o.loaders * R.loader; lines.push(['Грузчики: ' + o.loaders + ' × ' + V.fmtNum(R.loader) + ' ₸', o.loaders * R.loader]); }
    if (o.floors && R.floor) { total += o.floors * R.floor; lines.push(['Этажи без лифта: ' + o.floors + ' × ' + V.fmtNum(R.floor) + ' ₸', o.floors * R.floor]); }
    var lo = r500(total), hi = r500(total * 1.2 + 250);
    return { lo: lo, hi: Math.max(hi, lo + 500), lines: lines };
  }
  function nb(n) { return V.fmtNum(n).replace(/ /g, '\u00a0'); }
  function rangeText(e) { return 'примерно ' + nb(e.lo) + ' – ' + nb(e.hi) + '\u00a0₸'; }

  // ---------- расстояние ----------
  function tfetch(url, ms) {
    var ctl = window.AbortController ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 8000);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(tm); if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }
  var gcache = {};
  function geocode(q, city) {
    q = String(q || '').trim(); if (!q) return Promise.reject(new Error('empty'));
    var m = q.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
    if (m) return Promise.resolve({ lat: +m[1], lon: +m[2] });
    if (city && q.toLowerCase().indexOf(city.toLowerCase()) < 0) q += ', ' + city;
    if (gcache[q]) return Promise.resolve(gcache[q]);
    return tfetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kz&accept-language=ru&q=' + encodeURIComponent(q), 8000)
      .then(function (j) { if (!j || !j[0]) throw new Error('notfound'); return (gcache[q] = { lat: +j[0].lat, lon: +j[0].lon }); });
  }
  function straight(a, b) {
    var R = 6371, rad = Math.PI / 180, dLa = (b.lat - a.lat) * rad, dLo = (b.lon - a.lon) * rad;
    var h = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function route(a, b) {
    return tfetch('https://router.project-osrm.org/route/v1/driving/' + a.lon + ',' + a.lat + ';' + b.lon + ',' + b.lat + '?overview=false', 9000)
      .then(function (j) { if (!j || j.code !== 'Ok' || !j.routes[0]) throw new Error('noroute'); return { km: j.routes[0].distance / 1000, how: 'route' }; })
      .catch(function () { return { km: straight(a, b) * 1.3, how: 'line' }; });
  }
  function dirLink(a, b) { return 'https://www.google.com/maps/dir/?api=1&origin=' + a.lat.toFixed(6) + ',' + a.lon.toFixed(6) + '&destination=' + b.lat.toFixed(6) + ',' + b.lon.toFixed(6) + '&travelmode=driving'; }
  function gis(g) { return 'https://2gis.kz/geo/' + g.lon.toFixed(6) + ',' + g.lat.toFixed(6); }

  // ---------- виджет в форме заказа ----------
  // opts: { rates: fn → строка rt, city: fn → город-подсказка }
  function bind(form, opts) {
    opts = opts || {};
    var box = document.createElement('details');
    box.className = 'calc'; box.open = true;
    box.innerHTML = '<summary><svg><use href="#i-calc"/></svg><b>Калькулятор цены</b><span class="calc-sum" data-sum></span></summary>' +
      '<div class="calc-b">' +
      '<div class="qchips seg" data-c="inter"><button type="button" class="qchip on" data-v="0">По городу</button><button type="button" class="qchip" data-v="1">Межгород</button></div>' +
      '<div class="calc-row"><label class="fld"><span>Расстояние</span><input class="inp" name="km" inputmode="decimal" placeholder="км" maxlength="6"><b class="suffix">км</b></label>' +
      '<button type="button" class="btn btn-glass btn-sm" data-route>Посчитать маршрут</button></div>' +
      '<p class="calc-msg" data-msg aria-live="polite" hidden></p>' +
      '<div class="fld"><span>Грузчики</span><div class="qchips" data-c="loaders"><button type="button" class="qchip on" data-v="0">Не нужны</button><button type="button" class="qchip" data-v="1">1</button><button type="button" class="qchip" data-v="2">2</button><button type="button" class="qchip" data-v="3">3</button><button type="button" class="qchip" data-v="4">4</button></div></div>' +
      '<label class="fld"><span>Этажей без лифта (погрузка + выгрузка)</span><input class="inp" name="floors" inputmode="numeric" placeholder="0 — есть лифт или 1 этаж" maxlength="2"></label>' +
      '<div class="calc-out" data-out hidden></div>' +
      '</div>';
    var submit = opts.anchor || form.querySelector('[type=submit]');
    submit.parentNode.insertBefore(box, submit);
    var st = { inter: 0, loaders: 0, km: null, how: '', a: null, b: null, touchedInter: false, manual: false };
    var km = box.querySelector('[name=km]'), fl = box.querySelector('[name=floors]'), msg = box.querySelector('[data-msg]'), out = box.querySelector('[data-out]'), sum = box.querySelector('[data-sum]');
    var from = form.querySelector('[name=from]'), to = form.querySelector('[name=to]'), what = form.querySelector('[name=what]');
    var cargo = form.querySelector('input[name=cargo]');
    function say(t, err) { msg.textContent = t || ''; msg.hidden = !t; msg.classList.toggle('err', !!err); }
    box.querySelectorAll('[data-c]').forEach(function (g) {
      g.addEventListener('click', function (e) {
        var b = e.target.closest('[data-v]'); if (!b) return;
        g.querySelectorAll('.qchip').forEach(function (x) { x.classList.toggle('on', x === b); });
        st[g.dataset.c] = +b.dataset.v; if (g.dataset.c === 'inter') st.touchedInter = true;
        calc();
      });
    });
    function setInter(v) { st.inter = v; box.querySelectorAll('[data-c=inter] .qchip').forEach(function (x) { x.classList.toggle('on', +x.dataset.v === v); }); }
    km.addEventListener('input', function () { km.value = km.value.replace(/[^\d.,]/g, '').slice(0, 6); st.manual = true; st.how = 'manual'; calc(); });
    fl.addEventListener('input', function () { fl.value = fl.value.replace(/\D/g, '').slice(0, 2); calc(); });
    if (what) what.addEventListener('input', calc);
    if (cargo) cargo.addEventListener('input', calc);
    function R() { return rates(opts.rates && opts.rates()); }
    function calc() {
      var k = parseFloat(String(km.value).replace(',', '.'));
      if (!isFinite(k) || k <= 0) { form._calc = null; out.hidden = true; sum.textContent = ''; return; }
      var o = { km: Math.round(k), inter: st.inter, loaders: st.loaders, floors: +fl.value || 0 };
      var r = R(), e = estimate(o, r);
      out.hidden = false;
      form._calc = { km: o.km, how: st.how, inter: o.inter, loaders: o.loaders, floors: o.floors, a: st.a, b: st.b };
      if (!e) {
        out.innerHTML = '<p class="calc-range calc-km">~' + o.km + ' км</p><p class="fine">Цену предложат водители — сравните предложения и выберите.</p>';
        sum.textContent = '~' + o.km + ' км'; return;
      }
      out.innerHTML = '<p class="calc-range">' + rangeText(e) + '</p><ul>' + e.lines.map(function (l) { return '<li><span>' + V.esc(l[0]) + '</span><b>' + V.fmtNum(l[1]) + ' ₸</b></li>'; }).join('') + '</ul>' +
        '<p class="fine"><b>Примерно</b> — по простому правилу: минимальный заказ + км × тариф + грузчики + этажи, верхняя граница +20%. Тарифы — ' +
        (r.own ? 'этого водителя' : 'по умолчанию ВЕЗУ') + '. Это не рыночная цена: точную назовёт водитель.</p>';
      sum.textContent = '≈\u00a0' + nb(e.lo) + '–' + nb(e.hi) + '\u00a0₸';
      form._calc.lo = e.lo; form._calc.hi = e.hi;
    }
    waiters.push(calc);
    var seq = 0;
    function measure(auto) {
      var f = from.value.trim(), t = to.value.trim();
      if (!f || !t) { if (!auto) say('Укажите «Откуда» и «Куда» — или введите километры вручную.', true); return Promise.resolve(); }
      var my = ++seq, city = opts.city && opts.city();
      say('Считаю маршрут…');
      var pa = form._geo && form._geoAddr === f ? Promise.resolve(form._geo) : geocode(f, city);
      return pa.then(function (a) {
        return new Promise(function (ok) { setTimeout(ok, 1100); }).then(function () { return geocode(t, city); }).then(function (b) { return [a, b]; });
      }).then(function (ab) {
        return route(ab[0], ab[1]).then(function (r) {
          if (my !== seq) return;
          st.a = ab[0]; st.b = ab[1]; st.how = r.how; st.manual = false;
          km.value = String(Math.max(1, Math.round(r.km)));
          if (!st.touchedInter) setInter(r.km > 50 ? 1 : 0);
          say(r.how === 'route' ? 'Маршрут: ' + km.value + ' км по дорогам.' : 'Примерно ' + km.value + ' км (по прямой × 1,3) — маршрут не построился.');
          calc();
        });
      }, function () {
        if (my !== seq) return;
        st.a = st.b = null;
        say('Не нашли адрес на карте — введите расстояние в км вручную.', true);
        km.focus({ preventScroll: false });
      });
    }
    box.querySelector('[data-route]').addEventListener('click', function () { measure(false); });
    var tmr;
    function auto() { clearTimeout(tmr); tmr = setTimeout(function () { if (!st.manual || !km.value) measure(true); }, 900); }
    from.addEventListener('change', function () { form._geoAddr = form._geo ? from.value.trim() : null; auto(); });
    to.addEventListener('change', auto);
    form._calcReset = function () { km.value = ''; fl.value = ''; st.manual = false; calc(); };
    return { calc: calc, measure: measure };
  }
  function lines(c) {
    if (!c) return [];
    var L = ['Расстояние: ~' + c.km + ' км' + (c.how === 'route' ? ' по маршруту' : c.how === 'line' ? ' (примерно)' : '') + (c.inter ? ', межгород' : ', по городу')];
    if (c.loaders) L.push('Грузчики: ' + c.loaders);
    if (c.floors) L.push('Этажей без лифта: ' + c.floors);
    if (c.lo) L.push('Примерная оценка (по тарифам калькулятора): ' + V.fmtNum(c.lo) + ' – ' + V.fmtNum(c.hi) + ' ₸');
    if (c.a && c.b) { L.push('Маршрут на карте: ' + dirLink(c.a, c.b)); L.push('Куда (2ГИС): ' + gis(c.b)); }
    return L;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else setTimeout(load, 0);
  window.VEZU_CALC = { get RATES() { return RATES; }, owner: function () { return OWNER; }, onRates: function (f) { waiters.push(f); }, KEYS: KEYS, rates: rates, packRates: packRates, estimate: estimate, rangeText: rangeText, bind: bind, lines: lines, geocode: geocode, route: route };
})();
