/* Valora: ролики на canvas листаются прокруткой, слова появляются из-под маски, услуги раскрываются.
   Без скрипта страница читается целиком (всё спрятанное прячется только под .js). */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- плавная прокрутка: подгружается после первого кадра, это приятность, не условие ----------
  let lenis = null;
  if (!reduce) {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/lenis@1.1.13/dist/lenis.min.js';
    s.async = true;
    s.onload = () => {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      window.__lenis = lenis;
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    };
    document.head.appendChild(s);
  }

  // ---------- слова: нарезаем заголовки на слова, чтобы поднимать их из-под маски ----------
  function wrapWords(el, cls) {
    const out = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/([ \t\r\n]+)/).forEach((part) => {
            if (!part) return;
            if (/^[ \t\r\n]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = cls;
            const inner = document.createElement('span');
            inner.textContent = part;
            if (cls === 'w') w.appendChild(inner); else w.textContent = part;
            frag.appendChild(w);
            out.push(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return out;
  }
  $$('[data-split]').forEach((el) => wrapWords(el, 'w').forEach((w, i) => w.firstChild.style.setProperty('--i', i)));
  const manifest = $$('[data-words]').map((el) => ({ el, words: wrapWords(el, 'mw') }));

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  $$('.rv, [data-split]').forEach((el) => io.observe(el));
  // заголовок героя виден сразу, ему не нужен триггер прокрутки
  requestAnimationFrame(() => $$('.scrub [data-split]').forEach((el) => el.classList.add('is-in')));

  // ---------- сцены ----------
  const portrait = () => innerWidth / innerHeight < 1;
  const scenes = $$('.scrub').map((el) => {
    const canvas = el.querySelector('.scrub-canvas');
    return {
      el, canvas, ctx: canvas.getContext('2d'),
      name: el.dataset.seq, bg: el.dataset.bg || '#000',
      counts: { d: +el.dataset.d, m: +el.dataset.m },
      variant: null, frames: [], last: -1, progress: 0,
      layers: $$('[data-show]', el),
    };
  });

  // порядок загрузки: первый кадр, потом всё мельче шагом, чтобы листать можно было до конца загрузки
  function loadOrder(n) {
    const order = [], seen = new Set();
    for (const stride of [n, 16, 8, 4, 2, 1]) for (let i = 0; i < n; i += stride) if (!seen.has(i)) { seen.add(i); order.push(i); }
    if (!seen.has(n - 1)) order.push(n - 1);
    return order;
  }

  function load(scene) {
    const variant = portrait() ? 'm' : 'd';
    if (scene.variant === variant) return;
    scene.variant = variant;
    const n = scene.counts[variant];
    scene.frames = new Array(n).fill(null);
    scene.last = -1;
    const queue = loadOrder(n);
    const retried = new Set();
    let active = 0;
    const next = () => {
      if (scene.variant !== variant) return;
      while (active < 6 && queue.length) {
        const i = queue.shift();
        const img = new Image();
        img.decoding = 'async';
        active++;
        img.onload = () => { scene.frames[i] = img; active--; if (scene.last === -1) draw(scene, true); next(); };
        // временный сбой CDN: один повтор позже, иначе сцена возьмёт ближайший загруженный кадр
        img.onerror = () => { active--; if (!retried.has(i)) { retried.add(i); setTimeout(() => { queue.push(i); next(); }, 1500); } next(); };
        img.src = `frames/${scene.name}/${variant}/${String(i + 1).padStart(4, '0')}.webp`;
      }
    };
    next();
  }

  function nearestLoaded(frames, i) {
    if (frames[i]) return i;
    for (let d = 1; d < frames.length; d++) {
      if (frames[i - d]) return i - d;
      if (frames[i + d]) return i + d;
    }
    return -1;
  }

  function size(scene) {
    const { canvas } = scene;
    const w = Math.round(canvas.clientWidth * DPR), h = Math.round(canvas.clientHeight * DPR);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; scene.last = -1; }
  }

  function draw(scene, force = false) {
    const n = scene.frames.length;
    if (!n) return;
    const want = reduce ? n - 1 : Math.round(scene.progress * (n - 1));
    const i = nearestLoaded(scene.frames, want);
    if (i < 0 || (i === scene.last && !force)) return;
    scene.last = i;
    const img = scene.frames[i], { ctx, canvas } = scene;
    const s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.fillStyle = scene.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }

  // слои поверх сцены: data-show="от до", доли прогресса сцены; от<=0 видно с самого начала, до>=1 остаётся до конца
  const EDGE = 0.07;
  function layers(scene) {
    const p = reduce ? 1 : scene.progress;
    for (const el of scene.layers) {
      const [a, b] = el.dataset.show.split(' ').map(Number);
      const tin = a <= 0 ? 1 : clamp((p - a) / EDGE);
      const tout = b >= 1 ? 1 : clamp((b - p) / EDGE);
      const t = reduce ? (a <= 0 ? 1 : 0) : Math.min(tin, tout);
      el.style.opacity = t;
      el.style.visibility = t <= 0 ? 'hidden' : 'visible';
      el.style.translate = `0 ${(1 - t) * 26}px`;
    }
    const hint = scene.el.querySelector('.scroll-hint');
    if (hint) hint.style.opacity = 1 - clamp(p / 0.06);
  }

  // ---------- шапка, полоса прогресса, манифест ----------
  const header = document.querySelector('.top');
  const bar = document.querySelector('.progress');
  function tick() {
    const vh = innerHeight;
    for (const scene of scenes) {
      const r = scene.el.getBoundingClientRect();
      if (r.top < vh * 3 && r.bottom > -vh) load(scene);
      if (r.bottom < 0 || r.top > vh) continue;
      scene.progress = clamp(-r.top / (r.height - vh));
      size(scene);
      draw(scene);
      layers(scene);
    }
    const y = scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 40);
    if (bar) bar.style.transform = `scaleX(${clamp(y / Math.max(1, document.documentElement.scrollHeight - vh))})`;
    for (const m of manifest) {
      const r = m.el.getBoundingClientRect();
      const p = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.3));
      const lit = Math.round(p * m.words.length);
      m.words.forEach((w, i) => w.classList.toggle('on', i < lit));
    }
    requestAnimationFrame(tick);
  }
  scenes.forEach((s) => { if (s.el.getBoundingClientRect().top < innerHeight * 2) load(s); });
  requestAnimationFrame(tick);
  addEventListener('resize', () => scenes.forEach((s) => { s.last = -1; s.variant = null; }));

  // ---------- услуги: на сенсорных экранах раскрываются по нажатию ----------
  $$('.svci').forEach((li) => {
    li.setAttribute('tabindex', '0');
    li.addEventListener('click', () => {
      const open = li.classList.contains('is-open');
      $$('.svci.is-open').forEach((x) => x.classList.remove('is-open'));
      if (!open) li.classList.add('is-open');
    });
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); } });
  });

  // ---------- кнопки чуть тянутся к курсору ----------
  if (!reduce && matchMedia('(hover: hover)').matches) {
    $$('.btn').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.16}px, ${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  // ---------- меню на телефоне ----------
  const burger = document.querySelector('.burger');
  if (burger) burger.addEventListener('click', () => {
    const open = header.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open);
  });

  // ---------- якоря ----------
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -76, duration: 1.5 });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    header && header.classList.remove('is-open');
  }));
})();
