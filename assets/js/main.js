/* main.js — интерфейс сайта: меню, тема, формы, инструменты. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var goal = function (n, p) { if (window.reachGoal) window.reachGoal(n, p); };

  function toast(msg) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  // Меню
  var burger = $('.burger'), nav = $('.nav');
  if (burger) burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
    if (open) goal('menu_open');
  });

  // Тема
  var root = document.documentElement;
  try { var saved = localStorage.getItem('theme'); if (saved) root.setAttribute('data-theme', saved); } catch (e) {}
  var themeBtn = $('#theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    goal('theme_toggle', { theme: next });
  });

  // Наверх
  var toTop = $('.to-top');
  if (toTop) {
    window.addEventListener('scroll', function () { toTop.classList.toggle('show', window.scrollY > 900); }, { passive: true });
    toTop.addEventListener('click', function () { window.scrollTo({ top: 0 }); goal('to_top_click'); });
  }

  // Индикатор чтения + цель «дочитал до конца»
  var bar = $('.progress');
  if (bar) window.addEventListener('scroll', function () {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? h.scrollTop / max * 100 : 0) + '%';
  }, { passive: true });
  var endMark = $('#read-end');
  if (endMark && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { goal('guide_read_end'); io.disconnect(); }
    });
    io.observe(endMark);
  }

  // Копирование e-mail
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-copy');
      if (navigator.clipboard) navigator.clipboard.writeText(v).then(function () { toast('Скопировано: ' + v); });
      goal('copy_email');
    });
  });

  // Ссылки «Поделиться» с UTM-метками
  $$('[data-share]').forEach(function (a) {
    var net = a.getAttribute('data-share');
    var page = location.origin + location.pathname;
    var target = page + '?utm_source=' + net + '&utm_medium=social&utm_campaign=share_button';
    var title = document.title;
    if (net === 'vk') a.href = 'https://vk.com/share.php?url=' + encodeURIComponent(target) + '&title=' + encodeURIComponent(title);
    if (net === 'telegram') a.href = 'https://t.me/share/url?url=' + encodeURIComponent(target) + '&text=' + encodeURIComponent(title);
    if (net === 'copy') a.addEventListener('click', function (e) {
      e.preventDefault();
      var u = page + '?utm_source=copy&utm_medium=referral&utm_campaign=share_button';
      if (navigator.clipboard) navigator.clipboard.writeText(u);
      toast('Ссылка скопирована');
    });
    a.addEventListener('click', function () { goal('share_click', { network: net }); });
  });

  // ---------- Формы ----------
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validate(form) {
    var ok = true, firstBad = null;
    $$('[data-required]', form).forEach(function (f) {
      var msg = '';
      var v = f.type === 'checkbox' ? f.checked : (f.value || '').trim();
      if (!v) msg = f.getAttribute('data-required') || 'Заполните поле';
      else if (f.type === 'email' && !EMAIL_RE.test(v)) msg = 'Похоже, в адресе ошибка';
      else if (f.minLength > 0 && f.type !== 'checkbox' && v.length < f.minLength) msg = 'Минимум ' + f.minLength + ' символов';
      var box = form.querySelector('[data-error-for="' + f.name + '"]');
      if (box) box.textContent = msg;
      f.classList.toggle('invalid', !!msg);
      f.setAttribute('aria-invalid', !!msg);
      if (msg) { ok = false; if (!firstBad) firstBad = f; }
    });
    if (firstBad) firstBad.focus();
    return ok;
  }

  $$('form[data-form]').forEach(function (form) {
    var name = form.getAttribute('data-form'); // feedback | subscribe
    var started = false;
    form.addEventListener('input', function () {
      if (!started) { started = true; goal('form_' + name + '_start'); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); // никуда не отправляем — статический сайт
      if (!validate(form)) { goal('form_' + name + '_error'); return; }
      var params = { form: name };
      var topic = form.querySelector('[name=topic]');
      if (topic) params.topic = topic.value;
      goal('form_' + name + '_submit', params);
      var ok = form.parentNode.querySelector('.form-success');
      form.reset(); started = false;
      if (ok) { ok.classList.add('show'); form.style.display = 'none'; ok.focus && ok.focus(); }
      else toast('Спасибо! Готово.');
    });
  });
  $$('[data-form-again]').forEach(function (b) {
    b.addEventListener('click', function () {
      var wrap = b.closest('.form-wrap');
      wrap.querySelector('.form-success').classList.remove('show');
      wrap.querySelector('form').style.display = '';
    });
  });

  // ---------- Фильтр статей по хэшу (#study, #it ...) ----------
  var filterBox = $('.filters');
  if (filterBox) {
    var apply = function () {
      var h = (location.hash || '#all').slice(1);
      var isCat = $$('.filters a').some(function (a) { return a.getAttribute('href') === '#' + h; });
      var cat = isCat ? h : 'all';
      $$('.filters a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + cat); });
      $$('.article-card').forEach(function (c) {
        c.hidden = !(cat === 'all' || (c.getAttribute('data-cat') || '').split(' ').indexOf(cat) >= 0);
      });
    };
    window.addEventListener('hashchange', apply); apply();
    $$('.filters a').forEach(function (a) { a.addEventListener('click', function () { goal('article_filter', { cat: a.getAttribute('href').slice(1) }); }); });
  }

  // ---------- FAQ: открытие вопроса по хэшу ----------
  $$('details.faq').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) {
        if (history.replaceState) history.replaceState(null, '', '#' + d.id);
        goal('faq_open', { q: d.id });
      }
    });
  });
  if (location.hash) { var d0 = document.getElementById(location.hash.slice(1)); if (d0 && d0.tagName === 'DETAILS') d0.open = true; }

  // ---------- Калькулятор среднего балла ----------
  var gpa = $('#gpa-form');
  if (gpa) {
    var tbody = $('#gpa-rows');
    var addRow = function (subj, mark, cr) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><input type="text" name="subject" placeholder="Дисциплина" value="' + (subj || '') + '"></td>' +
        '<td style="width:120px"><select name="mark"><option value="5">5 (отл.)</option><option value="4">4 (хор.)</option><option value="3">3 (удовл.)</option><option value="2">2 (неуд.)</option></select></td>' +
        '<td style="width:110px"><input type="number" name="credits" min="1" max="30" value="' + (cr || 3) + '" aria-label="Зачётные единицы"></td>' +
        '<td style="width:44px"><button type="button" class="icon-btn" aria-label="Удалить строку">×</button></td>';
      if (mark) tr.querySelector('select').value = mark;
      tr.querySelector('button').addEventListener('click', function () { tr.remove(); });
      tbody.appendChild(tr);
    };
    [['Веб-аналитика', '5', 4], ['Базы данных', '4', 5], ['Иностранный язык', '5', 2]].forEach(function (r) { addRow(r[0], r[1], r[2]); });
    $('#gpa-add').addEventListener('click', function () { addRow(); goal('gpa_add_row'); });
    gpa.addEventListener('submit', function (e) {
      e.preventDefault();
      var sum = 0, w = 0, plain = 0, n = 0;
      $$('tr', tbody).forEach(function (tr) {
        var m = +tr.querySelector('[name=mark]').value, c = +tr.querySelector('[name=credits]').value || 0;
        sum += m * c; w += c; plain += m; n++;
      });
      var out = $('#gpa-result');
      if (!n) { out.textContent = 'Добавьте хотя бы одну дисциплину'; return; }
      var weighted = (sum / w).toFixed(2), simple = (plain / n).toFixed(2);
      var hint = weighted >= 4.75 ? 'Отлично! Это уровень для повышенной стипендии и красного диплома.' :
        weighted >= 4 ? 'Хороший результат. Посмотрите, какие «четвёрки» можно пересдать на «отлично».' :
        'Есть над чем поработать — загляните в наш гид по подготовке к сессии.';
      out.innerHTML = 'Средний балл: <b>' + simple + '</b> · с учётом з.е.: <b>' + weighted + '</b><br><span class="meta">' + hint + '</span>';
      goal('gpa_calculated', { rows: n, value: +weighted });
    });
  }

  // ---------- Помодоро-таймер ----------
  var tm = $('#pomodoro');
  if (tm) {
    var disp = $('#timer-display'), left = 25 * 60, h = null, mode = 'work';
    var draw = function () { disp.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'); };
    var setMode = function (m) { mode = m; left = (m === 'work' ? 25 : m === 'short' ? 5 : 15) * 60; draw(); $('#timer-mode').textContent = m === 'work' ? 'Фокус' : 'Перерыв'; };
    $('#timer-start').addEventListener('click', function () {
      if (h) return;
      goal('pomodoro_start', { mode: mode });
      h = setInterval(function () {
        left--; draw();
        if (left <= 0) { clearInterval(h); h = null; goal('pomodoro_complete', { mode: mode }); toast(mode === 'work' ? 'Помидор завершён — отдохните 5 минут' : 'Перерыв окончен'); setMode(mode === 'work' ? 'short' : 'work'); }
      }, 1000);
    });
    $('#timer-pause').addEventListener('click', function () { clearInterval(h); h = null; });
    $('#timer-reset').addEventListener('click', function () { clearInterval(h); h = null; setMode('work'); });
    $$('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { clearInterval(h); h = null; setMode(b.getAttribute('data-mode')); }); });
    draw();
  }

  // ---------- Счётчик дней до сессии ----------
  var cd = $('#session-countdown');
  if (cd) {
    var now = new Date(), y = now.getFullYear();
    var targets = [new Date(y, 0, 9), new Date(y, 5, 1), new Date(y + 1, 0, 9)];
    var t = targets.filter(function (d) { return d > now; })[0];
    var days = Math.ceil((t - now) / 864e5);
    cd.textContent = days;
  }
})();
