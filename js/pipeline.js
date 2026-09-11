// Interactive request flow: the real shape of the permission-aware assistant.
// Nodes and edges are data; the SVG is built from them so the layout stays honest.

const NODES = [
  { id: 'web',     x: 30,   y: 60,  w: 180, h: 64,  title: 'Web app',           sub: 'React, in-app chat',            lane: 'channels' },
  { id: 'tg',      x: 30,   y: 176, w: 180, h: 64,  title: 'Telegram',          sub: 'Bot API',                       lane: 'channels' },
  { id: 'wa',      x: 30,   y: 292, w: 180, h: 64,  title: 'WhatsApp',          sub: 'Twilio',                        lane: 'channels' },
  { id: 'agent',   x: 270,  y: 150, w: 200, h: 116, title: 'Claude agent',      sub: 'parameterised tools only',      tag: 'RUNS AS THE USER', lane: 'agent' },
  { id: 'gate',    x: 530,  y: 122, w: 200, h: 172, title: 'Permission gate',   sub: 'tenant · role · team · row and field', tag: 'FILTERED IN THE DATABASE', lane: 'gate' },
  { id: 'sql',     x: 790,  y: 42,  w: 210, h: 84,  title: 'Guarded SQL',       sub: 'read only views, allowlisted',  tag: 'READ PATH', lane: 'data' },
  { id: 'confirm', x: 790,  y: 190, w: 210, h: 84,  title: 'Confirm with user', sub: 'proposal shown in channel',     tag: 'WRITE PATH', lane: 'data' },
  { id: 'core',    x: 790,  y: 330, w: 210, h: 84,  title: 'Application core',  sub: 'same code as a button click',   lane: 'data' },
  { id: 'answer',  x: 1060, y: 42,  w: 210, h: 84,  title: 'Answer in channel', sub: 'text, charts, records',         lane: 'output' },
  { id: 'audit',   x: 1060, y: 330, w: 210, h: 84,  title: 'Audit log',         sub: 'user · tool · params · result', lane: 'output' },
];

const EDGES = [
  { from: 'web', to: 'agent', modes: ['read', 'write'] },
  { from: 'tg', to: 'agent', modes: ['read', 'write'] },
  { from: 'wa', to: 'agent', modes: ['read', 'write'] },
  { from: 'agent', to: 'gate', modes: ['read', 'write'] },
  { from: 'gate', to: 'sql', modes: ['read'] },
  { from: 'sql', to: 'answer', modes: ['read'] },
  { from: 'sql', to: 'audit', modes: ['read'] },
  { from: 'gate', to: 'confirm', modes: ['write'] },
  { from: 'confirm', to: 'core', modes: ['write'] },
  { from: 'core', to: 'audit', modes: ['write'] },
  { from: 'core', to: 'answer', modes: ['write'] },
];

const INFO = {
  web:     ['One agent core, every channel', 'The web app, Telegram and WhatsApp all talk to the same agent core. A new channel inherits the security model instead of re-implementing it.'],
  tg:      ['Telegram', 'Questions and requests arrive as ordinary messages. Photos work too: a picture of a delivery note becomes a record through vision, then goes through the same gate as typed input.'],
  wa:      ['WhatsApp', 'Site staff mostly work from a phone. WhatsApp lets them ask about live spend or raise a request without opening a laptop, with identity resolved to a platform user before anything runs.'],
  agent:   ['Claude selects tools, never writes SQL', 'The model chooses from a small set of parameterised tools. It has no credentials and no permissions of its own: every call runs as the person asking, so it cannot exceed their authority.'],
  gate:    ['Four layers, enforced in the database', 'Tenant, role, team and row and field rules apply to every request, human or AI. Filtering happens in the query, so the model never sees a row the user could not see themselves.'],
  sql:     ['Guarded read only layer', 'Reads go through allowlisted views with per tenant query rewriting. A least privilege database role means a bad query fails loudly rather than leaking quietly.'],
  confirm: ['Writes wait for a human', 'The model proposes an action and the user sees exactly what will change. Nothing is written until they confirm in the channel they asked from.'],
  core:    ['Same code path as the web app', 'A confirmed action runs through the application core, so validation, value thresholds and approval routing apply exactly as they would to a button click.'],
  answer:  ['Back in the channel it came from', 'Answers, charts and created records return to the user in place. Multi turn state is kept per user so follow up questions work.'],
  audit:   ['Every call is logged', 'User, tool, parameters and result on every call. The adversarial audit that found two data leak paths before release was run against this log, and both fixes are covered by regression tests.'],
};

const LOGS = {
  read: [
    ['telegram', 'message received from user 2, tenant A'],
    ['agent', 'tool selected: plant_hire_summary(week="current")'],
    ['gate', '<span class="ok">tenant ✓  role ✓  team ✓</span>  row rules applied'],
    ['sql', 'read only view plant_hire_v, 14 rows returned'],
    ['answer', '"£1,726 of plant hire is live this week across 14 units"'],
    ['audit', 'logged: user, tool, params, result, 212 ms'],
  ],
  write: [
    ['whatsapp', 'message received from user 7, tenant A'],
    ['agent', 'proposes: create_off_hire(unit=42, date="today")'],
    ['gate', '<span class="ok">tenant ✓  role ✓  team ✓  write scope ✓</span>'],
    ['confirm', '"Raise an off hire for unit 42 today?"  <span class="wait">awaiting user</span>'],
    ['confirm', 'user replied: yes'],
    ['core', 'off hire request #1043 created, approval routed to site manager'],
    ['audit', 'logged: user, tool, params, result'],
    ['answer', '"Done. Request #1043 is with the site manager for approval"'],
  ],
};

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, parent) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};
const byId = Object.fromEntries(NODES.map(n => [n.id, n]));

function edgePath(e) {
  const a = byId[e.from], b = byId[e.to];
  const x1 = a.x + a.w, y1 = a.y + a.h / 2;
  const x2 = b.x, y2 = b.y + b.h / 2;
  const dx = Math.max(40, (x2 - x1) * 0.5);
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

export function initPipeline(root, { reduce = false } = {}) {
  const stage = root.querySelector('.pipe__stage');
  const info = root.querySelector('.pipe__info');
  const log = root.querySelector('.pipe__log');
  const buttons = [...root.querySelectorAll('.seg button')];

  const svg = el('svg', {
    viewBox: '0 0 1300 450', role: 'img',
    'aria-label': 'Request flow through the assistant: channels, Claude agent, permission gate, guarded SQL or confirmation, then answer and audit log',
  }, stage);

  const lanes = [
    ['CHANNELS', 20, 200], ['AGENT', 260, 220], ['GATE', 520, 220], ['DATA AND ACTIONS', 780, 230], ['OUTPUT', 1050, 230],
  ];
  for (const [label, x, w] of lanes) {
    el('rect', { x, y: 18, width: w, height: 414, rx: 14, class: 'plane' }, svg);
    const t = el('text', { x: x + 14, y: 40, class: 'plabel' }, svg);
    t.textContent = label;
  }

  const edgeEls = EDGES.map(e => {
    const p = el('path', { d: edgePath(e), class: 'pedge' }, svg);
    return { ...e, path: p, len: p.getTotalLength() };
  });

  const nodeEls = NODES.map(n => {
    const g = el('g', { class: 'pnode', tabindex: 0, role: 'button', 'aria-label': n.title, transform: `translate(${n.x},${n.y})` }, svg);
    el('rect', { width: n.w, height: n.h, rx: 12 }, g);
    if (n.tag) { const tg = el('text', { x: 16, y: 20, class: 'tag' }, g); tg.textContent = n.tag; }
    const y0 = n.tag ? 46 : 28;
    const t = el('text', { x: 16, y: y0 }, g); t.textContent = n.title;
    if (n.h >= 150) {
      n.sub.split(' · ').forEach((s, i) => {
        const st = el('text', { x: 16, y: y0 + 26 + i * 18, class: 'sub' }, g); st.textContent = '• ' + s;
      });
    } else {
      const st = el('text', { x: 16, y: y0 + 20, class: 'sub' }, g); st.textContent = n.sub;
    }
    g.addEventListener('click', () => select(n.id));
    g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(n.id); } });
    return { ...n, g };
  });
  const nodeById = Object.fromEntries(nodeEls.map(n => [n.id, n]));

  const dotsLayer = el('g', {}, svg);
  let mode = 'read';
  let dots = [];

  function activeEdges() { return edgeEls.filter(e => e.modes.includes(mode)); }

  function applyMode() {
    const act = activeEdges();
    const ids = new Set();
    act.forEach(e => { ids.add(e.from); ids.add(e.to); });
    edgeEls.forEach(e => {
      const on = act.includes(e);
      e.path.classList.toggle('is-on', on);
      e.path.classList.toggle('is-dim', !on);
    });
    nodeEls.forEach(n => {
      n.g.classList.toggle('is-on', ids.has(n.id));
      n.g.classList.toggle('is-dim', !ids.has(n.id));
    });
    buttons.forEach(b => b.classList.toggle('is-on', b.dataset.mode === mode));
    dotsLayer.innerHTML = '';
    dots = act.map((e, i) => {
      const c = el('circle', { r: 3.2, class: 'pdot' }, dotsLayer);
      return { edge: e, c, t: (i * 0.37) % 1, speed: 0.11 + (i % 3) * 0.025 };
    });
    if (reduce) {
      dots.forEach(d => { const p = d.edge.path.getPointAtLength(0.5 * d.edge.len); d.c.setAttribute('cx', p.x); d.c.setAttribute('cy', p.y); });
    }
    typeLog();
  }

  function select(id) {
    nodeEls.forEach(n => n.g.classList.toggle('is-sel', n.id === id));
    const [h, p] = INFO[id];
    info.innerHTML = `<span class="mono">${nodeById[id].lane}</span><h4>${h}</h4><p>${p}</p>`;
  }

  let logToken = 0;
  function typeLog() {
    const token = ++logToken;
    log.innerHTML = '';
    LOGS[mode].forEach(([k, v], i) => {
      const row = document.createElement('div');
      row.innerHTML = `<b>${k}</b><span>${v}</span>`;
      log.appendChild(row);
      const delay = reduce ? 0 : 260 + i * 420;
      setTimeout(() => { if (token === logToken) row.classList.add('is-in'); }, delay);
    });
  }

  buttons.forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; applyMode(); }));

  let running = false, raf = 0, last = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    for (const d of dots) {
      d.t += dt * d.speed;
      if (d.t > 1) d.t -= 1;
      const p = d.edge.path.getPointAtLength(d.t * d.edge.len);
      d.c.setAttribute('cx', p.x.toFixed(1));
      d.c.setAttribute('cy', p.y.toFixed(1));
      d.c.setAttribute('opacity', (Math.sin(d.t * Math.PI) * 0.9 + 0.1).toFixed(2));
    }
    raf = requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver(entries => {
    const vis = entries.some(e => e.isIntersecting);
    if (vis && !running && !reduce) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!vis && running) { running = false; cancelAnimationFrame(raf); }
  }, { threshold: 0.05 });
  io.observe(root);

  applyMode();
  select('gate');
  return { setMode(m) { mode = m; applyMode(); } };
}
