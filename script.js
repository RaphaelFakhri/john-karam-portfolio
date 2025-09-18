/* Hero Mini-Game: Catch the Nodes
   - Click/tap orbs to score
   - 20s round, combo bonus if you chain hits quickly
   - Saves best score in localStorage
*/

(() => {
  const area = document.getElementById('gameArea');
  const playBtn = document.getElementById('playBtn');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const bestEl = document.getElementById('best');

  if (!area || !playBtn) return;

  // Settings
  const ROUND_SECONDS = 20;
  const ORB_COUNT = 6;
  const BASE_POINTS = 10;
  const COMBO_WINDOW_MS = 800; // time between hits to grow combo
  const SPEED_MIN = 40;  // px/s
  const SPEED_MAX = 140; // px/s

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // State
  let score = 0;
  let best = Number(localStorage.getItem('jk_best_score') || 0);
  let timeLeft = ROUND_SECONDS;
  let running = false;
  let lastHitTime = 0;
  let combo = 0;

  let orbs = [];
  let raf = null;
  let lastTs = null;
  let timerId = null;
  let bounds = { w: 0, h: 0 };

  bestEl.textContent = best.toString();

  // Utilities
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const now = () => performance.now();

  function measure() {
    const rect = area.getBoundingClientRect();
    bounds.w = rect.width;
    bounds.h = rect.height;
  }

  function makeOrb() {
    const el = document.createElement('button');
    el.className = 'orb';
    el.type = 'button';
    el.setAttribute('aria-label', 'Glowing node');
    el.style.left = `${rand(20, bounds.w - 20)}px`;
    el.style.top  = `${rand(20, bounds.h - 20)}px`;

    // velocity
    const speed = prefersReduced ? 0 : rand(SPEED_MIN, SPEED_MAX);
    const angle = rand(0, Math.PI * 2);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const orb = { el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx, vy, alive: true };
    el.addEventListener('click', () => hitOrb(orb));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hitOrb(orb); } });
    area.appendChild(el);
    return orb;
  }

  function spawnOrbs(n) {
    for (let i = 0; i < n; i++) {
      orbs.push(makeOrb());
    }
  }

  function hitOrb(orb) {
    if (!running || !orb.alive) return;

    // Combo logic
    const t = now();
    if (t - lastHitTime <= COMBO_WINDOW_MS) {
      combo += 1;
    } else {
      combo = 0;
    }
    lastHitTime = t;

    const points = BASE_POINTS * (1 + Math.min(combo, 5)); // simple scaling
    score += points;
    scoreEl.textContent = score.toString();

    // Visual pop
    orb.alive = false;
    orb.el.classList.add('hit');

    // Combo toast
    const toast = document.createElement('div');
    toast.className = 'combo';
    toast.textContent = combo > 0 ? `+${points} (x${1 + Math.min(combo, 5)})` : `+${points}`;
    toast.style.left = `${orb.x}px`;
    toast.style.top  = `${orb.y - 14}px`;
    area.appendChild(toast);
    setTimeout(() => toast.remove(), 800);

    // Respawn new orb after pop
    setTimeout(() => {
      if (!running) return;
      try { orb.el.remove(); } catch {}
      // replace with a new orb
      const idx = orbs.indexOf(orb);
      if (idx > -1) orbs.splice(idx, 1);
      orbs.push(makeOrb());
    }, 200);
  }

  function step(ts) {
    if (!running) return;
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(0.032, (ts - lastTs) / 1000); // cap delta
    lastTs = ts;

    // Move orbs
    for (const orb of orbs) {
      if (!orb.alive) continue;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;

      // Bounce
      if (orb.x < 12) { orb.x = 12; orb.vx = Math.abs(orb.vx); }
      if (orb.y < 12) { orb.y = 12; orb.vy = Math.abs(orb.vy); }
      if (orb.x > bounds.w - 12) { orb.x = bounds.w - 12; orb.vx = -Math.abs(orb.vx); }
      if (orb.y > bounds.h - 12) { orb.y = bounds.h - 12; orb.vy = -Math.abs(orb.vy); }

      orb.el.style.transform = `translate(calc(${orb.x}px - 50%), calc(${orb.y}px - 50%))`;
      orb.el.style.left = `${orb.x}px`;
      orb.el.style.top  = `${orb.y}px`;
    }

    raf = requestAnimationFrame(step);
  }

  function startTimer() {
    timeLeft = ROUND_SECONDS;
    timeEl.textContent = timeLeft.toString();
    timerId = setInterval(() => {
      timeLeft -= 1;
      timeEl.textContent = timeLeft.toString();
      if (timeLeft <= 0) {
        endGame();
      }
    }, 1000);
  }

  function clearGame() {
    cancelAnimationFrame(raf);
    raf = null;
    lastTs = null;
    clearInterval(timerId);
    timerId = null;
    orbs.forEach(o => { try { o.el.remove(); } catch {} });
    orbs = [];
    Array.from(area.querySelectorAll('.combo')).forEach(c => c.remove());
  }

  function startGame() {
    measure();
    clearGame();
    running = true;
    score = 0;
    combo = 0;
    lastHitTime = 0;
    scoreEl.textContent = '0';
    playBtn.textContent = 'Playing…';
    playBtn.disabled = true;

    spawnOrbs(ORB_COUNT);
    startTimer();
    raf = requestAnimationFrame(step);
    area.focus({ preventScroll: true });
  }

  function endGame() {
    running = false;
    clearGame();
    playBtn.textContent = 'Play again';
    playBtn.disabled = false;

    if (score > best) {
      best = score;
      localStorage.setItem('jk_best_score', String(best));
      bestEl.textContent = best.toString();
    }

    // Brief end toast
    const end = document.createElement('div');
    end.className = 'combo';
    end.style.left = `${bounds.w/2}px`;
    end.style.top  = `${bounds.h/2}px`;
    end.textContent = `Final: ${score}`;
    area.appendChild(end);
    setTimeout(() => end.remove(), 1200);
  }

  // Events
  playBtn.addEventListener('click', startGame);
  window.addEventListener('resize', () => {
    // Re-measure bounds; keep orbs inside on resize
    measure();
    for (const o of orbs) {
      o.x = clamp(o.x, 12, bounds.w - 12);
      o.y = clamp(o.y, 12, bounds.h - 12);
    }
  });

  // Accessibility: space/enter starts
  area.addEventListener('keydown', (e) => {
    if (!running && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      startGame();
    }
  });

  // Initial measure
  measure();
})();
