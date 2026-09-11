// A rotating word sphere of the stack. Plain canvas 2D with a perspective
// projection; the pointer steers the spin, a category filter lights up its words.

export function initSphere(canvas, words, { reduce = false } = {}) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, R = 0, dpr = 1;
  const N = words.length;
  const pts = words.map((w, i) => {
    // Fibonacci sphere for even spacing
    const phi = Math.acos(1 - 2 * (i + 0.5) / N);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    return { ...w, x: Math.cos(theta) * Math.sin(phi), y: Math.cos(phi), z: Math.sin(theta) * Math.sin(phi) };
  });
  let rotX = 0.35, rotY = 0;
  let velX = 0.0, velY = reduce ? 0 : 0.004;
  let targetVX = 0, targetVY = 0.004;
  let active = null;
  let hovering = false;
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#f3f1ea';
  const amber = '#f2b56b';
  const blue = '#7cc4ff';

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; R = Math.min(W, H) * 0.42;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    targetVY = nx * 0.02;
    targetVX = -ny * 0.014;
    hovering = true;
  }
  function onLeave() { hovering = false; targetVY = 0.004; targetVX = 0; }
  if (!reduce) {
    canvas.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerleave', onLeave);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const sinY = Math.sin(rotY), cosY = Math.cos(rotY), sinX = Math.sin(rotX), cosX = Math.cos(rotX);
    const proj = [];
    for (const p of pts) {
      // rotate around Y then X
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;
      const f = 2.2 / (2.2 + z2 * 1.0); // perspective; z2 in [-1,1]
      proj.push({ p, sx: cx + x1 * R * f, sy: cy + y2 * R * f, f, z: z2 });
    }
    proj.sort((a, b) => a.z - b.z);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const q of proj) {
      const depth = (q.z + 1) / 2; // 0 back → 1 front
      const isOn = active && q.p.cat === active;
      const isOff = active && !isOn;
      let alpha = 0.18 + depth * 0.82;
      if (isOff) alpha *= 0.18;
      if (isOn) alpha = 0.55 + depth * 0.45;
      const size = (q.p.big ? 15.5 : 12.5) * q.f * (W < 420 ? 0.8 : 1);
      ctx.font = `${isOn || q.p.big ? 600 : 500} ${size}px "Inter Tight", system-ui, sans-serif`;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isOn ? amber : (q.p.big ? blue : textColor);
      if (isOn) { ctx.shadowColor = 'rgba(242,181,107,.65)'; ctx.shadowBlur = 14; } else { ctx.shadowBlur = 0; }
      ctx.fillText(q.p.t, q.sx, q.sy);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  let running = false, raf = 0;
  function frame() {
    if (!running) return;
    velX += (targetVX - velX) * 0.05;
    velY += (targetVY - velY) * 0.05;
    rotX += velX; rotY += velY;
    draw();
    raf = requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver(entries => {
    const vis = entries.some(e => e.isIntersecting);
    if (reduce) { if (vis) draw(); return; }
    if (vis && !running) { running = true; raf = requestAnimationFrame(frame); }
    if (!vis && running) { running = false; cancelAnimationFrame(raf); }
  }, { threshold: 0.05 });
  io.observe(canvas);
  draw();

  return {
    highlight(cat) { active = cat || null; if (reduce) draw(); },
  };
}
