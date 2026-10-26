/* Админка ВЕЗУ Про (admin.html): найти водителя и продлить Про после оплаты Kaspi. Вход — ключ админа. */
(function () {
  'use strict';
  var V = window.VEZU, C = window.VZC, app = document.getElementById('adm'), AK = 'vezu-admin';
  var akey = sessionStorage.getItem(AK) || localStorage.getItem(AK) || '', timer = 0;
  function esc(s) { return V.esc(s == null ? '' : String(s)); }
  function dt(s) { if (!s) return '—'; var d = new Date(s); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
  function call(fn, args) { return C.rpc(fn, Object.assign({ p_admin: akey }, args || {})); }

  function login(msg) {
    app.innerHTML = '<section class="glass panel f adm-login"><h1>Админка ВЕЗУ</h1><p class="muted">Введите ключ админа. Он хранится только у владельца; в базе — лишь его отпечаток (SHA-256).</p>' +
      '<input class="inp" id="ak" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" placeholder="Ключ админа">' +
      '<label class="check"><input type="checkbox" id="remember"><span>Запомнить на этом устройстве</span></label>' +
      '<button class="btn btn-grad btn-block" id="go" type="button">Войти</button>' + (msg ? '<p class="err-msg">' + esc(msg) + '</p>' : '') + '</section>';
    var go = function () {
      var v = document.getElementById('ak').value.trim();
      C.rpc('vz_is_admin', { p_admin: v }).then(function (ok) {
        if (!ok) return login('Ключ не подходит');
        akey = v; sessionStorage.setItem(AK, v);
        if (document.getElementById('remember').checked) localStorage.setItem(AK, v);
        main();
      }, function (e) { login(e.message); });
    };
    document.getElementById('go').addEventListener('click', go);
    document.getElementById('ak').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  function main() {
    app.innerHTML = '<div class="adm-head"><h1>Водители ВЕЗУ Про</h1><button class="lnk" id="out" type="button">Выйти</button></div>' +
      '<div class="adm-stats" id="st"></div>' +
      '<section class="adm-sec" id="reqs"></section><section class="adm-sec" id="exp"></section>' +
      '<h3>Все водители</h3>' +
      '<input class="inp" id="q" placeholder="Имя, телефон, адрес (slug), город или @telegram" autocomplete="off">' +
      '<label class="fld"><span>Комментарий к продлению (например: Kaspi 1 500 ₸, 26.10)</span><input class="inp" id="note" maxlength="200"></label>' +
      '<div id="rows" class="adm-rows"></div>';
    document.getElementById('out').addEventListener('click', function () { sessionStorage.removeItem(AK); localStorage.removeItem(AK); akey = ''; login(); });
    document.getElementById('q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(find, 300); });
    ['rows', 'reqs', 'exp'].forEach(function (id) { document.getElementById(id).addEventListener('click', act); });
    stats(); find(); lists();
  }
  function stats() {
    call('vz_admin_stats').then(function (s) {
      document.getElementById('st').innerHTML = [['Визиток', s.cards], ['Про активен', s.pro], ['Оплачено', s.paid], ['Пробных', s.trial], ['Просмотров за 7 дн.', s.views7]]
        .map(function (x) { return '<div><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('');
    }, function () {});
  }
  function row(r) {
    var pro = r.pro_until && new Date(r.pro_until) > new Date();
    return '<article class="adm-row glass" data-id="' + esc(r.id) + '">' +
      '<div class="adm-main"><b>' + esc(r.n) + '</b> <span class="muted">+' + esc(r.p) + '</span>' +
      (r.tg ? ' <span class="muted">@' + esc(r.tg) + '</span>' : '') + '<br>' +
      '<span class="muted">' + esc([r.c, r.city].filter(Boolean).join(' · ')) + '</span><br>' +
      (r.slug ? '<a href="' + esc(C.shortUrl(r.slug)) + '" target="_blank">/' + esc(r.slug) + '</a>' : '<span class="muted">без адреса</span>') +
      ' · <span class="pro-st ' + (pro ? 'ok' : 'off') + '">' + (pro ? 'Про до ' + dt(r.pro_until) + (r.is_paid ? '' : ' (пробный)') : 'без Про') + '</span>' +
      ' · просмотров за 30 дн.: ' + (r.views30 || 0) + (r.refs ? ' · пригласил: ' + r.refs : '') + (r.is_blocked ? ' · <b class="err-msg">скрыта</b>' : '') + (r.is_published ? '' : ' · не в каталоге') +
      ' · создана ' + dt(r.created_at) + '</div>' +
      '<div class="adm-act"><button class="btn btn-grad btn-sm" data-m="1">+1 мес</button><button class="btn btn-glass btn-sm" data-m="3">+3 мес</button>' +
      '<button class="btn btn-glass btn-sm" data-m="12">+12 мес</button><button class="lnk" data-m="0">Отключить Про</button>' +
      '<button class="lnk" data-block="' + (r.is_blocked ? 0 : 1) + '">' + (r.is_blocked ? 'Показать' : 'Скрыть') + '</button>' +
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
    if (b.dataset.m !== undefined) {
      var m = +b.dataset.m;
      if (m === 0 && !confirm('Отключить Про сейчас?')) return;
      call('vz_admin_extend', { p_card: id, p_months: m, p_note: note }).then(function (r) {
        V.toast(m ? 'Про продлён до ' + dt(r.pro_until) : 'Про отключён'); find(); stats(); lists();
      }, function (er) { V.toast(er.message); });
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

  C.ready().then(function (ok) {
    if (!ok) { app.innerHTML = '<section class="glass panel"><h1>Админка ВЕЗУ</h1><p class="muted">Облако ВЕЗУ ещё не подключено (нет функций vz_* в базе).</p></section>'; return; }
    if (!akey) return login();
    C.rpc('vz_is_admin', { p_admin: akey }).then(function (a) { if (a) main(); else { localStorage.removeItem(AK); sessionStorage.removeItem(AK); login(); } }, function (e) { login(e.message); });
  });
})();
