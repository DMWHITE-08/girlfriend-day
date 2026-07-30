/* cinematic-bg.js
   Drop this file into your project and include:
     <script type="module" src="/assets/js/cinematic-bg.js"></script>
   This script injects its own CSS and creates three stacked canvases:
     - starsCanvas (layer 1)
     - cometsCanvas (layer 2)
     - nebulaCanvas (layer 3)
   It respects prefers-reduced-motion and pauses when the tab is hidden.
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

  // Utility
  const rand = (a, b) => a + Math.random() * (b - a);
  const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Inject base CSS so canvases sit behind all content and are non-interactive
  function injectCSS() {
    const style = document.createElement('style');
    style.textContent = `
#cinematic-bg-root{position:fixed;inset:0;pointer-events:none;z-index:0;mix-blend-mode:normal}
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
      // insert as first child so it's behind content but in normal stacking; if site uses z-index on content, content should remain above
      document.body.insertBefore(root, document.body.firstChild);
    }

    // create three canvases, nebula behind stars visually but we draw in order nebula -> stars -> comets for compositing
    const layers = ['nebula', 'stars', 'comets'];
    layers.forEach(name => {
      if (!canvases[name]) {
        const c = document.createElement('canvas');
        c.className = 'cinematic-canvas';
        c.dataset.layer = name;
        c.style.zIndex = name === 'nebula' ? '-3' : (name === 'stars' ? '-2' : '-1');
        root.appendChild(c);
        canvases[name] = c;
        ctx[name] = c.getContext('2d', { alpha: true });
      }
    });
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
    // keep existing stars near positions if already created to reduce popping
    const old = stars;
    stars = [];
    for (let i = 0; i < count; i++) {
      const size = rand(CONFIG.starMinSize, CONFIG.starMaxSize);
      const x = Math.random() * width;
      const y = Math.random() * height;
      const baseAlpha = clamp(0.35 + Math.random() * 0.65 - (size / CONFIG.starMaxSize) * 0.2, 0.12, 0.95);
      const twinkleSpeed = CONFIG.starTwinkleSpeed * rand(0.6, 1.6);
      const twinklePhase = Math.random() * Math.PI * 2;
      const pulse = Math.random() < 0.08 ? rand(0.06, 0.2) : 0; // a small subset pulse slightly
      const colorHue = rand(210, 290); // bluish/purpleish tone variance
      const color = `hsl(${colorHue}deg, ${rand(25,60)}%, ${rand(85,95)}%)`;
      stars.push({ x, y, size, baseAlpha, twinkleSpeed, twinklePhase, pulse, color });
    }
    // keep some from old to avoid full refresh
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
      // twinkle progress
      s.twinklePhase += s.twinkleSpeed * dt;
      const tw = (Math.sin(s.twinklePhase) + 1) / 2; // 0..1
      const alpha = clamp(s.baseAlpha * (0.7 + 0.6 * tw) + (s.pulse ? Math.sin(s.twinklePhase * 1.7) * s.pulse : 0), 0, 1);
      c.globalAlpha = alpha;
      // subtle color
      if (s.size > 1.2) {
        // slightly brighter with glow
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
    // Comet defined by head position, velocity, length, color palette
    const hero = Math.random() < CONFIG.heroCometChance;
    const size = hero ? rand(2.2, 3.8) : rand(0.9, 2.0);
    const length = hero ? rand(CONFIG.cometMaxLength * 0.6, CONFIG.cometMaxLength) : rand(CONFIG.cometMinLength, CONFIG.cometMaxLength * 0.55);
    const speed = rand(CONFIG.cometMinSpeed, CONFIG.cometMaxSpeed) * (hero ? 0.7 : 1);
    // pick spawn edge and direction so motion is diagonal and elegant
    // We spawn slightly off-canvas and move diagonally across
    const edge = Math.random();
    let x, y, vx, vy;
    // angles in rad for diagonals around 20-70 degrees
    const directionQuadrant = Math.floor(Math.random() * 4);
    const angleRanges = [
      rand(Math.PI * 0.12, Math.PI * 0.38),         // down-right-ish
      rand(Math.PI * 0.62, Math.PI * 0.88),         // down-left
      rand(Math.PI * 1.12, Math.PI * 1.38),         // up-left
      rand(Math.PI * 1.62, Math.PI * 1.88),         // up-right
    ];
    const angle = angleRanges[directionQuadrant];
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    // spawn somewhere on the opposite edge so it crosses screen
    // choose spawn distance offscreen
    const margin = 120;
    // determine spawn box based on angle quadrant
    // we'll compute a spawn line outside canvas
    const spawnPos = (() => {
      // spawn offscreen in a circle around canvas center, moved along negative direction so it moves into screen
      const cx = width / 2, cy = height / 2;
      const radius = Math.max(width, height) * 0.9;
      const sx = cx - dirX * radius * rand(0.9, 1.2);
      const sy = cy - dirY * radius * rand(0.85, 1.15);
      return { sx, sy };
    })();

    x = spawnPos.sx;
    y = spawnPos.sy;
    vx = dirX * speed;
    vy = dirY * speed;

    // color palette for comet: white core, purple/pink/blue glow
    const palette = [
      { stop: 0, color: 'rgba(255,255,255,1)' },
      { stop: 0.18, color: 'rgba(255,220,255,0.95)' },
      { stop: 0.45, color: 'rgba(200,170,255,0.55)' },
      { stop: 0.8, color: 'rgba(160,200,255,0.18)' },
      { stop: 1, color: 'rgba(120,120,255,0)' }
    ];
    const hueShift = hero ? rand(-12, 12) : rand(-35, 35);

    const life = 100000; // very large life; we will remove when fully offscreen/faded
    const opacity = hero ? rand(0.85, 1) : rand(0.55, 0.85);

    comets.push({
      x, y, vx, vy, size, length, palette, hueShift, life, opacity,
      age: 0, fade: 0, hero
    });
  }

  function drawComets(dt) {
    const c = ctx.comets;
    c.clearRect(0, 0, width, height);
    const now = performance.now();
    for (let i = comets.length - 1; i >= 0; i--) {
      const com = comets[i];
      com.age += dt;
      // move
      com.x += com.vx * dt;
      com.y += com.vy * dt;

      // fade in/out
      const fadeIn = 300;
      const fadeOut = 1000;
      let alpha = com.opacity;
      if (com.age < fadeIn) alpha *= (com.age / fadeIn);
      // if offscreen beyond tail length + margin, start fade out and remove
      const offLeft = com.x < -com.length - 200;
      const offRight = com.x > width + com.length + 200;
      const offTop = com.y < -com.length - 200;
      const offBottom = com.y > height + com.length + 200;
      if (offLeft || offRight || offTop || offBottom) {
        com.fade += dt;
        alpha *= clamp(1 - com.fade / fadeOut, 0, 1);
      }

      // draw tail as a set of fading segments along reverse path to create motion blur
      const segments = Math.round(clamp(com.length / 25, 6, 36));
      const dx = -com.vx * (com.length / segments) * 0.9;
      const dy = -com.vy * (com.length / segments) * 0.9;
      // head glow
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

      // core
      c.fillStyle = `rgba(255,255,255,${0.95 * alpha})`;
      c.beginPath();
      c.arc(com.x, com.y, com.size * 1.6, 0, Math.PI * 2);
      c.fill();

      // tail segments
      // use additive blending already set on context
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

      // remove if invisible and offscreen for some time
      if (com.fade > 900 || (com.age > com.life)) {
        comets.splice(i, 1);
      }
    }
    c.globalAlpha = 1;
  }

  // --- NEBULA LAYER ---
  function preRenderNebula() {
    // pre-render soft blended blobs onto an offscreen canvas and reuse
    const off = document.createElement('canvas');
    const ow = Math.max(600, Math.round(width * 0.9));
    const oh = Math.max(400, Math.round(height * 0.9));
    off.width = ow * dpr;
    off.height = oh * dpr;
    const oc = off.getContext('2d');
    oc.setTransform(dpr, 0, 0, dpr, 0, 0);
    oc.clearRect(0, 0, ow, oh);

    // create a few soft gradient blobs in purple/pink/blue/indigo
    const palette = [
      { color: 'rgba(190,120,255,', base: 0.35 },   // purple
      { color: 'rgba(255,160,210,', base: 0.20 },   // pink
      { color: 'rgba(140,190,255,', base: 0.22 },   // blue
      { color: 'rgba(105,85,220,', base: 0.12 }     // indigo haze
    ];
    nebulaSeedElements = [];
    for (let i = 0; i < CONFIG.nebulaElements; i++) {
      const rx = rand(-0.2, 1.2) * ow;
      const ry = rand(-0.15, 1.15) * oh;
      const rr = rand(Math.min(ow, oh) * 0.25, Math.max(ow, oh) * 0.9);
      const pal = choose(palette);
      nebulaSeedElements.push({ x: rx, y: ry, r: rr, color: pal.color, base: pal.base, phase: Math.random() * Math.PI * 2 });
      const g = oc.createRadialGradient(rx, ry, 0, rx, ry, rr);
      // subtle multi-stop
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

    // apply blur by drawing to another temporary canvas with CSS blur simulated via multiple draws
    // Using canvas filter can be heavy; we approximate by scaling trick
    // Create final canvas sized to viewport
    const final = document.createElement('canvas');
    final.width = ow * dpr;
    final.height = oh * dpr;
    const fc = final.getContext('2d');
    fc.setTransform(dpr, 0, 0, dpr, 0, 0);
    // blur by repeated draws with small offsets (cheap approximation)
    const blurPasses = 5;
    fc.clearRect(0, 0, ow, oh);
    fc.globalAlpha = 1 / blurPasses;
    for (let b = 0; b < blurPasses; b++) {
      const offset = (b - blurPasses / 2) * (CONFIG.nebulaBlur / 160);
      fc.drawImage(off, offset, offset, ow, oh);
    }
    // reduce overall opacity
    nebulaOffscreen = final;
  }

  function drawNebula(ts, parallaxOffset) {
    const c = ctx.nebula;
    c.clearRect(0, 0, width, height);
    if (!nebulaOffscreen) return;
    c.save();
    // very low opacity, very slow movement
    const opacity = CONFIG.nebulaOpacity;
    c.globalAlpha = opacity;
    // draw the pre-rendered nebula centered with a slow drift influenced by ts
    const baseX = (width - nebulaOffscreen.width / dpr) * 0.5;
    const baseY = (height - nebulaOffscreen.height / dpr) * 0.5;
    // subtle animated offset
    const driftX = Math.sin(ts / CONFIG.nebulaSlowMs) * (width * 0.015);
    const driftY = Math.cos(ts / (CONFIG.nebulaSlowMs * 1.3)) * (height * 0.02);
    c.translate(parallaxOffset.x * 0.5, parallaxOffset.y * 0.5);
    c.drawImage(nebulaOffscreen, baseX + driftX, baseY + driftY, nebulaOffscreen.width / dpr, nebulaOffscreen.height / dpr);
    // faint galaxy haze center
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
    // compute small offsets based on mouse and device tilt
    const mx = (mouse.x - 0.5) * 2; // -1..1
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
    // gamma: left/right tilt [-90,90], beta: front/back [-180,180]
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
    // update parallax
    updateParallax();

    // apply two parallax levels: stars more pronounced, nebula subtler
    const parStars = { x: parallax.x * 1.0, y: parallax.y * 1.0 };
    const parNebula = { x: parallax.x * (CONFIG.parallaxFactorNebula / CONFIG.parallaxFactorStars), y: parallax.y * (CONFIG.parallaxFactorNebula / CONFIG.parallaxFactorStars) };

    // Clear and draw layers (draw order: nebula behind, stars, comets on top)
    if (!reducedMotion) {
      drawNebula(ts, parNebula);
      drawStars(dt, parStars);
      drawComets(dt);
    } else {
      // reduced motion: static subtle nebula + static starfield
      drawNebula(ts, { x: 0, y: 0 });
      drawStars(dt * 0, { x: 0, y: 0 }); // run a static draw with no twinkle
    }

    animId = requestAnimationFrame(tick);
  }

  // Public init
  function init() {
    if (typeof document === 'undefined') return;
    injectCSS();
    createCanvases();
    checkReducedMotion();
    resize();
    // event listeners
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange, false);

    // initial parallax mouse center
    mouse.x = 0.5;
    mouse.y = 0.5;

    // start animations if allowed
    if (!reducedMotion) {
      isRunning = true;
      lastTs = performance.now();
      scheduleNextComet();
      animId = requestAnimationFrame(tick);
    } else {
      // if reduced motion requested, show static low-effort background (stars only)
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
    // also remove injected styles (simple approach: remove last style tag we injected by matching idless heuristics is unsafe)
    // If you want aggressive cleanup, add an id to injected style; for now we leave head tidy.
  }

  // Run on load
  setTimeout(() => {
    try { init(); } catch (err) { console.error('CinematicBG init failed', err); }
  }, 250);

  // Expose for debugging/cleanup
  return { init, cleanup, _state: () => ({ stars, comets, nebulaSeedElements }) };
})();

// Allow global access for debugging in dev console:
// CinematicBG.cleanup() to remove canvases and stop animation
window.CinematicBG = CinematicBG;
export default CinematicBG;
