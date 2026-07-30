/* cinematic-bg.js
   Drop this file into your project and include:
     <script type="module" src="/assets/js/cinematic-bg.js"></script>
   This script injects its own CSS and creates three stacked canvases:
     - starsCanvas (layer 1)
     - cometsCanvas (layer 2)
     - nebulaCanvas (layer 3)
   It respects prefers-reduced-motion and pauses when the tab is hidden.
   It also disables legacy background canvases (galaxy-canvas, stars-canvas, fx-canvas)
   at runtime to ensure the new cinematic background is visible. The original
   canvases are restored if you call cleanup().
*/

const CinematicBG = (() => {
  // Config - tweakable
  const CONFIG = {
    starCountBase: 260,             // approximate at DPR=1; scales with devicePixelRatio
    starMaxSize: 1.8,
    starMinSize: 0.35,
    starTwinkleSpeed: 0.0035,       // base twinkle speed factor
    cometSpawnMin: 3000,            // ms
    cometSpawnMax: 8000,            // ms
    heroCometChance: 0.12,          // chance a spawn is a hero comet
    cometMinSpeed: 0.08,            // px/ms base
    cometMaxSpeed: 0.32,            // px/ms base
    cometMinLength: 220,
    cometMaxLength: 1200,
    maxCometsSimultaneous: 4,
    nebulaBlur: 80,                 // px blur on nebula offscreen render
    nebulaOpacity: 0.14,
    nebulaElements: 5,
    nebulaSlowMs: 60000,            // time for slow drift (ms)
    parallaxFactorStars: 15,        // px max movement
    parallaxFactorNebula: 6,
    deviceParallaxEnabled: true
  };

  // State variables
  let canvases = {};
  let ctx = {};
  let width = 0, height = 0, dpr = 1;
  let animId = null;
  let lastTs = 0;
  let visible = true;
  let reducedMotion = false;
  let mouse = { x: 0.5, y: 0.5 }; // normalized (0..1)
  let deviceTilt = { x: 0, y: 0 };
  let stars = [];
  let comets = [];
  let nextCometTimeout = null;
  let nebulaOffscreen = null;
  let nebulaSeedElements = [];
  let isRunning = false;
  // records for legacy canvases we hide so cleanup can restore them
  let legacyCanvasRecords = [];

  // Utility
  const rand = (a, b) => a + Math.random() * (b - a);
  const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Inject base CSS so canvases sit behind all content and are non-interactive
  function injectCSS() {
    const style = document.createElement('style');
    style.id = 'cinematic-bg-styles';
    style.textContent = `
#cinematic-bg-root{position:fixed;inset:0;pointer-events:none;z-index:-10;mix-blend-mode:normal}
.cinematic-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
@media (prefers-reduced-motion: reduce) {
  .cinematic-canvas { opacity: 0.95; }
}
    `;
    document.head.appendChild(style);
  }

  function createCanvases() {
    // root container
    let root = document.getElementById('cinematic-bg-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'cinematic-bg-root';
      // insert as first child so it's behind content
      document.body.insertBefore(root, document.body.firstChild);
    }

    // create three canvases, nebula behind stars visually but we draw in order nebula -> stars -> comets for compositing
    const layers = ['nebula', 'stars', 'comets'];
    layers.forEach(name => {
      if (!canvases[name]) {
        const c = document.createElement('canvas');
        c.className = 'cinematic-canvas';
        c.dataset.layer = name;
        // negative z so they are behind content; root already positioned behind
        c.style.zIndex = name === 'nebula' ? '-3' : (name === 'stars' ? '-2' : '-1');
        root.appendChild(c);
        canvases[name] = c;
        ctx[name] = c.getContext('2d', { alpha: true });
      }
    });
  }

  // Hide legacy canvases (safe runtime-only change). Records previous inline style so cleanup can restore.
  function hideLegacyCanvases() {
    try {
      const ids = ['galaxy-canvas', 'stars-canvas', 'fx-canvas'];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          legacyCanvasRecords.push({ el, display: el.style.display || '', visibility: el.style.visibility || '', ariaHidden: el.getAttribute('aria-hidden') });
          el.style.display = 'none';
          el.setAttribute('data-cinematic-hidden', 'true');
        }
      });
    } catch (e) {
      // non-fatal
      console.warn('Failed to hide legacy canvases', e);
    }
  }

  // Restore legacy canvases on cleanup
  function restoreLegacyCanvases() {
    legacyCanvasRecords.forEach(rec => {
      try {
        rec.el.style.display = rec.display;
        rec.el.style.visibility = rec.visibility;
        if (rec.ariaHidden !== null) rec.el.setAttribute('aria-hidden', rec.ariaHidden);
        else rec.el.removeAttribute('aria-hidden');
        rec.el.removeAttribute('data-cinematic-hidden');
      } catch (e) { /* ignore */ }
    });
    legacyCanvasRecords = [];
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); // cap DPR to reduce work
    width = Math.max(1, Math.floor(window.innerWidth));
    height = Math.max(1, Math.floor(window.innerHeight));
    Object.values(canvases).forEach(c => {
      c.width = width * dpr;
      c.height = height * dpr;
      c.style.width = width + 'px';
      c.style.height = height + 'px';
      const layer = c.dataset.layer;
      ctx[layer].setTransform(dpr, 0, 0, dpr, 0, 0);
      // prefer additive blending for glows on comets/nebula
      if (layer === 'comets' || layer === 'nebula') {
        ctx[layer].globalCompositeOperation = 'lighter';
      } else {
        ctx[layer].globalCompositeOperation = 'source-over';
      }
    });
    // stars density scales with viewport and dpr
    const starTarget = Math.round(CONFIG.starCountBase * (Math.sqrt(width * height) / 1000) * dpr);
    initStars(starTarget);
    preRenderNebula();
  }

  // --- STARS LAYER ---
  function initStars(count) {
    const old = stars;
    stars = [];
    for (let i = 0; i < count; i++) {
      const size = rand(CONFIG.starMinSize, CONFIG.starMaxSize);
      const x = Math.random() * width;
      const y = Math.random() * height;
      const baseAlpha = clamp(0.35 + Math.random() * 0.65 - (size / CONFIG.starMaxSize) * 0.2, 0.12, 0.95);
      const twinkleSpeed = CONFIG.starTwinkleSpeed * rand(0.6, 1.6);
      const twinklePhase = Math.random() * Math.PI * 2;
      const pulse = Math.random() < 0.08 ? rand(0.06, 0.2) : 0;
      const colorHue = rand(210, 290);
      const color = `hsl(${colorHue}deg, ${rand(25,60)}%, ${rand(85,95)}%)`;
      stars.push({ x, y, size, baseAlpha, twinkleSpeed, twinklePhase, pulse, color });
    }
    for (let i = 0; i < Math.min(old.length, stars.length); i++) {
      if (i % 7 === 0) stars[i].x = old[i].x, stars[i].y = old[i].y;
    }
  }

  function drawStars(dt, parallaxOffset) {
    const c = ctx.stars;
    c.clearRect(0, 0, width, height);
    c.save();
    c.translate(parallaxOffset.x, parallaxOffset.y);
    for (let s of stars) {
      s.twinklePhase += s.twinkleSpeed * dt;
      const tw = (Math.sin(s.twinklePhase) + 1) / 2;
      const alpha = clamp(s.baseAlpha * (0.7 + 0.6 * tw) + (s.pulse ? Math.sin(s.twinklePhase * 1.7) * s.pulse : 0), 0, 1);
      c.globalAlpha = alpha;
      if (s.size > 1.2) {
        const grad = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 3);
        grad.addColorStop(0, s.color);
        grad.addColorStop(0.2, s.color);
        grad.addColorStop(0.6, 'rgba(255,255,255,0.05)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = grad;
        c.beginPath();
        c.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    c.globalAlpha = 1;
  }

  // --- COMETS LAYER ---
  function scheduleNextComet() {
    if (nextCometTimeout !== null) return;
    const interval = rand(CONFIG.cometSpawnMin, CONFIG.cometSpawnMax);
    nextCometTimeout = setTimeout(() => {
      nextCometTimeout = null;
      if (comets.length < CONFIG.maxCometsSimultaneous) spawnComet();
      scheduleNextComet();
    }, interval);
  }

  function spawnComet() {
    const hero = Math.random() < CONFIG.heroCometChance;
    const size = hero ? rand(2.2, 3.8) : rand(0.9, 2.0);
    const length = hero ? rand(CONFIG.cometMaxLength * 0.6, CONFIG.cometMaxLength) : rand(CONFIG.cometMinLength, CONFIG.cometMaxLength * 0.55);
    const speed = rand(CONFIG.cometMinSpeed, CONFIG.cometMaxSpeed) * (hero ? 0.7 : 1);
    const directionQuadrant = Math.floor(Math.random() * 4);
    const angleRanges = [
      rand(Math.PI * 0.12, Math.PI * 0.38),
      rand(Math.PI * 0.62, Math.PI * 0.88),
      rand(Math.PI * 1.12, Math.PI * 1.38),
      rand(Math.PI * 1.62, Math.PI * 1.88),
    ];
    const angle = angleRanges[directionQuadrant];
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const spawnPos = (() => {
      const cx = width / 2, cy = height / 2;
      const radius = Math.max(width, height) * 0.9;
      const sx = cx - dirX * radius * rand(0.9, 1.2);
      const sy = cy - dirY * radius * rand(0.85, 1.15);
      return { sx, sy };
    })();

    const x = spawnPos.sx;
    const y = spawnPos.sy;
    const vx = dirX * speed;
    const vy = dirY * speed;
    const life = 100000;
    const opacity = hero ? rand(0.85, 1) : rand(0.55, 0.85);

    comets.push({ x, y, vx, vy, size, length, life, opacity, age: 0, fade: 0, hero });
  }

  function drawComets(dt) {
    const c = ctx.comets;
    c.clearRect(0, 0, width, height);
    for (let i = comets.length - 1; i >= 0; i--) {
      const com = comets[i];
      com.age += dt;
      com.x += com.vx * dt;
      com.y += com.vy * dt;
      const fadeIn = 300;
      const fadeOut = 1000;
      let alpha = com.opacity;
      if (com.age < fadeIn) alpha *= (com.age / fadeIn);
      const offLeft = com.x < -com.length - 200;
      const offRight = com.x > width + com.length + 200;
      const offTop = com.y < -com.length - 200;
      const offBottom = com.y > height + com.length + 200;
      if (offLeft || offRight || offTop || offBottom) {
        com.fade += dt;
        alpha *= clamp(1 - com.fade / fadeOut, 0, 1);
      }

      const segments = Math.round(clamp(com.length / 25, 6, 36));
      const dx = -com.vx * (com.length / segments) * 0.9;
      const dy = -com.vy * (com.length / segments) * 0.9;
      const grad = c.createRadialGradient(com.x, com.y, 0, com.x, com.y, com.size * 14);
      grad.addColorStop(0, `rgba(255,255,255,${0.95 * alpha})`);
      grad.addColorStop(0.12, `rgba(255,230,255,${0.6 * alpha})`);
      grad.addColorStop(0.28, `rgba(200,170,255,${0.32 * alpha})`);
      grad.addColorStop(1, `rgba(120,120,255,0)`);
      c.globalAlpha = 1;
      c.fillStyle = grad;
      c.beginPath();
      c.arc(com.x, com.y, com.size * 8, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = `rgba(255,255,255,${0.95 * alpha})`;
      c.beginPath();
      c.arc(com.x, com.y, com.size * 1.6, 0, Math.PI * 2);
      c.fill();

      for (let s = 0; s < segments; s++) {
        const t = s / segments;
        const segX = com.x + dx * s * 0.9;
        const segY = com.y + dy * s * 0.9;
        const segAlpha = alpha * (1 - t) * (com.hero ? 0.95 : 0.7) * (0.9 + Math.sin(com.age * 0.002 + s) * 0.05);
        const segRadius = com.size * ( (1 + (1 - t) * 6) );
        const tailGrad = c.createRadialGradient(segX, segY, 0, segX, segY, segRadius * 2);
        tailGrad.addColorStop(0, `rgba(255,240,255,${segAlpha * 0.8})`);
        tailGrad.addColorStop(0.18, `rgba(210,180,255,${segAlpha * 0.65})`);
        tailGrad.addColorStop(0.45, `rgba(180,200,255,${segAlpha * 0.35})`);
        tailGrad.addColorStop(1, `rgba(120,120,255,0)`);
        c.fillStyle = tailGrad;
        c.beginPath();
        c.arc(segX, segY, segRadius, 0, Math.PI * 2);
        c.fill();
      }

      if (com.fade > 900 || (com.age > com.life)) {
        comets.splice(i, 1);
      }
    }
    c.globalAlpha = 1;
  }

  // --- NEBULA LAYER ---
  function preRenderNebula() {
    const off = document.createElement('canvas');
    const ow = Math.max(600, Math.round(width * 0.9));
    const oh = Math.max(400, Math.round(height * 0.9));
    off.width = ow * dpr;
    off.height = oh * dpr;
    const oc = off.getContext('2d');
    oc.setTransform(dpr, 0, 0, dpr, 0, 0);
    oc.clearRect(0, 0, ow, oh);

    const palette = [
      { color: 'rgba(190,120,255,', base: 0.35 },
      { color: 'rgba(255,160,210,', base: 0.20 },
      { color: 'rgba(140,190,255,', base: 0.22 },
      { color: 'rgba(105,85,220,', base: 0.12 }
    ];
    nebulaSeedElements = [];
    for (let i = 0; i < CONFIG.nebulaElements; i++) {
      const rx = rand(-0.2, 1.2) * ow;
      const ry = rand(-0.15, 1.15) * oh;
      const rr = rand(Math.min(ow, oh) * 0.25, Math.max(ow, oh) * 0.9);
      const pal = choose(palette);
      nebulaSeedElements.push({ x: rx, y: ry, r: rr, color: pal.color, base: pal.base, phase: Math.random() * Math.PI * 2 });
      const g = oc.createRadialGradient(rx, ry, 0, rx, ry, rr);
      g.addColorStop(0, pal.color + (pal.base * 1.0) + ')');
      g.addColorStop(0.15, pal.color + (pal.base * 0.75) + ')');
      g.addColorStop(0.35, pal.color + (pal.base * 0.32) + ')');
      g.addColorStop(0.65, pal.color + (pal.base * 0.12) + ')');
      g.addColorStop(1, pal.color + '0)');
      oc.globalAlpha = 1;
      oc.fillStyle = g;
      oc.beginPath();
      oc.arc(rx, ry, rr, 0, Math.PI * 2);
      oc.fill();
    }

    const final = document.createElement('canvas');
    final.width = ow * dpr;
    final.height = oh * dpr;
    const fc = final.getContext('2d');
    fc.setTransform(dpr, 0, 0, dpr, 0, 0);
    const blurPasses = 5;
    fc.clearRect(0, 0, ow, oh);
    fc.globalAlpha = 1 / blurPasses;
    for (let b = 0; b < blurPasses; b++) {
      const offset = (b - blurPasses / 2) * (CONFIG.nebulaBlur / 160);
      fc.drawImage(off, offset, offset, ow, oh);
    }
    nebulaOffscreen = final;
  }

  function drawNebula(ts, parallaxOffset) {
    const c = ctx.nebula;
    c.clearRect(0, 0, width, height);
    if (!nebulaOffscreen) return;
    c.save();
    const opacity = CONFIG.nebulaOpacity;
    c.globalAlpha = opacity;
    const baseX = (width - nebulaOffscreen.width / dpr) * 0.5;
    const baseY = (height - nebulaOffscreen.height / dpr) * 0.5;
    const driftX = Math.sin(ts / CONFIG.nebulaSlowMs) * (width * 0.015);
    const driftY = Math.cos(ts / (CONFIG.nebulaSlowMs * 1.3)) * (height * 0.02);
    c.translate(parallaxOffset.x * 0.5, parallaxOffset.y * 0.5);
    c.drawImage(nebulaOffscreen, baseX + driftX, baseY + driftY, nebulaOffscreen.width / dpr, nebulaOffscreen.height / dpr);
    const grad = c.createRadialGradient(width * 0.5, height * 0.46, 0, width * 0.5, height * 0.46, Math.max(width, height) * 0.8);
    grad.addColorStop(0, 'rgba(200,180,255,0.06)');
    grad.addColorStop(0.5, 'rgba(140,160,255,0.02)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalCompositeOperation = 'soft-light';
    c.fillStyle = grad;
    c.fillRect(0, 0, width, height);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 1;
    c.restore();
  }

  // --- PARALLAX --- mouse and device orientation
  let parallax = { x: 0, y: 0 };
  function updateParallax() {
    const mx = (mouse.x - 0.5) * 2;
    const my = (mouse.y - 0.5) * 2;
    const tiltX = deviceTilt.x || 0;
    const tiltY = deviceTilt.y || 0;
    parallax.x = (mx * CONFIG.parallaxFactorStars) + (tiltX * CONFIG.parallaxFactorStars * 0.6);
    parallax.y = (my * CONFIG.parallaxFactorStars) + (tiltY * CONFIG.parallaxFactorStars * 0.6);
  }

  // Input handlers
  function onMouseMove(e) {
    mouse.x = clamp(e.clientX / width, 0, 1);
    mouse.y = clamp(e.clientY / height, 0, 1);
  }

  function onDeviceOrientation(e) {
    if (!CONFIG.deviceParallaxEnabled) return;
    const gamma = e.gamma || 0;
    const beta = e.beta || 0;
    deviceTilt.x = clamp(gamma / 45, -1, 1);
    deviceTilt.y = clamp(beta / 45, -1, 1);
  }

  // Respect prefers-reduced-motion
  function checkReducedMotion() {
    reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Pause / resume when tab hidden
  function onVisibilityChange() {
    visible = !document.hidden;
    if (!visible) pause();
    else resume();
  }

  function pause() {
    if (!isRunning) return;
    isRunning = false;
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    if (nextCometTimeout) clearTimeout(nextCometTimeout), nextCometTimeout = null;
  }

  function resume() {
    if (isRunning) return;
    isRunning = true;
    lastTs = performance.now();
    scheduleNextComet();
    tick(lastTs);
  }

  // Main loop
  function tick(ts) {
    if (!isRunning) return;
    const dt = ts - lastTs;
    lastTs = ts;
    updateParallax();
    const parStars = { x: parallax.x * 1.0, y: parallax.y * 1.0 };
    const parNebula = { x: parallax.x * (CONFIG.parallaxFactorNebula / CONFIG.parallaxFactorStars), y: parallax.y * (CONFIG.parallaxFactorNebula / CONFIG.parallaxFactorStars) };
    if (!reducedMotion) {
      drawNebula(ts, parNebula);
      drawStars(dt, parStars);
      drawComets(dt);
    } else {
      drawNebula(ts, { x: 0, y: 0 });
      drawStars(dt * 0, { x: 0, y: 0 });
    }
    animId = requestAnimationFrame(tick);
  }

  // Public init
  function init() {
    if (typeof document === 'undefined') return;
    injectCSS();
    createCanvases();
    // Hide legacy canvases so the cinematic background is visible. We record
    // their previous inline styles so cleanup can restore them if needed.
    hideLegacyCanvases();
    checkReducedMotion();
    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange, false);
    mouse.x = 0.5; mouse.y = 0.5;
    if (!reducedMotion) {
      isRunning = true;
      lastTs = performance.now();
      scheduleNextComet();
      animId = requestAnimationFrame(tick);
    } else {
      isRunning = true;
      lastTs = performance.now();
      animId = requestAnimationFrame(tick);
    }
  }

  // Cleanup - remove inserted root and listeners (for replacing/rollback)
  function cleanup() {
    pause();
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('deviceorientation', onDeviceOrientation);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    const r = document.getElementById('cinematic-bg-root');
    if (r && r.parentNode) r.parentNode.removeChild(r);
    // restore legacy canvases if we hid them
    restoreLegacyCanvases();
    const style = document.getElementById('cinematic-bg-styles');
    if (style && style.parentNode) style.parentNode.removeChild(style);
  }

  // Run on load (delay slightly to avoid racing with existing scripts)
  setTimeout(() => {
    try { init(); } catch (err) { console.error('CinematicBG init failed', err); }
  }, 250);

  // Expose for debugging/cleanup
  return { init, cleanup, _state: () => ({ stars, comets, nebulaSeedElements, legacyCanvasRecords }) };
})();

// Allow global access for debugging in dev console:
// CinematicBG.cleanup() to remove canvases and stop animation
window.CinematicBG = CinematicBG;
export default CinematicBG;
