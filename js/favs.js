/* ВЕЗУ: «Мои водители» — избранное клиента. Хранится на телефоне (localStorage), без аккаунта. */
(function () {
  'use strict';
  var V = window.VEZU; if (!V) return;
  var K = 'vezu-favs';
  function list() { try { var a = JSON.parse(localStorage.getItem(K) || '[]'); return Array.isArray(a) ? a.filter(function (x) { return x && x.slug; }) : []; } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(K, JSON.stringify(a.slice(0, 100))); } catch (e) {} fire(); }
  function sorted() { return list().sort(function (a, b) { return (b.pin || 0) - (a.pin || 0) || (b.at || 0) - (a.at || 0); }); }
  function has(slug) { return list().some(function (x) { return x.slug === slug; }); }
  function info(slug, d, photo) { return { slug: slug, n: d.n || '', c: d.c || '', w: d.w || '', t: d.t || '', p: d.p || '', photo: photo || '', at: Date.now() }; }
  function add(x) { var a = list().filter(function (y) { return y.slug !== x.slug; }); a.unshift(x); save(a); }
  function update(x) { var a = list(), i = a.map(function (y) { return y.slug; }).indexOf(x.slug); if (i < 0) return; x.pin = a[i].pin; x.at = a[i].at; a[i] = x; save(a); }
  function remove(slug) { save(list().filter(function (y) { return y.slug !== slug; })); }
  function pin(slug) { var a = list(); a.forEach(function (y) { if (y.slug === slug) y.pin = y.pin ? 0 : Date.now(); }); save(a); }
  function toggle(x) { if (has(x.slug)) { remove(x.slug); return false; } add(x); return true; }
  var subs = [];
  function fire() { subs.forEach(function (f) { try { f(); } catch (e) {} }); }
  window.addEventListener('storage', function (e) { if (e.key === K) fire(); });
  function btnHtml(slug, cls) {
    var on = has(slug);
    return '<button type="button" class="fav-btn' + (on ? ' on' : '') + (cls ? ' ' + cls : '') + '" data-fav="' + V.esc(slug) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Убрать из избранного' : 'В избранное') + '">' +
      '<svg><use href="#i-fav' + (on ? '-on' : '') + '"/></svg><span>' + (on ? 'В избранном' : 'В избранное') + '</span></button>';
  }
  // root — контейнер с кнопками [data-fav]; getInfo(slug) → объект для сохранения
  function bind(root, getInfo) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-fav]'); if (!b || !root.contains(b)) return;
      e.preventDefault(); e.stopPropagation();
      var x = getInfo(b.dataset.fav); if (!x) return;
      var on = toggle(x);
      b.outerHTML = btnHtml(x.slug, b.className.replace(/\bfav-btn\b|\bon\b/g, '').trim());
      V.toast(on ? '★ Добавлен в «Мои водители»' : 'Убран из «Моих водителей»');
    });
  }
  window.VEZU_FAV = { list: sorted, has: has, info: info, add: add, update: update, remove: remove, pin: pin, toggle: toggle, btnHtml: btnHtml, bind: bind, on: function (f) { subs.push(f); } };
})();
