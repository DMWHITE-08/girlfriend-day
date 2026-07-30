/* =========================================================================
   A LITTLE SURPRISE FOR YOU — ALBIN ❤ ARLIN
   Premium Black Glassmorphism Galaxy Experience
   ========================================================================= */

(() => {
  'use strict';

  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  // Track tab visibility to save power & maintain target frame rates
  let isTabActive = !document.hidden;
  document.addEventListener('visibilitychange', () => {
    isTabActive = !document.hidden;
    if (isTabActive) {
      requestAnimationFrame(mainAnimationLoop);
    }
  });

  /* ======================================================================
     1. CANVAS SETUP & HIGH-DPI SCALING
     ====================================================================== */
  const galaxyCanvas = document.getElementById('galaxy-canvas');
  const starsCanvas = document.getElementById('stars-canvas');
  const fxCanvas = document.getElementById('fx-canvas');

  const galaxyCtx = galaxyCanvas ? galaxyCanvas.getContext('2d') : null;
  const starsCtx = starsCanvas ? starsCanvas.getContext('2d') : null;
  const fxCtx = fxCanvas ? fxCanvas.getContext('2d') : null;

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resizeCanvases() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    [galaxyCanvas, starsCanvas, fxCanvas].forEach(canvas => {
      if (!canvas) return;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    });

    initNebula();
    initStars();
  }

  /* ======================================================================
     2. LAYER 3: SLOW-MOVING NEBULA BACKGROUND
     ====================================================================== */
  let nebulaBlobs = [];

  function initNebula() {
    const count = width < 600 ? 5 : 8;
    nebulaBlobs = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * (width * 0.4) + width * 0.25,
      hue: [270, 220, 190, 290][Math.floor(Math.random() * 4)],
      speedX: (Math.random() - 0.5) * 0.08,
      speedY: (Math.random() - 0.5) * 0.08,
      alpha: Math.random() * 0.08 + 0.05,
    }));
  }

  function drawNebula(time) {
    if (!galaxyCtx) return;
    galaxyCtx.clearRect(0, 0, width, height);

    galaxyCtx.fillStyle = '#000000';
    galaxyCtx.fillRect(0, 0, width, height);

    nebulaBlobs.forEach((b) => {
      b.x += b.speedX + Math.cos(time * 0.0001) * 0.05;
      b.y += b.speedY + Math.sin(time * 0.0001) * 0.05;

      if (b.x < -b.r) b.x = width + b.r;
      if (b.x > width + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = height + b.r;
      if (b.y > height + b.r) b.y = -b.r;

      const grad = galaxyCtx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      grad.addColorStop(0, `hsla(${b.hue}, 80%, 25%, ${b.alpha})`);
      grad.addColorStop(0.5, `hsla(${b.hue + 20}, 70%, 15%, ${b.alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      galaxyCtx.fillStyle = grad;
      galaxyCtx.beginPath();
      galaxyCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      galaxyCtx.fill();
    });
  }

  /* ======================================================================
     3. LAYER 1: TINY TWINKLING STARS
     ====================================================================== */
  let stars = [];

  function initStars() {
    const density = width < 600 ? 0.00045 : 0.00035;
    const count = Math.min(320, Math.floor(width * height * density));
    const starColors = ['#FFFFFF', '#F0F4F8', '#A5F3FC', '#E9D5FF', '#BAE6FD'];

    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.3 + 0.3,
      baseAlpha: Math.random() * 0.65 + 0.25,
      twinkleSpeed: Math.random() * 0.025 + 0.006,
      phase: Math.random() * Math.PI * 2,
      color: starColors[Math.floor(Math.random() * starColors.length)],
    }));
  }

  function drawStars(time) {
    if (!galaxyCtx) return;

    stars.forEach((s) => {
      const twinkle = Math.sin(time * s.twinkleSpeed + s.phase) * 0.38 + 0.62;
      const alpha = Math.max(0.05, Math.min(1, s.baseAlpha * twinkle));

      galaxyCtx.beginPath();
      galaxyCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      galaxyCtx.fillStyle = s.color;
      galaxyCtx.globalAlpha = alpha;
      galaxyCtx.fill();

      if (s.r > 1.1) {
        galaxyCtx.beginPath();
        galaxyCtx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2);
        galaxyCtx.fillStyle = s.color;
        galaxyCtx.globalAlpha = alpha * 0.25;
        galaxyCtx.fill();
      }
    });

    galaxyCtx.globalAlpha = 1.0;
  }

  /* ======================================================================
     4. LAYER 2: ELEGANT LONG-TAIL SHOOTING STARS (Continuous Spawning)
     ====================================================================== */
  let shootingStars = [];
  let lastShootingStarSpawn = -3000;

  function spawnShootingStar(time) {
    if (time - lastShootingStarSpawn < 2500) return;
    lastShootingStarSpawn = time;

    const isHero = Math.random() < 0.32;
    const startX = Math.random() * (width * 0.8) + width * 0.05;
    const startY = Math.random() * (height * 0.35) - 30;

    const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.15;
    const speed = isHero ? Math.random() * 4 + 13 : Math.random() * 4 + 9;
    const tailLength = isHero ? Math.random() * 160 + 280 : Math.random() * 120 + 170;

    shootingStars.push({
      x: startX,
      y: startY,
      len: tailLength,
      speed,
      angle,
      isHero,
      life: 1.0,
      decay: isHero ? 0.008 : 0.013,
      headRadius: isHero ? 2.8 : 1.8,
      sparks: [],
    });
  }

  function seedInitialShootingStars() {
    shootingStars.push({
      x: width * 0.25,
      y: height * 0.1,
      len: 220,
      speed: 11,
      angle: Math.PI / 3.8,
      isHero: true,
      life: 0.95,
      decay: 0.009,
      headRadius: 2.5,
      sparks: [],
    });
    shootingStars.push({
      x: width * 0.65,
      y: height * 0.05,
      len: 180,
      speed: 9.5,
      angle: Math.PI / 3.6,
      isHero: false,
      life: 0.85,
      decay: 0.012,
      headRadius: 1.8,
      sparks: [],
    });
  }

  function updateAndDrawShootingStars() {
    if (!starsCtx) return;
    starsCtx.clearRect(0, 0, width, height);

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const sh = shootingStars[i];

      const dx = Math.cos(sh.angle) * sh.speed;
      const dy = Math.sin(sh.angle) * sh.speed;
      sh.x += dx;
      sh.y += dy;
      sh.life -= sh.decay;

      if (sh.life <= 0 || sh.y > height + 200 || sh.x > width + 200) {
        shootingStars.splice(i, 1);
        continue;
      }

      const tailX = sh.x - Math.cos(sh.angle) * sh.len;
      const tailY = sh.y - Math.sin(sh.angle) * sh.len;

      const tailGrad = starsCtx.createLinearGradient(sh.x, sh.y, tailX, tailY);
      tailGrad.addColorStop(0, `rgba(255, 255, 255, ${sh.life * 0.98})`);
      tailGrad.addColorStop(0.15, `rgba(34, 211, 238, ${sh.life * 0.90})`);
      tailGrad.addColorStop(0.45, `rgba(124, 58, 237, ${sh.life * 0.60})`);
      tailGrad.addColorStop(0.80, `rgba(30, 58, 138, ${sh.life * 0.25})`);
      tailGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      starsCtx.lineWidth = sh.isHero ? 3.0 : 2.0;
      starsCtx.lineCap = 'round';
      starsCtx.strokeStyle = tailGrad;
      starsCtx.beginPath();
      starsCtx.moveTo(sh.x, sh.y);
      starsCtx.lineTo(tailX, tailY);
      starsCtx.stroke();

      starsCtx.beginPath();
      starsCtx.arc(sh.x, sh.y, sh.headRadius, 0, Math.PI * 2);
      starsCtx.fillStyle = `rgba(255, 255, 255, ${sh.life})`;
      starsCtx.fill();

      const headGlow = starsCtx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, sh.headRadius * 8);
      headGlow.addColorStop(0, `rgba(34, 211, 238, ${sh.life * 0.85})`);
      headGlow.addColorStop(0.45, `rgba(124, 58, 237, ${sh.life * 0.40})`);
      headGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      starsCtx.beginPath();
      starsCtx.arc(sh.x, sh.y, sh.headRadius * 8, 0, Math.PI * 2);
      starsCtx.fillStyle = headGlow;
      starsCtx.fill();

      if (sh.isHero && Math.random() < 0.65) {
        sh.sparks.push({
          x: sh.x - Math.cos(sh.angle) * (Math.random() * 15),
          y: sh.y - Math.sin(sh.angle) * (Math.random() * 15),
          vx: (Math.random() - 0.5) * 1.8,
          vy: (Math.random() - 0.5) * 1.8,
          life: 1.0,
          size: Math.random() * 1.8 + 0.9,
          color: Math.random() < 0.5 ? '#22D3EE' : '#C084FC',
        });
      }

      for (let j = sh.sparks.length - 1; j >= 0; j--) {
        const sp = sh.sparks[j];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life -= 0.035;
        if (sp.life <= 0) {
          sh.sparks.splice(j, 1);
          continue;
        }
        starsCtx.beginPath();
        starsCtx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        starsCtx.fillStyle = sp.color;
        starsCtx.globalAlpha = sp.life * sh.life;
        starsCtx.fill();
        starsCtx.globalAlpha = 1.0;
      }
    }
  }

  /* ======================================================================
     5. MAIN ANIMATION LOOP
     ====================================================================== */
  function mainAnimationLoop(timestamp) {
    if (!isTabActive) return;

    drawNebula(timestamp);
    drawStars(timestamp);

    spawnShootingStar(timestamp);
    updateAndDrawShootingStars();

    requestAnimationFrame(mainAnimationLoop);
  }

  window.addEventListener('resize', () => {
    resizeCanvases();
  });

  resizeCanvases();
  seedInitialShootingStars();
  requestAnimationFrame(mainAnimationLoop);

  /* ======================================================================
     6. AMBIENT FIREFLIES
     ====================================================================== */
  function spawnFireflies() {
    const container = document.getElementById('fireflies');
    if (!container) return;
    const count = width < 600 ? 8 : 14;

    for (let i = 0; i < count; i++) {
      const fly = document.createElement('span');
      fly.className = 'firefly';
      fly.style.left = `${Math.random() * 100}vw`;
      fly.style.top = `${Math.random() * 100}vh`;
      fly.style.setProperty('--fly-duration', `${Math.random() * 10 + 14}s`);
      fly.style.setProperty('--fly-delay', `${Math.random() * -20}s`);
      fly.style.setProperty('--fly-x', `${(Math.random() - 0.5) * 160}px`);
      fly.style.setProperty('--fly-y', `${(Math.random() - 0.5) * 160}px`);
      container.appendChild(fly);
    }
  }
  spawnFireflies();

  /* ======================================================================
     7. CURSOR GLOW (desktop only)
     ====================================================================== */
  const cursorGlow = document.getElementById('cursorGlow');
  if (!isTouch && cursorGlow) {
    window.addEventListener('pointermove', (e) => {
      cursorGlow.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    }, { passive: true });
  }

  /* ======================================================================
     8. RIPPLE TOUCH EFFECT (mobile)
     ====================================================================== */
  if (isTouch) {
    window.addEventListener('touchstart', (e) => {
      const target = e.target.closest('button, .photo-frame');
      const touch = e.touches[0];
      if (!target || !touch) return;
      const ripple = document.createElement('div');
      ripple.className = 'ripple';
      ripple.style.left = `${touch.clientX}px`;
      ripple.style.top = `${touch.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 750);
    }, { passive: true });
  }

  /* ======================================================================
     9. LOADING SCREEN
     ====================================================================== */
  const loadingScreen = document.getElementById('loadingScreen');
  const MIN_LOADING_MS = 700;
  const loadingStart = performance.now();

  function hideLoadingScreen() {
    const elapsed = performance.now() - loadingStart;
    const remaining = Math.max(MIN_LOADING_MS - elapsed, 0);
    setTimeout(() => {
      if (loadingScreen) {
        loadingScreen.classList.add('is-hidden');
        loadingScreen.addEventListener('transitionend', () => loadingScreen.remove(), { once: true });
      }
    }, remaining);
  }

  if (document.readyState === 'complete') {
    hideLoadingScreen();
  } else {
    window.addEventListener('load', hideLoadingScreen, { once: true });
  }

  /* ======================================================================
     10. HERO ENTRY & MUSIC CONTROL
     ====================================================================== */
  requestAnimationFrame(() => {
    document.querySelectorAll('.reveal-item').forEach((el) => el.classList.add('is-in'));
  });

  const beginBtn = document.getElementById('beginBtn');
  const mainContent = document.getElementById('mainContent');
  const bgMusic = document.getElementById('bgMusic');
  const muteBtn = document.getElementById('muteBtn');
  const muteIcon = document.getElementById('muteIcon');

  if (beginBtn) {
    beginBtn.addEventListener('click', () => {
      if (bgMusic) {
        bgMusic.volume = 0.55;
        bgMusic.play().catch(() => { /* Autoplay block catch */ });
      }
      if (muteBtn) muteBtn.hidden = false;

      mainContent.classList.add('is-visible');
      beginBtn.disabled = true;

      setTimeout(() => {
        document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
      }, 500);
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      if (!bgMusic) return;
      bgMusic.muted = !bgMusic.muted;
      if (muteIcon) muteIcon.textContent = bgMusic.muted ? '🔇' : '🔊';
    });
  }

  /* ======================================================================
     11. SCROLL REVEAL (Intersection Observer)
     ====================================================================== */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });

  document.querySelectorAll('.reveal-up').forEach((el) => revealObserver.observe(el));

  /* ======================================================================
     12. PHOTO GALLERY + LIGHTBOX
     ====================================================================== */
  const galleryGrid = document.getElementById('galleryGrid');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');

  const photoObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
        }
        photoObserver.unobserve(img);
      }
    });
  }, { rootMargin: '200px' });

  document.querySelectorAll('.lazy-photo').forEach((img) => photoObserver.observe(img));

  if (galleryGrid) {
    galleryGrid.addEventListener('click', (e) => {
      const frame = e.target.closest('.photo-frame');
      if (!frame) return;
      const img = frame.querySelector('img');
      if (!img) return;

      lightboxImg.src = img.dataset.src || img.src;
      lightboxImg.alt = img.alt || '';
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && lightbox.classList.contains('is-open')) closeLightbox();
  });

  /* ======================================================================
     13. LIVE TIMELINE COUNTER (Since 27 May 2026)
     ====================================================================== */
  const START_DATE = new Date('2026-05-27T00:00:00');
  const countDays = document.getElementById('countDays');
  const countHours = document.getElementById('countHours');
  const countMinutes = document.getElementById('countMinutes');
  const countSeconds = document.getElementById('countSeconds');

  function pad(n) { return String(n).padStart(2, '0'); }

  function updateCounter() {
    const now = new Date();
    let diff = now - START_DATE;
    if (diff < 0) diff = 0;

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (countDays) countDays.textContent = pad(days);
    if (countHours) countHours.textContent = pad(hours);
    if (countMinutes) countMinutes.textContent = pad(minutes);
    if (countSeconds) countSeconds.textContent = pad(seconds);
  }
  updateCounter();
  setInterval(updateCounter, 1000);

  /* ======================================================================
     14. SECRET LETTER — ENVELOPE OPEN & TYPEWRITER
     ====================================================================== */
  const envelope = document.getElementById('envelope');
  const typewriterText = document.getElementById('typewriterText');

  const LETTER = `Dear Arlin,

I've been thinking about how to write this, and I keep landing on something simple: I'm glad I know you.

On 27 May, I told you how I felt, and I meant every word of it. I'm not writing this to ask if anything's changed, or to nudge you toward an answer — I just wanted you to have this, without any pressure.

We're not together, and that's completely okay. I'd rather you take all the time you need than rush into something you're not sure about. Your pace is the only pace that matters here.

Since the day we met, my life has felt a little brighter. Every conversation with you, even the small, ordinary ones, has meant something to me.

I'm not asking you to feel the same way. I just wanted you to know you're appreciated, exactly as you are, and exactly where you are right now.

If our paths ever grow closer, I'll be glad. And if they don't, I'll still be grateful this happened at all.

Thank you for hearing me out, then and now.`;

  let letterOpened = false;
  let typeTimer = null;

  function typewrite() {
    if (!typewriterText) return;
    typewriterText.textContent = '';
    typewriterText.classList.add('is-typing');
    let i = 0;
    clearInterval(typeTimer);
    typeTimer = setInterval(() => {
      typewriterText.textContent = LETTER.slice(0, i + 1);
      i++;
      if (i >= LETTER.length) {
        clearInterval(typeTimer);
        typewriterText.classList.remove('is-typing');
      }
    }, 22);
  }

  if (envelope) {
    envelope.addEventListener('click', () => {
      if (letterOpened) return;
      letterOpened = true;
      envelope.classList.add('is-open');
      envelope.setAttribute('aria-expanded', 'true');
      setTimeout(typewrite, 650);
    });
  }

  /* ======================================================================
     15. FINALE EFFECTS — FIREWORKS & CELEBRATION
     ====================================================================== */
  const finalCtaBtn = document.getElementById('finalCtaBtn');
  const thankYouMessage = document.getElementById('thankYouMessage');

  const FX_COLORS = ['#22D3EE', '#C084FC', '#93C5FD', '#F472B6', '#FFFFFF'];
  let fxParticles = [];
  let fxRunning = false;

  function spawnFirework(x, y) {
    if (!fxCtx) return;
    const count = 38;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = Math.random() * 4.5 + 2.2;
      fxParticles.push({
        type: 'spark',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: Math.random() * 0.012 + 0.012,
        color: FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)],
        size: Math.random() * 2.2 + 1.2,
      });
    }
  }

  function spawnConfettiBurst() {
    if (!fxCtx) return;
    const count = width < 600 ? 50 : 90;
    for (let i = 0; i < count; i++) {
      fxParticles.push({
        type: 'confetti',
        x: Math.random() * width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 2 + 2,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        life: 1.0,
        decay: 0.004,
        color: FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)],
        w: Math.random() * 6 + 4,
        h: Math.random() * 10 + 6,
      });
    }
  }

  function spawnFloatingHearts() {
    const count = width < 600 ? 10 : 18;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const heart = document.createElement('div');
        heart.className = 'floating-heart';
        heart.textContent = ['❤️', '💜', '💙', '✨', '💖'][Math.floor(Math.random() * 5)];
        heart.style.left = `${Math.random() * 100}vw`;
        heart.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
        heart.style.setProperty('--spin', `${(Math.random() - 0.5) * 60}deg`);
        heart.style.animationDuration = `${Math.random() * 3 + 5}s`;
        document.body.appendChild(heart);
        setTimeout(() => heart.remove(), 9000);
      }, i * 220);
    }
  }

  function fxLoop() {
    if (!fxCtx) return;
    fxCtx.clearRect(0, 0, width, height);

    for (let i = fxParticles.length - 1; i >= 0; i--) {
      const p = fxParticles[i];
      if (p.type === 'spark') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045;
        p.life -= p.decay;

        if (p.life <= 0) {
          fxParticles.splice(i, 1);
          continue;
        }

        fxCtx.globalAlpha = Math.max(p.life, 0);
        fxCtx.fillStyle = p.color;
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        fxCtx.fill();
      } else if (p.type === 'confetti') {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
        p.life -= p.decay;

        if (p.life <= 0) {
          fxParticles.splice(i, 1);
          continue;
        }

        fxCtx.save();
        fxCtx.globalAlpha = Math.max(p.life, 0);
        fxCtx.translate(p.x, p.y);
        fxCtx.rotate((p.rot * Math.PI) / 180);
        fxCtx.fillStyle = p.color;
        fxCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        fxCtx.restore();
      }
    }
    fxCtx.globalAlpha = 1.0;

    if (fxParticles.length > 0 || fxRunning) {
      requestAnimationFrame(fxLoop);
    }
  }

  function celebrate() {
    if (!fxCtx) return;
    fxRunning = true;

    const bursts = [0.2, 0.5, 0.8, 0.35, 0.65];
    bursts.forEach((xFrac, i) => {
      setTimeout(() => {
        spawnFirework(width * xFrac, height * (0.25 + Math.random() * 0.25));
      }, i * 420);
    });

    spawnConfettiBurst();
    spawnFloatingHearts();
    requestAnimationFrame(fxLoop);

    setTimeout(() => { fxRunning = false; }, 2600);
  }

  if (finalCtaBtn) {
    finalCtaBtn.addEventListener('click', () => {
      celebrate();
      if (thankYouMessage) thankYouMessage.classList.add('is-shown');
    });
  }

  const finaleSection = document.getElementById('finale');
  if (finaleSection) {
    const finaleObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          celebrate();
          finaleObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });
    finaleObserver.observe(finaleSection);
  }

})();
