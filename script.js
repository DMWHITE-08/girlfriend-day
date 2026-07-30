/* =========================================================================
   A LITTLE SURPRISE FOR YOU — ALBIN ❤ ARLIN
   Vanilla JS: loading screen, galaxy canvas, fireflies, scroll reveals,
   counter, lightbox, secret letter, finale fireworks/confetti, micro-interactions.
   ========================================================================= */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  /* ======================================================================
     1. GALAXY / NEBULA BACKGROUND CANVAS
     Slow-drifting nebula clouds + soft glow orbs. Runs continuously
     at low cost (few shapes, additive blending).
     NOTE: this script now tolerates the galaxy/stars canvases being removed
     (the cinematic background replacement may provide those visuals).
     ====================================================================== */
  const galaxyCanvas = document.getElementById('galaxy-canvas');
  let galaxyCtx = null;
  if (galaxyCanvas && galaxyCanvas.getContext) galaxyCtx = galaxyCanvas.getContext('2d');
  let gW, gH, nebulaBlobs = [];

  function initGalaxy() {
    if (!galaxyCtx) return;
    gW = galaxyCanvas.width = window.innerWidth;
    gH = galaxyCanvas.height = window.innerHeight;
    const count = window.innerWidth < 600 ? 5 : 8;
    nebulaBlobs = Array.from({ length: count }, () => ({
      x: Math.random() * gW,
      y: Math.random() * gH,
      r: Math.random() * (gW * 0.35) + gW * 0.15,
      hue: [270, 320, 220][Math.floor(Math.random() * 3)],
      speedX: (Math.random() - 0.5) * 0.06,
      speedY: (Math.random() - 0.5) * 0.06,
      alpha: Math.random() * 0.12 + 0.08,
    }));
  }

  function drawGalaxy() {
    if (!galaxyCtx) return;
    galaxyCtx.clearRect(0, 0, gW, gH);
    galaxyCtx.fillStyle = '#05030f';
    galaxyCtx.fillRect(0, 0, gW, gH);

    nebulaBlobs.forEach((b) => {
      b.x += b.speedX;
      b.y += b.speedY;
      if (b.x < -b.r) b.x = gW + b.r;
      if (b.x > gW + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = gH + b.r;
      if (b.y > gH + b.r) b.y = -b.r;

      const grad = galaxyCtx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      grad.addColorStop(0, `hsla(${b.hue}, 85%, 65%, ${b.alpha})`);
      grad.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      galaxyCtx.fillStyle = grad;
      galaxyCtx.beginPath();
      galaxyCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      galaxyCtx.fill();
    });

    if (!reduceMotion) requestAnimationFrame(drawGalaxy);
  }

  /* ======================================================================
     2. STAR FIELD + SHOOTING STARS
     ====================================================================== */
  const starsCanvas = document.getElementById('stars-canvas');
  let starsCtx = null;
  if (starsCanvas && starsCanvas.getContext) starsCtx = starsCanvas.getContext('2d');
  let sW, sH, stars = [], shootingStars = [];

  function initStars() {
    if (!starsCtx) return;
    sW = starsCanvas.width = window.innerWidth;
    sH = starsCanvas.height = window.innerHeight;
    const density = window.innerWidth < 600 ? 0.00065 : 0.00045;
    const count = Math.min(260, Math.floor(sW * sH * density));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * sW,
      y: Math.random() * sH,
      r: Math.random() * 1.4 + 0.3,
      baseAlpha: Math.random() * 0.6 + 0.3,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function maybeSpawnShootingStar() {
    if (!starsCtx) return;
    if (Math.random() < 0.0032 && shootingStars.length < 2) {
      const startX = Math.random() * sW * 0.7 + sW * 0.15;
      shootingStars.push({
        x: startX,
        y: -20,
        len: Math.random() * 120 + 80,
        speed: Math.random() * 9 + 9,
        angle: Math.PI / 3.4,
        life: 1,
      });
    }
  }

  function drawStars(t) {
    if (!starsCtx) return;
    starsCtx.clearRect(0, 0, sW, sH);

    stars.forEach((s) => {
      const twinkle = Math.sin(t * s.twinkleSpeed + s.phase) * 0.35 + 0.65;
      starsCtx.beginPath();
      starsCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      starsCtx.fillStyle = `rgba(255,255,255,${(s.baseAlpha * twinkle).toFixed(3)})`;
      starsCtx.fill();
    });

    maybeSpawnShootingStar();
    shootingStars.forEach((sh) => {
      const dx = Math.cos(sh.angle) * sh.speed;
      const dy = Math.sin(sh.angle) * sh.speed;
      sh.x += dx;
      sh.y += dy;
      sh.life -= 0.012;

      const tailX = sh.x - Math.cos(sh.angle) * sh.len;
      const tailY = sh.y - Math.sin(sh.angle) * sh.len;
      const grad = starsCtx.createLinearGradient(sh.x, sh.y, tailX, tailY);
      grad.addColorStop(0, `rgba(255,255,255,${sh.life})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      starsCtx.strokeStyle = grad;
      starsCtx.lineWidth = 2;
      starsCtx.beginPath();
      starsCtx.moveTo(sh.x, sh.y);
      starsCtx.lineTo(tailX, tailY);
      starsCtx.stroke();
    });
    shootingStars = shootingStars.filter((sh) => sh.life > 0 && sh.y < sH + 100);

    if (!reduceMotion) requestAnimationFrame(drawStars);
  }

  function setupCanvases() {
    if (galaxyCtx) {
      initGalaxy();
      drawGalaxy();
    }
    if (starsCtx) {
      initStars();
      if (reduceMotion) {
        // Reduced motion: paint a single static frame instead of looping.
        drawStars(0);
      } else {
        requestAnimationFrame(drawStars);
      }
    }
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (galaxyCtx) initGalaxy(); if (starsCtx) initStars(); }, 200);
  });

  setupCanvases();

  /* ======================================================================
     3. FIREFLIES — a handful of warm, slow-drifting glow points layered
        over the cool nebula palette. Plain DOM + CSS (cheap, no canvas
        needed for so few elements) using the warm tokens from :root.
     ====================================================================== */
  function spawnFireflies() {
    if (reduceMotion) return; // respect reduced motion — skip ambient drift
    const container = document.getElementById('fireflies');
    if (!container) return;
    const count = window.innerWidth < 600 ? 8 : 14;

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
     4. CURSOR GLOW (desktop only)
     ====================================================================== */
  const cursorGlow = document.getElementById('cursorGlow');
  if (!isTouch && cursorGlow) {
    window.addEventListener('pointermove', (e) => {
      cursorGlow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    });
  }

  /* ======================================================================
     5. RIPPLE TOUCH EFFECT (mobile)
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
     6. LOADING SCREEN — fades out once the page (fonts, canvas, layout)
        is ready. A short minimum display time avoids an ugly flash on
        fast connections while still feeling instant on slow ones.
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
    }, reduceMotion ? 0 : remaining);
  }

  if (document.readyState === 'complete') {
    hideLoadingScreen();
  } else {
    window.addEventListener('load', hideLoadingScreen, { once: true });
  }

  /* ======================================================================
     7. HERO ENTRY — reveal title, then "Tap To Begin" starts the music
        and reveals the rest of the page.
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
      bgMusic.volume = 0.55;
      bgMusic.play().catch(() => { /* autoplay/file blocked — ignore gracefully */ });
      muteBtn.hidden = false;

      mainContent.classList.add('is-visible');
      beginBtn.disabled = true;

      setTimeout(() => {
        document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
      }, 500);
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      bgMusic.muted = !bgMusic.muted;
      muteIcon.textContent = bgMusic.muted ? '🔇' : '🔊';
    });
  }

  /* ======================================================================
     8. SCROLL REVEAL — Intersection Observer
     ====================================================================== */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

  document.querySelectorAll('.reveal-up').forEach((el) => revealObserver.observe(el));

  /* ======================================================================
     9. LAZY-LOADED PHOTO GALLERY + LIGHTBOX
     ====================================================================== */
  const galleryGrid = document.getElementById('galleryGrid');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');

  const photoObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
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
      lightboxImg.src = img.dataset.src;
      lightboxImg.alt = img.alt;
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
  if (lightbox) lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && lightbox.classList.contains('is-open')) closeLightbox();
  });

  /* ======================================================================
     10. LIVE COUNTER — since 27 May 2026
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
     11. SECRET LETTER — envelope open + typewriter
     ====================================================================== */
  const envelope = document.getElementById('envelope');
  const typewriterText = document.getElementById('typewriterText');

  const LETTER = `Dear Arlin,

I've been thinking about how to write this, and I keep landing on something simple: I'm glad I know you.

On 27 May, I told you how I felt, and I meant every word of it. I'm not writing this to ask if anything's changed, or to nudge you toward an answer — I just wanted you to have this, without any[...]

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
     12. FINALE — galaxy heart, fireworks, confetti, floating hearts
     ====================================================================== */
  const finalCtaBtn = document.getElementById('finalCtaBtn');
  const thankYouMessage = document.getElementById('thankYouMessage');
  const fxCanvas = document.getElementById('fx-canvas');
  const fxCtx = fxCanvas && fxCanvas.getContext ? fxCanvas.getContext('2d') : null;
  let fW, fH;

  function sizeFxCanvas() {
    if (!fxCanvas) return;
    fW = fxCanvas.width = window.innerWidth;
    fH = fxCanvas.height = window.innerHeight;
  }
  sizeFxCanvas();
  window.addEventListener('resize', sizeFxCanvas);

  const FX_COLORS = ['#f9a8d4', '#c084fc', '#93c5fd', '#fcd34d', '#ffffff'];
  let fxParticles = [];
  let fxRunning = false;

  function spawnFirework(x, y) {
    if (!fxCtx) return;
    const count = 34;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = Math.random() * 4.2 + 2.4;
      fxParticles.push({
        type: 'spark',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: Math.random() * 0.012 + 0.012,
        color: FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)],
        size: Math.random() * 2 + 1.5,
      });
    }
  }

  function spawnConfettiBurst() {
    if (!fxCtx) return;
    const count = window.innerWidth < 600 ? 60 : 100;
    for (let i = 0; i < count; i++) {
      fxParticles.push({
        type: 'confetti',
        x: Math.random() * fW,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 2 + 2,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        life: 1,
        decay: 0.004,
        color: FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)],
        w: Math.random() * 6 + 4,
        h: Math.random() * 10 + 6,
      });
    }
  }

  function spawnFloatingHearts() {
    const count = window.innerWidth < 600 ? 10 : 18;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const heart = document.createElement('div');
        heart.className = 'floating-heart';
        heart.textContent = ['❤️', '💜', '💗', '✨'][Math.floor(Math.random() * 4)];
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
    fxCtx.clearRect(0, 0, fW, fH);

    fxParticles.forEach((p) => {
      if (p.type === 'spark') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045; // gravity
        p.life -= p.decay;
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
        fxCtx.save();
        fxCtx.globalAlpha = Math.max(p.life, 0);
        fxCtx.translate(p.x, p.y);
        fxCtx.rotate((p.rot * Math.PI) / 180);
        fxCtx.fillStyle = p.color;
        fxCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        fxCtx.restore();
      }
    });
    fxCtx.globalAlpha = 1;

    fxParticles = fxParticles.filter((p) => p.life > 0 && p.y < fH + 60);

    if (fxParticles.length > 0 || fxRunning) {
      requestAnimationFrame(fxLoop);
    }
  }

  function celebrate() {
    if (reduceMotion) return; // respect reduced motion — skip heavy particle show
    if (!fxCtx) return;
    fxRunning = true;

    const bursts = [0.2, 0.5, 0.8, 0.35, 0.65];
    bursts.forEach((xFrac, i) => {
      setTimeout(() => {
        spawnFirework(fW * xFrac, fH * (0.25 + Math.random() * 0.25));
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
    }, { threshold: 0.4 });
    finaleObserver.observe(finaleSection);
  }

})();
