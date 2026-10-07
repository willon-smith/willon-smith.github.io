// Page motion and interaction. GSAP + ScrollTrigger + SplitText, Lenis smooth
// scroll, the Three.js hero, the pipeline and the stack sphere.
import { initPipeline } from './pipeline.js';
import { initSphere } from './sphere.js';

const { gsap, ScrollTrigger, SplitText, Lenis } = window;
if (!gsap || !ScrollTrigger || !SplitText) {
  // The CDN did not deliver GSAP: drop back to the static page the no-js styles
  // describe, so the preloader lifts and every section shows.
  document.documentElement.classList.replace('js', 'no-js');
  throw new Error('GSAP did not load; showing the static page');
}
gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true });

const html = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const mobileMQ = matchMedia('(max-width: 820px)');
const mobile = mobileMQ.matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NAV_OFFSET = 94; // nav height + sticky gap, mirrors --nav-h + 18px in the CSS

/* ---------- smooth scroll ---------- */
let lenis = null; // optional: if the CDN did not deliver Lenis, the page scrolls natively
if (!reduce && Lenis) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollTo(hash) {
  const target = $(hash);
  if (!target) return;
  if (lenis) lenis.scrollTo(target, { offset: hash === '#top' ? 0 : -6, duration: 1.4 });
  else target.scrollIntoView({ behavior: 'smooth' });
}
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const hash = a.getAttribute('href');
  if (hash.length > 1 && $(hash)) { e.preventDefault(); scrollTo(hash); history.replaceState(null, '', hash); }
}));

/* ---------- hero scene (optional: page works without it) ---------- */
let scene = { setScroll() {}, setFade() {}, pause() {}, resume() {} };
const sceneReady = import('./scene.js')
  .then(m => { scene = m.initScene($('#scene'), { reduce, mobile }); })
  .catch(() => { $('#scene').remove(); });

/* ---------- hero scroll: pin only when the hero fits the viewport ---------- */
const heroEl = $('.hero');
let heroCtx = null, heroMode = null;
function heroFits() { return !mobileMQ.matches && heroEl.offsetHeight <= window.innerHeight + 2; }
function setupHero() {
  if (reduce) return;
  const mode = heroFits() ? 'pin' : 'flow';
  if (mode === heroMode) return;
  heroMode = mode;
  if (heroCtx) heroCtx.revert();
  heroCtx = gsap.context(() => {
    if (mode === 'pin') {
      // one trigger pins the hero and drives the fade, so the fade runs during the pin
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: heroEl, start: 'top top', end: '+=65%', pin: true, scrub: true, refreshPriority: 2,
          onUpdate: s => {
            const p = s.progress;
            scene.setScroll(p);
            // the field stays bright while it spreads, then fades in the last third of the pin
            scene.setFade(p < .65 ? 1 : 1 - ((p - .65) / .35) * .88);
          },
        },
      });
      tl.to('.hero__foot', { autoAlpha: 0, duration: .35 }, 0)
        .to('.hero__inner', { y: -110, autoAlpha: 0, duration: .75 }, 0)
        .to({}, { duration: 1 }, 0);
    } else {
      ScrollTrigger.create({
        trigger: heroEl, start: 'top top', end: 'bottom top', scrub: true, refreshPriority: 2,
        onUpdate: s => { scene.setScroll(s.progress * .6); scene.setFade(1 - s.progress); },
      });
    }
    ScrollTrigger.create({
      trigger: heroEl, start: 'top top', end: '+=200%', refreshPriority: 1,
      onLeave: () => scene.pause(), onEnterBack: () => scene.resume(),
    });
  });
  // triggers created earlier must still be pushed by the pin distance
  ScrollTrigger.sort();
}

/* ---------- work: stacking cards, only when every card fits under the nav ---------- */
const stackEl = $('.stack');
let stackCtx = null, stackMode = null;
function setupStack() {
  if (!stackEl) return;
  const cards = $$('.work-card');
  const limit = window.innerHeight - NAV_OFFSET - 24;
  stackEl.classList.toggle('stack--flat', cards.some(c => c.offsetHeight > limit));
  const mode = getComputedStyle(cards[0]).position === 'sticky' ? 'stack' : 'flat';
  if (mode === stackMode) return;
  stackMode = mode;
  if (stackCtx) { stackCtx.revert(); stackCtx = null; }
  if (mode !== 'stack' || reduce) return;
  stackCtx = gsap.context(() => {
    cards.forEach((card, i) => {
      const next = cards[i + 1];
      if (!next) return;
      gsap.to(card, {
        scale: .93, '--dim': .7, ease: 'none',
        scrollTrigger: { trigger: next, start: 'top bottom', end: 'top ' + NAV_OFFSET + 'px', scrub: true },
      });
    });
  });
  ScrollTrigger.sort();
}

// the hero pin exists before any other trigger is created
setupHero();

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { setupHero(); setupStack(); ScrollTrigger.sort(); ScrollTrigger.refresh(); }, 250);
});

/* ---------- preloader + hero intro ---------- */
const pre = $('.preloader');
const heroBits = ['.hero .eyebrow', '.hero__lead', '.hero__cta .btn', '.hero__foot > *', '.nav'];
let heroSplit = null;
const fontsReady = (document.fonts ? document.fonts.ready : Promise.resolve());

if (reduce) {
  pre.remove();
  fontsReady.then(() => { setupStack(); ScrollTrigger.sort(); ScrollTrigger.refresh(); });
} else {
  lenis?.stop();
  gsap.set(heroBits, { autoAlpha: 0 });
  gsap.set('.hero__title', { autoAlpha: 0 });
  const count = $('.preloader__count');
  const bar = $('.preloader__bar i');
  const c = { v: 0 };
  gsap.to(c, { v: 100, duration: 1.6, ease: 'power2.inOut', onUpdate() {
    count.textContent = String(Math.round(c.v)).padStart(3, '0');
    gsap.set(bar, { scaleX: c.v / 100 });
  } });
  const minWait = new Promise(r => setTimeout(r, 1700));
  const cap = new Promise(r => setTimeout(r, 3500));
  Promise.race([Promise.all([minWait, fontsReady, sceneReady]), cap]).then(() => {
    heroSplit = SplitText.create('.hero__title', { type: 'lines', linesClass: 'line' });
    gsap.set('.hero__title', { autoAlpha: 1 });
    gsap.set(heroSplit.lines, { yPercent: 90, autoAlpha: 0, rotateX: -22, transformOrigin: '0% 100%' });
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, onComplete() {
      pre.remove();
      if (heroSplit) { heroSplit.revert(); heroSplit = null; }
      lenis?.start();
      setupHero();
      setupStack();
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    } });
    tl.to('.preloader__inner', { y: -30, autoAlpha: 0, duration: .5, ease: 'power2.in' })
      .to(pre, { yPercent: -100, duration: 1.05, ease: 'power4.inOut' }, '-=.15')
      .to(heroSplit.lines, { yPercent: 0, autoAlpha: 1, rotateX: 0, duration: 1.3, stagger: .1 }, '-=.55')
      .to('.hero .eyebrow', { autoAlpha: 1, y: 0, duration: .8 }, '-=1.1')
      .to('.hero__lead', { autoAlpha: 1, duration: .9 }, '-=.9')
      .to('.hero__cta .btn', { autoAlpha: 1, duration: .7, stagger: .08 }, '-=.75')
      .to('.hero__foot > *', { autoAlpha: 1, duration: .7, stagger: .08 }, '-=.5')
      .to('.nav', { autoAlpha: 1, duration: .8 }, '-=.9');
  });
}

/* ---------- section reveals ---------- */
if (!reduce) {
  $$('[data-reveal]').forEach(el => {
    gsap.fromTo(el, { y: 36, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 1.1, ease: 'power3.out', delay: parseFloat(el.dataset.delay || 0),
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });
  $$('[data-reveal-group]').forEach(group => {
    gsap.fromTo([...group.children], { y: 40, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 1, ease: 'power3.out', stagger: .09,
      scrollTrigger: { trigger: group, start: 'top 88%', once: true },
    });
  });
  fontsReady.then(() => {
    $$('[data-split]').forEach(el => {
      SplitText.create(el, {
        type: 'lines', autoSplit: true,
        onSplit(self) {
          return gsap.from(self.lines, {
            yPercent: 80, autoAlpha: 0, rotateX: -18, transformOrigin: '0 100%', duration: 1.1, ease: 'power4.out', stagger: .08,
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          });
        },
      });
    });
    ScrollTrigger.refresh();
  });
}

/* ---------- counters ---------- */
$$('[data-count]').forEach(el => {
  const target = parseFloat(el.dataset.count);
  const dec = parseInt(el.dataset.decimals || '0', 10);
  const prefix = el.dataset.prefix || '';
  const fmt = v => prefix + v.toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (reduce) { el.textContent = fmt(target); return; }
  el.textContent = fmt(0);
  ScrollTrigger.create({
    trigger: el, start: 'top 92%', once: true,
    onEnter() { const o = { v: 0 }; gsap.to(o, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v); } }); },
  });
});

/* ---------- spotlight, tilt, magnetic, cursor ---------- */
if (fine && !reduce) {
  $$('.work-card, .mini, .principle').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  });
  $$('.tilt').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5;
      const py = (e.clientY - r.top) / r.height - .5;
      gsap.to(el, { rotateY: px * 12, rotateX: -py * 12, transformPerspective: 900, duration: .6, ease: 'power2.out' });
    }, { passive: true });
    el.addEventListener('pointerleave', () => gsap.to(el, { rotateX: 0, rotateY: 0, duration: 1, ease: 'power3.out' }));
  });
  $$('.magnetic').forEach(b => {
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      gsap.to(b, { x: (e.clientX - (r.left + r.width / 2)) * .28, y: (e.clientY - (r.top + r.height / 2)) * .28, duration: .5, ease: 'power3.out' });
    }, { passive: true });
    b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1,.45)' }));
  });
  if (!mobile) {
    html.classList.add('has-cursor');
    const dot = $('.cursor__dot'), ring = $('.cursor__ring');
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    window.addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; gsap.set(dot, { x, y }); html.classList.add('cursor-in'); }, { passive: true });
    gsap.ticker.add(() => { rx += (x - rx) * .16; ry += (y - ry) * .16; gsap.set(ring, { x: rx, y: ry }); });
    const hot = 'a, button, .pnode, [data-cursor]';
    document.addEventListener('pointerover', e => { if (e.target.closest(hot)) ring.classList.add('is-hover'); });
    document.addEventListener('pointerout', e => { if (e.target.closest(hot)) ring.classList.remove('is-hover'); });
    document.addEventListener('mouseleave', () => html.classList.remove('cursor-in'));
    document.addEventListener('mouseenter', () => html.classList.add('cursor-in'));
  }
}

/* ---------- nav, progress, active section ---------- */
const nav = $('.nav');
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate(self) {
    const y = self.scroll();
    nav.classList.toggle('is-scrolled', y > 40);
    nav.classList.toggle('is-hidden', y > 320 && self.direction === 1);
  },
});
if (!reduce) gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .3 } });
const links = $$('.nav__links a, .dock a');
$$('main section[id]').forEach(sec => {
  ScrollTrigger.create({
    trigger: sec, start: 'top 55%', end: 'bottom 55%',
    onToggle(self) { if (self.isActive) links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + sec.id)); },
  });
});

/* ---------- timeline ---------- */
if (!reduce) {
  gsap.to('.tl__rail i', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.tl', start: 'top 70%', end: 'bottom 65%', scrub: true } });
}
$$('.tl__item').forEach(item => {
  ScrollTrigger.create({ trigger: item, start: 'top 68%', onEnter: () => item.classList.add('is-lit'), onLeaveBack: () => item.classList.remove('is-lit') });
});

/* ---------- local time (SAST) ---------- */
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit' });
const tick = () => { const t = timeFmt.format(new Date()); $$('[data-local-time]').forEach(el => { el.textContent = t; }); };
tick(); setInterval(tick, 15000);

/* ---------- contact terminal ---------- */
const term = $('.term');
if (term) {
  const cmd = $('.term__cmd', term);
  const text = cmd.dataset.type || '';
  const lines = $$('.term__line', term);
  let done = false;
  const run = () => {
    if (done) return; done = true;
    if (reduce) { cmd.textContent = text; lines.forEach(l => l.classList.add('is-in')); return; }
    lines[0].classList.add('is-in');
    let i = 0;
    const type = () => {
      cmd.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(type, 38);
      else lines.slice(1).forEach((l, n) => setTimeout(() => l.classList.add('is-in'), 260 + n * 150));
    };
    setTimeout(type, 300);
  };
  ScrollTrigger.create({ trigger: term, start: 'top 85%', once: true, onEnter: run });
}
$$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(b.dataset.copy);
    b.classList.add('is-done'); b.textContent = 'Copied';
    setTimeout(() => { b.classList.remove('is-done'); b.textContent = 'Copy'; }, 1600);
  } catch (e) { /* clipboard blocked: the text is visible next to the button */ }
}));

/* ---------- pipeline ---------- */
const pipe = $('#pipeline');
if (pipe) initPipeline(pipe, { reduce });

/* ---------- stack sphere ---------- */
const WORDS = [
  ['Claude', 'ai', 1], ['Anthropic API', 'ai', 1], ['Claude Code', 'ai'], ['AI agents', 'ai', 1], ['Tool calling', 'ai'], ['RAG', 'ai'], ['Embeddings', 'ai'],
  ['Prompt caching', 'ai'], ['Model routing', 'ai'], ['Eval suites', 'ai'], ['Vector search', 'ai'],
  ['Python', 'dev', 1], ['TypeScript', 'dev', 1], ['JavaScript', 'dev'], ['SQL', 'dev'], ['Django', 'dev', 1], ['DRF', 'dev'], ['FastAPI', 'dev'], ['Flask', 'dev'],
  ['React', 'dev', 1], ['Node.js', 'dev'], ['Apps Script', 'dev'], ['REST APIs', 'dev'], ['GraphQL', 'dev'], ['Git', 'dev'],
  ['PostgreSQL', 'data', 1], ['pgvector', 'data'], ['DuckDB', 'data'], ['dbt', 'data'], ['MongoDB Atlas', 'data'], ['Supabase', 'data'], ['Warehouse modelling', 'data'],
  ['AWS ECS', 'cloud', 1], ['AWS RDS', 'cloud'], ['S3', 'cloud'], ['Terraform', 'cloud'], ['Docker', 'cloud', 1], ['GitHub Actions', 'cloud'], ['Vercel', 'cloud'], ['Neon', 'cloud'], ['Render', 'cloud'], ['Hetzner', 'cloud'],
  ['Linux hardening', 'ops', 1], ['NGINX', 'ops'], ['TLS', 'ops'], ['UFW', 'ops'], ['fail2ban', 'ops'], ['Tailscale', 'ops'], ['Grafana', 'ops'], ['Loki', 'ops'], ['systemd', 'ops'], ['OAuth 2.0', 'ops'], ['RBAC', 'ops'], ['Kill switches', 'ops'],
  ['n8n', 'integ', 1], ['Webhooks', 'integ'], ['Microsoft Graph', 'integ', 1], ['Outlook', 'integ'], ['Business Central', 'integ'], ['Monday.com', 'integ'], ['Airtable', 'integ'], ['Linear', 'integ'],
  ['Twilio', 'integ'], ['WhatsApp API', 'integ'], ['Telegram Bot API', 'integ'], ['Calendly', 'integ'], ['Google Workspace', 'integ'], ['AppSheet', 'integ'],
].map(([t, cat, big]) => ({ t, cat, big: !!big }));
const sphereCanvas = $('#sphere');
if (sphereCanvas) {
  const sphere = initSphere(sphereCanvas, WORDS, { reduce });
  $$('.cats button').forEach(b => b.addEventListener('click', () => {
    const cat = b.dataset.cat;
    $$('.cats button').forEach(x => x.classList.toggle('is-on', x === b));
    sphere.highlight(cat === 'all' ? null : cat);
    $$('.stack-rows > div').forEach(r => r.classList.toggle('is-dim', cat !== 'all' && r.dataset.cat !== cat));
  }));
}

window.addEventListener('load', () => { setupHero(); setupStack(); ScrollTrigger.sort(); ScrollTrigger.refresh(); });
