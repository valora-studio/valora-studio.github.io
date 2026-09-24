// Valora: меню на узком экране + движение по ходу страницы.
// Без JS страница видна целиком: всё скрытое прячется только под html.js.
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- меню ----------
  var top = document.querySelector('.top');
  var burger = top && top.querySelector('.burger');
  if (burger) {
    burger.addEventListener('click', function () {
      var open = top.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.textContent = open ? 'Закрыть' : 'Меню';
    });
  }

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  // Прогресс элемента: 0 — верх элемента у нижней кромки окна (с отступом),
  // 1 — низ элемента дошёл до `end` доли высоты окна.
  function progress(el, start, end) {
    var r = el.getBoundingClientRect(), vh = window.innerHeight;
    var from = vh * start, to = vh * end - r.height;
    return clamp((from - r.top) / (from - to));
  }

  // ---------- заголовок: разбить на слова ----------
  $$('.hero h1, .doc h1').forEach(function (h) {
    var words = h.textContent.trim().split(/[ \t\r\n]+/); // неразрывные пробелы не трогаем
    h.innerHTML = words.map(function (w, i) {
      return '<span class="w" style="--i:' + i + '"><span>' + w + '</span></span>';
    }).join(' ');
    h.classList.add('split');
    h.setAttribute('aria-label', words.join(' '));
  });

  // линейки, которые прочерчиваются
  $$('.rows, .faq, .steps, .compare, .price, .contacts').forEach(function (el) { el.classList.add('draw'); });

  if (reduce) {
    // без движения — сразу конечное состояние каждой сцены
    $$('.split, .draw').forEach(function (el) { el.classList.add('is-in'); });
    document.body.classList.add('is-loaded');
    $$('.dots').forEach(function (d) {
      var first = d.getAttribute('data-keep') === 'first';
      $$('i', d).forEach(function (el, i) {
        if (first ? i === 0 : i < 9) return;
        el.style.opacity = '.15'; el.style.background = 'transparent';
      });
      var cap = d.nextElementSibling && d.nextElementSibling.querySelector('b');
      if (cap) cap.textContent = cap.getAttribute('data-to');
    });
    return;
  }

  // первый экран — одна сцена при загрузке
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      document.body.classList.add('is-loaded');
      $$('.split').forEach(function (h) { h.classList.add('is-in'); });
    });
  });

  // ---------- появление по мере прокрутки ----------
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('.draw').forEach(function (el) { io.observe(el); });


  // ---------- схема на первом экране: люди идут из каналов к вам ----------
  var FROM = { 'Авито': 'из Авито', 'Telegram': 'из Telegram', 'ВКонтакте': 'из ВКонтакте', 'Директ': 'из Директа',
               'Рассылки': 'из рассылки', 'Сообщества': 'из сообщества', 'Партнёры': 'от партнёров', 'Видео': 'из видео' };
  var DID = { 'Страница': 'Оставили заявку', 'Гид': 'Скачали гид', 'Бот': 'Написали боту' };
  $$('.orbit').forEach(function (box) {
    var svg = box.querySelector('svg'), layer = svg.querySelector('.o-dots');
    var NS = 'http://www.w3.org/2000/svg';
    var pulse = svg.querySelector('.o-pulse');
    var count = box.querySelector('.o-count'), countT = box.querySelector('.o-count-t');
    var cardB = box.querySelector('.o-card--b'), ev = box.querySelector('.o-event'), from = box.querySelector('.o-from');
    var chans = $$('.o-ch', svg), hubs = {};
    $$('.o-hub', svg).forEach(function (h) { hubs[h.getAttribute('data-hub')] = h; });
    var routes = $$('.o-path', svg).map(function (p, i) {
      var d = p.getAttribute('d'), tmp = document.createElementNS(NS, 'path');
      tmp.setAttribute('d', d.split(' L')[0]);            // до узла — чтобы знать, где он на пути
      return { el: p, len: p.getTotalLength(), hubAt: tmp.getTotalLength(),
               ch: p.getAttribute('data-ch'), hub: p.getAttribute('data-hub'), node: chans[i] };
    });
    var dots = [], arrived = 0, visible = true, nextAt = 0, last = 0;

    function flash(el, ms) { el.classList.add('is-hit'); setTimeout(function () { el.classList.remove('is-hit'); }, ms); }
    function arrive(rt) {
      arrived++;
      var n10 = arrived % 10, n100 = arrived % 100;
      countT.textContent = (n10 === 1 && n100 !== 11 ? 'контакт' :
        n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14) ? 'контакта' : 'контактов') + ', пока вы читаете';
      count.textContent = String(arrived);
      pulse.classList.remove('go'); void pulse.getBBox(); pulse.classList.add('go');
      ev.textContent = DID[rt.hub]; from.textContent = 'пришли ' + FROM[rt.ch];
      cardB.classList.remove('is-new'); void cardB.offsetWidth; cardB.classList.add('is-new');
    }
    function spawn(now) {
      var rt = routes[Math.floor(Math.random() * routes.length)];
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', '5'); c.setAttribute('class', 'o-dot');
      layer.appendChild(c);
      flash(rt.node, 500);
      dots.push({ c: c, rt: rt, t0: now, dur: 2600 + Math.random() * 900, hit: false });
    }
    function inOut(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(box);

    requestAnimationFrame(function loop(now) {
      if (visible && !document.hidden) {
        if (!nextAt) nextAt = now + 1700;                  // первая точка — когда схема собралась
        if (now >= nextAt) { spawn(now); nextAt = now + 700 + Math.random() * 900; }
        dots = dots.filter(function (d) {
          var k = (now - d.t0) / d.dur;
          if (k >= 1) { layer.removeChild(d.c); arrive(d.rt); return false; }
          var L = inOut(k) * d.rt.len, p = d.rt.el.getPointAtLength(L);
          d.c.setAttribute('cx', p.x.toFixed(1)); d.c.setAttribute('cy', p.y.toFixed(1));
          d.c.style.opacity = Math.min(1, k * 8).toFixed(2);
          if (!d.hit && L >= d.rt.hubAt) { d.hit = true; flash(hubs[d.rt.hub], 450); }
          return true;
        });
      } else {
        // схему не видно — ставим на паузу: сдвигаем время у точек в пути
        var dt = now - (last || now);
        dots.forEach(function (d) { d.t0 += dt; });
        if (nextAt) nextAt += dt;
      }
      last = now;
      requestAnimationFrame(loop);
    });
  });

  // ---------- сцены, привязанные к прокрутке ----------
  var scenes = [];

  // 1. Десять человек: слева уходят девять, справа девять остаются.
  $$('.compare').forEach(function (box) {
    var groups = $$('.dots', box).map(function (d) {
      var keep = d.getAttribute('data-keep');
      var dots = $$('i', d).map(function (el, i) {
        var stays = keep === 'first' ? i === 0 : i < 9;
        // у каждого своя траектория ухода — чтобы не шли строем
        var seed = Math.sin((i + 1) * (keep === 'first' ? 12.9 : 78.2)) * 43758.5;
        seed = seed - Math.floor(seed);
        return { el: el, stays: stays, dx: 18 + seed * 34, dy: (seed - .5) * 26, at: .12 + i * .055 };
      });
      var cap = d.nextElementSibling && d.nextElementSibling.querySelector('b');
      return { dots: dots, cap: cap, to: cap ? +cap.getAttribute('data-to') : 0 };
    });
    scenes.push(function () {
      var p = progress(box, .95, .7);
      groups.forEach(function (g) {
        var gone = 0;
        g.dots.forEach(function (d) {
          if (d.stays) return;
          var k = ease(clamp((p - d.at) / .35));
          if (k > .5) gone++;
          d.el.style.transform = 'translate(' + (d.dx * k).toFixed(1) + 'px,' + (d.dy * k).toFixed(1) + 'px) scale(' + (1 - .35 * k).toFixed(3) + ')';
          d.el.style.opacity = (1 - .85 * k).toFixed(3);
          d.el.style.background = k > .5 ? 'transparent' : '';
        });
        if (g.cap) g.cap.textContent = String(10 - gone);
      });
    });
  });

  // 3. Цены: строки по очереди, итог копится.
  $$('.price').forEach(function (table) {
    var rows = $$('tbody tr[data-sum]', table), total = table.querySelector('.price__total');
    if (!rows.length || !total) return;
    table.classList.add('is-scrub');
    var shown = -1;
    scenes.push(function () {
      var p = progress(table, .92, .8);
      var on = Math.min(rows.length, Math.floor(p * (rows.length + .999)));
      if (on === shown) return;
      shown = on;
      var sum = 0;
      rows.forEach(function (r, i) {
        var yes = i < on;
        r.classList.toggle('is-on', yes);
        if (yes) sum += +r.getAttribute('data-sum');
      });
      total.textContent = fmt(sum) + ' ₽';
    });
  });

  // 4. Шаги: линия пути тянется вдоль номеров.
  $$('.steps').forEach(function (box) {
    var steps = $$('.step', box);
    var track = document.createElement('div');
    track.className = 'steps__track';
    track.innerHTML = '<i class="steps__fill"></i>';
    box.insertBefore(track, box.firstChild);
    scenes.push(function () {
      var mid = window.innerHeight * .55;
      var r = track.getBoundingClientRect();
      var p = clamp((mid - r.top) / r.height);
      track.style.setProperty('--p', p.toFixed(4));
      steps.forEach(function (s) {
        s.classList.toggle('is-on', s.getBoundingClientRect().top + 40 < mid);
      });
    });
  });

  // 5. Обложки гидов расходятся по высоте.
  $$('.guides').forEach(function (box) {
    var imgs = $$('img', box), amp = [-14, 22, -6];
    scenes.push(function () {
      var p = progress(box, 1, 0) - .5;
      imgs.forEach(function (im, i) {
        im.style.transform = 'translateY(' + (amp[i % 3] * p * 2).toFixed(1) + 'px)';
      });
    });
  });

  if (!scenes.length) return;
  var ticking = false;
  function frame() { ticking = false; scenes.forEach(function (f) { f(); }); }
  function request() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  frame();
})();
