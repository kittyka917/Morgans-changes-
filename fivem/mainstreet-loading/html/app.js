/* MainStreet loading screen.
   - the city: a canvas night skyline with palms, searchlights and a passing helicopter (all drawn here, no video)
   - progress: FiveM's own loading events (init phases, map data files, loadFraction), smoothed, never backwards
   - tips, music and the wordmark/logo come from config.js
   Opened outside FiveM (a normal browser), it plays a simulated load so the page can be previewed. */
(function () {
  'use strict';
  const C = window.MS_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  /* ---------------- branding ---------------- */
  $('wmName').textContent = C.name || 'MainStreet';
  $('wmTag').textContent = C.tag || 'RP';
  $('connText').textContent = 'Connecting to ' + (C.name || 'MainStreet') + ' ' + (C.tag || '');
  if (C.logo) {
    const img = $('logoImg');
    img.onload = () => { img.hidden = false; $('wordmark').hidden = true; };
    img.src = C.logo;                       // a missing file just keeps the wordmark
  }

  /* ---------------- music ---------------- */
  const audio = $('theme'), btn = $('musicBtn');
  let musicOn = true;
  if (C.music && C.music.src) { audio.src = C.music.src; audio.volume = Math.max(0, Math.min(1, C.music.volume ?? 0.28)); }
  function setMusic(on) {
    musicOn = on;
    btn.setAttribute('aria-pressed', String(on));
    $('musicLabel').textContent = on ? 'Music on' : 'Music off';
    if (on) audio.play().catch(() => {}); else audio.pause();
  }
  btn.addEventListener('click', () => setMusic(!musicOn));
  window.addEventListener('keydown', (e) => { if (e.key === 'm' || e.key === 'M') setMusic(!musicOn); });
  audio.play().catch(() => {                // a normal browser blocks autoplay until a click; FiveM does not
    const start = () => { if (musicOn) audio.play().catch(() => {}); window.removeEventListener('pointerdown', start); };
    window.addEventListener('pointerdown', start);
  });

  /* ---------------- tips ---------------- */
  const tips = (C.tips && C.tips.length) ? C.tips : ['Welcome to the city.'];
  let tipIdx = 0;
  const pad = (n) => String(n).padStart(2, '0');
  function showTip(i) {
    const p = $('tipText');
    p.classList.add('out');
    setTimeout(() => {
      p.textContent = tips[i];
      $('tipNum').textContent = pad(i + 1) + ' / ' + pad(tips.length);
      p.classList.remove('out');
    }, 450);
  }
  $('tipText').textContent = tips[0];
  $('tipNum').textContent = pad(1) + ' / ' + pad(tips.length);
  setInterval(() => { tipIdx = (tipIdx + 1) % tips.length; showTip(tipIdx); }, Math.max(4, C.tipSeconds || 9) * 1000);

  /* ---------------- clock ---------------- */
  const t0 = Date.now();
  setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $('clock').textContent = pad(Math.floor(s / 60)) + ':' + pad(s % 60); }, 1000);

  /* ---------------- progress from FiveM's loading events ----------------
     Phases in the order the game runs them, each with its share of the bar. */
  const PHASES = {
    INIT_CORE:              { from: 0.00, to: 0.08, label: 'Starting up' },
    INIT_BEFORE_MAP_LOADED: { from: 0.08, to: 0.22, label: 'Preparing the city' },
    MAP:                    { from: 0.22, to: 0.70, label: 'Loading map data' },
    INIT_AFTER_MAP_LOADED:  { from: 0.70, to: 0.86, label: 'Streaming the streets' },
    INIT_SESSION:           { from: 0.86, to: 0.99, label: 'Joining the session' },
  };
  let target = 0, shown = 0, phase = null, count = 0, done = 0, fraction = 0;
  function enter(name, n) {
    phase = PHASES[name] || null; count = Math.max(1, n || 1); done = 0;
    if (phase) $('stage').textContent = phase.label;
    bump();
  }
  function bump() {
    let v = 0;
    if (phase) v = phase.from + (phase.to - phase.from) * Math.min(1, done / count);
    target = Math.max(target, v, fraction);
  }
  const handlers = {
    startInitFunctionOrder: (d) => enter(d.type, d.count),
    initFunctionInvoking: (d) => { done = Math.max(done, (d.idx || 0) + 1); bump(); },
    startDataFileEntries: (d) => enter('MAP', d.count),
    onDataFileEntry: () => { done++; bump(); },
    performMapLoadFunction: () => { done++; bump(); },
    loadProgress: (d) => { const f = parseFloat(d.loadFraction); if (isFinite(f)) { fraction = Math.min(0.99, f); bump(); } },
    onLogLine: (d) => { if (d.message) $('logLine').textContent = String(d.message).slice(0, 160); },
  };
  window.addEventListener('message', (e) => {
    const d = e.data || {};
    const h = handlers[d.eventName];
    if (h) { gotEvents = true; h(d); }
  });
  function renderBar() {
    shown += (target - shown) * 0.06;
    if (target - shown < 0.0005) shown = target;
    const pct = Math.floor(shown * 100);
    $('fill').style.width = (shown * 100).toFixed(2) + '%';
    $('pct').textContent = pct;
    $('road').setAttribute('aria-valuenow', pct);
  }

  /* outside FiveM: a believable simulated load, for previews only */
  let gotEvents = false;
  const inFiveM = typeof window.invokeNative === 'function' || /^nui:|cfx-nui/i.test(location.href);
  if (!inFiveM) {
    const script = [
      ['startInitFunctionOrder', { type: 'INIT_CORE', count: 12 }, 0.4], ['initFunctionInvoking', { idx: 11 }, 2.0],
      ['startInitFunctionOrder', { type: 'INIT_BEFORE_MAP_LOADED', count: 30 }, 2.3], ['initFunctionInvoking', { idx: 29 }, 5.0],
      ['startDataFileEntries', { count: 400 }, 5.3],
    ];
    for (let i = 1; i <= 40; i++) script.push(['onDataFileEntry', {}, 5.3 + i * 0.3]);
    script.forEach(([ev, d, at]) => setTimeout(() => handlers[ev](d), at * 1000));
    let n = 0; const fake = setInterval(() => { n += 10; for (let k = 0; k < 10; k++) handlers.onDataFileEntry({}); handlers.onLogLine({ message: 'Preview: map data ' + n + ' / 400' }); if (n >= 400) clearInterval(fake); }, 300);
    setTimeout(() => handlers.startInitFunctionOrder({ type: 'INIT_AFTER_MAP_LOADED', count: 40 }), 18000);
    setTimeout(() => handlers.initFunctionInvoking({ idx: 39 }), 23000);
    setTimeout(() => handlers.startInitFunctionOrder({ type: 'INIT_SESSION', count: 10 }), 23500);
    setTimeout(() => handlers.initFunctionInvoking({ idx: 9 }), 28000);
  }

  /* ---------------- the city ---------------- */
  const cv = $('city'), ctx = cv.getContext('2d');
  let W = 0, H = 0, layers = [], stars = [], beams = [], windowsLit = [], grainTile = null, grainPattern = null, vignette = null;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  function build() {
    const dpr = 1;                               // the game is loading at the same time: keep it light
    W = Math.round(window.innerWidth * dpr); H = Math.round(window.innerHeight * dpr);
    cv.width = W; cv.height = H;
    const r = rng(1909 ^ 0x5eed);
    const horizon = H * 0.80;

    stars = Array.from({ length: 140 }, () => ({ x: r(), y: r() * 0.55, s: 0.6 + r() * 1.4, p: r() * 6.28, f: 0.5 + r() * 1.5 }));
    beams = [{ x: 0.55, a: -0.35, sp: 0.07, w: 0.05 }, { x: 0.82, a: 0.25, sp: -0.05, w: 0.04 }];

    // three skyline layers, wider than the screen for the slow drift
    layers = [];
    windowsLit = [];
    const specs = [
      { col: '#0f2418', haze: 0.0, hMin: 0.10, hMax: 0.30, wMin: 0.025, wMax: 0.06, win: 0.10, base: horizon - H * 0.02, par: 0.25 },
      { col: '#08150d', haze: 0.0, hMin: 0.14, hMax: 0.46, wMin: 0.03, wMax: 0.07, win: 0.20, base: horizon, par: 0.5 },
      { col: '#030805', haze: 0.0, hMin: 0.05, hMax: 0.20, wMin: 0.05, wMax: 0.10, win: 0.08, base: H * 0.95, par: 0.9 },
    ];
    specs.forEach((sp, li) => {
      const LW = Math.round(W * 1.2), c = document.createElement('canvas'); c.width = LW; c.height = H;
      const g = c.getContext('2d');
      const antennas = [];
      let x = -W * 0.02;
      while (x < LW) {
        const bw = W * (sp.wMin + r() * (sp.wMax - sp.wMin));
        const cx = (x + bw / 2) / LW;
        const downtown = Math.exp(-Math.pow((cx - 0.66) / 0.14, 2));      // the tall cluster sits right of centre
        const bh = H * (sp.hMin + r() * (sp.hMax - sp.hMin)) * (0.75 + 0.9 * downtown * (li === 1 ? 1 : 0.5));
        const top = sp.base - bh;
        g.fillStyle = sp.col;
        g.fillRect(x, top, bw, sp.base - top + H);
        if (r() < 0.35) { const sw = bw * (0.4 + r() * 0.3); g.fillRect(x + (bw - sw) / 2, top - bh * 0.08, sw, bh * 0.08 + 2); }   // stepped crown
        if (bh > H * 0.3 && r() < 0.6) { const ax = x + bw * (0.3 + r() * 0.4); g.fillRect(ax, top - H * 0.05, Math.max(2, W * 0.0015), H * 0.05); antennas.push({ x: ax, y: top - H * 0.05, p: r() * 6.28 }); }
        // windows
        if (li < 2) {
          const cw = Math.max(3, W * 0.004), chh = Math.max(3, H * 0.006), gx = cw * 2.1, gy = chh * 2.2;
          for (let wy = top + gy; wy < sp.base - gy; wy += gy) {
            for (let wx = x + gx * 0.6; wx < x + bw - gx * 0.6; wx += gx) {
              if (r() < sp.win * (0.6 + downtown)) {
                const green = r() < 0.18;
                g.fillStyle = green ? 'rgba(120,255,150,' + (0.35 + r() * 0.4) + ')' : 'rgba(255,214,150,' + (0.25 + r() * 0.45) + ')';
                g.fillRect(wx, wy, cw, chh);
                if (li === 1 && r() < 0.05) windowsLit.push({ layer: li, x: wx, y: wy, w: cw, h: chh, green, on: true });
              }
            }
          }
        }
        x += bw + W * (r() < 0.25 ? 0.006 : 0.001);
      }
      layers.push({ canvas: c, ctx: g, par: sp.par, antennas, LW });
    });

    // grain and vignette, made once
    grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 256;
    const gg = grainTile.getContext('2d'), id = gg.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 14; }
    gg.putImageData(id, 0, 0);
    grainPattern = ctx.createPattern(grainTile, 'repeat');
    vignette = ctx.createRadialGradient(W * 0.55, H * 0.5, H * 0.35, W * 0.55, H * 0.5, H * 1.05);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.7)');
  }

  function sky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#030705'); g.addColorStop(0.45, '#06120b'); g.addColorStop(0.72, '#123020'); g.addColorStop(0.80, '#3a1f35'); g.addColorStop(1, '#0a0f0b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // the city's glow behind downtown, and a thin pink band of haze on the horizon
    const gl = ctx.createRadialGradient(W * 0.66, H * 0.82, 0, W * 0.66, H * 0.82, W * 0.5);
    gl.addColorStop(0, 'rgba(77,255,106,0.22)'); gl.addColorStop(0.5, 'rgba(24,180,64,0.08)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    const pk = ctx.createLinearGradient(0, H * 0.68, 0, H * 0.84);
    pk.addColorStop(0, 'rgba(255,95,174,0)'); pk.addColorStop(0.7, 'rgba(255,95,174,0.10)'); pk.addColorStop(1, 'rgba(255,95,174,0)');
    ctx.fillStyle = pk; ctx.fillRect(0, H * 0.68, W, H * 0.16);
  }

  function palm(x, base, h, lean, t, seed) {
    const sway = Math.sin(t * 0.6 + seed) * 0.02 + Math.sin(t * 1.3 + seed * 2) * 0.008;
    const topX = x + h * (lean + sway), topY = base - h;
    ctx.strokeStyle = '#010302'; ctx.fillStyle = '#010302'; ctx.lineCap = 'round';
    // trunk, tapering
    for (let i = 0; i < 12; i++) {
      const a = i / 12, b = (i + 1) / 12;
      const p = (s) => [x + (topX - x) * s + Math.sin(s * 3.1) * h * 0.03, base + (topY - base) * s];
      const [x1, y1] = p(a), [x2, y2] = p(b);
      ctx.lineWidth = h * (0.035 - 0.02 * a); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // fronds: filled, feathered leaves that droop from the crown
    for (let k = 0; k < 10; k++) {
      const ang = -Math.PI / 2 + (k - 4.5) * 0.38 + sway * 4 + Math.sin(t * 0.9 + k + seed) * 0.035;
      const len = h * (0.34 + ((k * 7) % 3) * 0.05);
      const ex = topX + Math.cos(ang) * len, ey = topY + Math.sin(ang) * len * 0.5 + len * 0.48;
      const mx = topX + Math.cos(ang) * len * 0.55, my = topY + Math.sin(ang) * len * 0.55 - len * 0.1;
      const N = 26, L = [], R = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, a = 1 - u;
        const px = a * a * topX + 2 * a * u * mx + u * u * ex, py = a * a * topY + 2 * a * u * my + u * u * ey;
        const tx = 2 * a * (mx - topX) + 2 * u * (ex - mx), ty = 2 * a * (my - topY) + 2 * u * (ey - my);
        const tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
        const w = h * 0.055 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 0.7) * (0.55 + 0.45 * Math.abs(Math.sin(u * 34 + k)));
        L.push([px + nx * w, py + ny * w + w * 0.35]); R.push([px - nx * w * 0.8, py - ny * w * 0.8 + w * 0.35]);
      }
      ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
      for (const q of L) ctx.lineTo(q[0], q[1]);
      for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(topX, topY + h * 0.01, h * 0.022, 0, 6.29); ctx.fill();   // the crown
  }

  function heli(t) {
    const period = 34, ph = (t % period) / period;
    if (ph > 0.6) return;
    const p = ph / 0.6, x = W * (1.05 - 1.2 * p), y = H * (0.2 + 0.03 * Math.sin(p * 6));
    const s = H * 0.012;
    ctx.save();
    // searchlight cone
    const cg = ctx.createLinearGradient(x, y, x - W * 0.05, H * 0.8);
    cg.addColorStop(0, 'rgba(230,255,235,0.10)'); cg.addColorStop(1, 'rgba(230,255,235,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - W * 0.12, H * 0.82); ctx.lineTo(x + W * 0.02, H * 0.82); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#020604';
    ctx.beginPath(); ctx.ellipse(x, y, s * 1.6, s * 0.75, 0, 0, 6.29); ctx.fill();
    ctx.fillRect(x, y - s * 0.2, s * 3.2, s * 0.35);
    ctx.fillRect(x - s * 2.2, y - s * 1.05, s * 4.4, Math.max(1, s * 0.12));
    if (Math.floor(t * 2.5) % 2 === 0) { ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(x + s * 3.1, y - s * 0.1, Math.max(1.5, s * 0.25), 0, 6.29); ctx.fill(); }
    ctx.restore();
  }

  let last = performance.now(), flickerAt = 0, lastDraw = 0, grainK = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (now - lastDraw < 32) return;              // 30 fps is plenty for a slow scene
    lastDraw = now;
    const t = now / 1000, dt = Math.min(0.1, (now - last) / 1000); last = now;
    const drift = reduceMotion ? 0 : Math.sin(t * 0.035) * W * 0.04;

    sky();
    // stars
    for (const s of stars) { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * s.f + s.p); ctx.fillStyle = '#dff7e6'; ctx.fillRect(s.x * W, s.y * H, s.s, s.s); }
    ctx.globalAlpha = 1;
    // searchlights behind the skyline
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const b of beams) {
      const a = b.a + Math.sin(t * b.sp * 6.28 * 0.25) * 0.35, bx = b.x * W - drift * 0.3, by = H * 0.80;
      const L = H * 1.1, ex = bx + Math.sin(a) * L, ey = by - Math.cos(a) * L, wx = Math.cos(a) * W * b.w, wy = Math.sin(a) * W * b.w;
      const g = ctx.createLinearGradient(bx, by, ex, ey); g.addColorStop(0, 'rgba(140,255,170,0.16)'); g.addColorStop(1, 'rgba(140,255,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx - 2, by); ctx.lineTo(ex - wx, ey - wy); ctx.lineTo(ex + wx, ey + wy); ctx.lineTo(bx + 2, by); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    heli(t);
    // skyline layers with parallax
    layers.forEach((L, i) => {
      const ox = -(L.LW - W) / 2 + drift * L.par;
      ctx.drawImage(L.canvas, ox, 0);
      if (i === 1) for (const a of L.antennas) { if (Math.sin(t * 2.2 + a.p) > 0.6) { ctx.fillStyle = 'rgba(255,60,60,0.95)'; ctx.fillRect(a.x + ox - 2, a.y - 2, 5, 5); } }
      if (i === 1) {                     // low mist between the middle and front layers
        const m = ctx.createLinearGradient(0, H * 0.74, 0, H * 0.9); m.addColorStop(0, 'rgba(24,60,36,0)'); m.addColorStop(0.6, 'rgba(24,60,36,0.35)'); m.addColorStop(1, 'rgba(5,10,7,0.6)');
        ctx.fillStyle = m; ctx.fillRect(0, H * 0.74, W, H * 0.26);
      }
    });
    // a few windows switch on and off now and then
    if (t > flickerAt && windowsLit.length) {
      flickerAt = t + 0.6 + Math.random() * 1.4;
      const w = windowsLit[Math.floor(Math.random() * windowsLit.length)], L = layers[w.layer];
      L.ctx.fillStyle = '#08150d'; L.ctx.fillRect(w.x, w.y, w.w, w.h);
      w.on = !w.on;
      if (w.on) { L.ctx.fillStyle = w.green ? 'rgba(120,255,150,0.75)' : 'rgba(255,214,150,0.7)'; L.ctx.fillRect(w.x, w.y, w.w, w.h); }
    }
    // palms in front
    const pt = reduceMotion ? 0 : t;
    palm(W * 0.035 + drift * 1.1, H * 1.02, H * 0.62, 0.10, pt, 1);
    palm(W * 0.12 + drift * 1.1, H * 1.04, H * 0.44, -0.06, pt, 2.5);
    palm(W * 0.955 + drift * 1.1, H * 1.03, H * 0.66, -0.12, pt, 4);
    palm(W * 0.885 + drift * 1.1, H * 1.05, H * 0.40, 0.08, pt, 5.5);
    // grain and vignette
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    grainK = (grainK + 1) % 4;
    ctx.save(); ctx.translate(-grainK * 61, -grainK * 37);
    ctx.fillStyle = grainPattern; ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();

    renderBar();
  }

  build();
  window.addEventListener('resize', build);
  requestAnimationFrame(frame);
})();
