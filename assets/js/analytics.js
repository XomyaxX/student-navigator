/*
 * analytics.js — единый помощник для целей и событий.
 *   reachGoal('goal_name', {param: 'value'})
 * Отправляет цель во все установленные счётчики:
 *   • Яндекс Метрика:   ym(ID, 'reachGoal', name, params)
 *   • Top.Mail.ru / VK: _tmr.push({id, type:'reachGoal', goal:name, value})
 *   • Топ-100 / SberAds: top100Counter.trackEvent(name, params)
 *   • LiveInternet — API целей нет, поэтому не используется.
 * Плюс dataLayer (на случай GTM) и вывод в консоль в режиме отладки.
 * Имена целей — латиница, цифры, «_» и «-» (требование Топ-100).
 */
(function () {
  'use strict';
  var cfg = window.WA_CONFIG || (window.WA_CONFIG = {});
  var debug = !!cfg.debug || /[?&]debug_goals=1/.test(location.search);
  try { if (localStorage.getItem('debug_goals') === '1') debug = true; } catch (e) {}

  function detectYandexId() {
    if (cfg.yandexId) return cfg.yandexId;
    try {
      var q = window.ym && window.ym.a;
      if (q) for (var i = 0; i < q.length; i++) if (q[i][1] === 'init') return q[i][0];
      for (var k in window) if (/^yaCounter\d+$/.test(k)) return +k.slice(9);
    } catch (e) {}
    return null;
  }

  var fired = {};
  function reachGoal(name, params, opts) {
    params = params || {};
    opts = opts || {};
    if (opts.once) { if (fired[name]) return []; fired[name] = true; }
    var sent = [];
    var ymId = detectYandexId();
    try { if (typeof window.ym === 'function' && ymId) { window.ym(ymId, 'reachGoal', name, params); sent.push('yandex'); } } catch (e) {}
    try {
      if (cfg.mailruId) {
        var t = { id: String(cfg.mailruId), type: 'reachGoal', goal: name };
        if (typeof params.value === 'number') t.value = params.value;
        (window._tmr = window._tmr || []).push(t); sent.push('mailru');
      }
    } catch (e) {}
    try { if (window.top100Counter && typeof window.top100Counter.trackEvent === 'function') { window.top100Counter.trackEvent(name, params); sent.push('top100'); } } catch (e) {}
    (window.dataLayer = window.dataLayer || []).push({ event: 'reachGoal', goal: name, goalParams: params });
    if (debug && window.console) console.info('[reachGoal]', name, params, sent.length ? '→ ' + sent.join(', ') : '(счётчики не подключены)');
    return sent;
  }
  window.reachGoal = reachGoal;

  // Отправка «параметров визита» в Метрику (необязательно).
  window.sendVisitParams = function (obj) {
    var id = detectYandexId();
    if (typeof window.ym === 'function' && id) window.ym(id, 'params', obj);
  };

  var FILE_RE = /\.(pdf|docx?|xlsx?|pptx?|csv|ics|zip|rar|7z|txt|rtf|odt)(\?|#|$)/i;

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('a,button,[data-goal]');
    if (!el) return;
    // 1) Явные цели: data-goal="name" (+ data-goal-params='{"k":"v"}')
    var g = el.getAttribute('data-goal');
    if (g) {
      var p = {};
      try { p = JSON.parse(el.getAttribute('data-goal-params') || '{}'); } catch (e) {}
      reachGoal(g, p);
    }
    if (el.tagName !== 'A' || !el.href) return;
    var url;
    try { url = new URL(el.href, location.href); } catch (e) { return; }
    // 2) Скачивание файлов (Метрика считает загрузки сама при trackLinks:true; дублируем целью)
    if (FILE_RE.test(url.pathname) && url.host === location.host) {
      reachGoal('file_download', { file: url.pathname.split('/').pop() });
    // 3) Внешние ссылки
    } else if (/^https?:$/.test(url.protocol) && url.host !== location.host) {
      reachGoal('outbound_click', { host: url.host });
    } else if (url.protocol === 'mailto:' || url.protocol === 'tel:') {
      reachGoal('contact_link_click', { type: url.protocol.replace(':', '') });
    }
  }, true);

  // 4) Глубина прокрутки (25/50/75/90 %) — по одной цели на страницу
  var marks = [25, 50, 75, 90];
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    if (max <= 0) return;
    var pct = Math.round((h.scrollTop || document.body.scrollTop) / max * 100);
    while (marks.length && pct >= marks[0]) {
      var m = marks.shift();
      reachGoal('scroll_' + m, { page: location.pathname }, { once: false });
    }
    if (!marks.length) window.removeEventListener('scroll', onScroll);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // 5) Активное чтение: 60 секунд на странице при видимой вкладке
  var active = 0;
  var timer = setInterval(function () {
    if (document.visibilityState === 'visible') active += 5;
    if (active >= 60) { clearInterval(timer); reachGoal('engaged_60s', { page: location.pathname }); }
  }, 5000);
})();
