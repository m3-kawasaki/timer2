(() => {
  const $ = (sel) => document.querySelector(sel);
  const hoursEl = $('#hours');
  const minutesEl = $('#minutes');
  const secondsEl = $('#seconds');
  const timeEl = $('#time');
  const startPauseBtn = $('#startPauseBtn');
  const lapBtn = $('#lapBtn');
  const resetBtn = $('#resetBtn');
  const soundToggle = $('#soundToggle');
  const vibrateToggle = $('#vibrateToggle');
  const presetContainer = document.querySelector('.presets');
  const lapList = document.querySelector('#lapList');
  const clearLapsBtn = document.querySelector('#clearLapsBtn');
  const appIconEl = document.querySelector('#appIcon');

  let timerId = null;
  let running = false;
  let remainingMs = 0;
  let endAt = 0;
  let originalTitle = document.title;
  let lastLapRemainingMs = null;
  let laps = [];

  // Icon paths
  const iconJpgPath = 'images/app-icon.jpg';
  const iconPngPath = 'images/ChatGPT Image 2025年8月16日 15_59_12.png';

  // WebAudio (lazy init)
  let audioCtx = null;
  const ensureAudio = () => {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume?.();
    }
    return !!audioCtx;
  };

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  const parseInputsToMs = () => {
    const h = clamp(parseInt(hoursEl.value || '0', 10) || 0, 0, 99);
    const m = clamp(parseInt(minutesEl.value || '0', 10) || 0, 0, 59);
    const s = clamp(parseInt(secondsEl.value || '0', 10) || 0, 0, 59);
    return ((h * 3600) + (m * 60) + s) * 1000;
  };

  const msToHMS = (ms) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return { h, m, s };
  };

  const fmt = (n) => String(n).padStart(2, '0');

  const formatTime = (ms) => {
    const { h, m, s } = msToHMS(ms);
    return h > 0 ? `${fmt(h)}:${fmt(m)}:${fmt(s)}` : `${fmt(m)}:${fmt(s)}`;
  };

  const setTitle = (ms, isRunning) => {
    if (isRunning && ms > 0) {
      document.title = `${formatTime(ms)} · タイマー`;
    } else {
      document.title = originalTitle;
    }
  };

  const render = () => {
    timeEl.textContent = formatTime(remainingMs);
    setTitle(remainingMs, running);
    startPauseBtn.textContent = running ? '一時停止' : '開始';
    lapBtn.disabled = !running;
    renderLaps();
  };

  const renderLaps = () => {
    if (!lapList) return;
    lapList.innerHTML = '';
    laps.forEach((lap, idx) => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      left.textContent = `ラップ ${idx + 1}`;
      const right = document.createElement('span');
      right.innerHTML = `${formatTime(lap.duration)} <span class="meta">(残 ${formatTime(lap.remain)})</span>`;
      li.appendChild(left); li.appendChild(right);
      lapList.appendChild(li);
    });
  };

  const tick = () => {
    const now = Date.now();
    const ms = endAt - now;
    remainingMs = ms > 0 ? ms : 0;
    render();
    if (remainingMs <= 0) {
      stopTimer(true);
    }
  };

  const startTimer = () => {
    if (running) return;
    if (remainingMs <= 0) {
      remainingMs = parseInputsToMs();
    }
    if (remainingMs <= 0) return; // nothing to do
    endAt = Date.now() + remainingMs;
    running = true;
    if (lastLapRemainingMs == null) lastLapRemainingMs = remainingMs;
    render();
    timerId = setInterval(tick, 200);
    tick();
  };

  const pauseTimer = () => {
    if (!running) return;
    clearInterval(timerId); timerId = null;
    remainingMs = Math.max(0, endAt - Date.now());
    running = false;
    render();
  };

  const stopTimer = (finished = false) => {
    clearInterval(timerId); timerId = null;
    running = false;
    if (finished) {
      remainingMs = 0;
      render();
      notifyFinished();
    } else {
      render();
    }
  };

  const resetTimer = () => {
    clearInterval(timerId); timerId = null;
    running = false;
    remainingMs = parseInputsToMs();
    lastLapRemainingMs = null;
    laps = [];
    render();
  };

  // Finish notification: beep + vibrate
  const notifyFinished = () => {
    if (soundToggle.checked) beepPattern();
    if (vibrateToggle.checked) tryVibrate([200, 120, 200, 120, 400]);

    // Flash title a few times
    const original = document.title;
    let count = 0;
    const flash = setInterval(() => {
      document.title = (count % 2 === 0) ? '⏰ 時間です!' : original;
      if (++count >= 6) { clearInterval(flash); document.title = original; }
    }, 500);
  };

  const tryVibrate = (pattern) => {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch {}
    }
  };

  const beep = (freq = 880, duration = 180, type = 'sine', gain = 0.05) => {
    if (!ensureAudio()) return;
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g).connect(ctx.destination);
    const now = ctx.currentTime;
    o.start(now);
    o.stop(now + duration / 1000);
  };

  const beepPattern = () => {
    // Three short beeps then a longer one
    beep(880, 150, 'triangle');
    setTimeout(() => beep(988, 150, 'triangle'), 200);
    setTimeout(() => beep(1046, 150, 'triangle'), 400);
    setTimeout(() => beep(880, 500, 'square', 0.06), 700);
  };

  // Event bindings
  startPauseBtn.addEventListener('click', () => {
    if (running) {
      pauseTimer();
    } else {
      // ensure audio on user gesture for iOS
      ensureAudio();
      // If no remaining, take inputs now
      if (remainingMs <= 0) remainingMs = parseInputsToMs();
      startTimer();
    }
  });

  resetBtn.addEventListener('click', () => {
    resetTimer();
  });

  // Update remaining when inputs change (only if not running)
  [hoursEl, minutesEl, secondsEl].forEach(el => {
    el.addEventListener('input', () => {
      if (!running) {
        remainingMs = parseInputsToMs();
        render();
      }
    });
  });

  // Presets
  presetContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-min]');
    if (!btn) return;
    const min = parseInt(btn.getAttribute('data-min'), 10);
    const ms = min * 60 * 1000;
    const { h, m, s } = msToHMS(ms);
    hoursEl.value = h || '';
    minutesEl.value = m || '';
    secondsEl.value = s || '';
    if (!running) {
      remainingMs = ms;
      render();
    }
  });

  // Keyboard shortcuts: Space toggle, R reset (ignore when typing in inputs)
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.isComposing;
    if (typing) return;
    if (e.code === 'Space') {
      e.preventDefault();
      startPauseBtn.click();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      resetBtn.click();
    }
  });

  // Init
  remainingMs = 0;
  render();

  // Preload helper for checking JPG existence
  const preloadImage = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });

  const setFavicon = (href, type) => {
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (type) link.type = type;
    link.href = href;
  };

  // Try to upgrade PNG -> JPG if JPG exists
  (async () => {
    const jpgUrl = encodeURI(iconJpgPath);
    const pngUrl = encodeURI(iconPngPath);
    const hasJpg = await preloadImage(jpgUrl);
    if (hasJpg) {
      if (appIconEl) appIconEl.src = jpgUrl;
      setFavicon(jpgUrl, 'image/jpeg');
    } else {
      // Ensure PNG is used and favicon matches
      if (appIconEl) appIconEl.src = pngUrl;
      setFavicon(pngUrl, 'image/png');
    }
  })();

  // Lap handling
  const currentRemaining = () => running ? Math.max(0, endAt - Date.now()) : remainingMs;
  const addLap = () => {
    const curRemain = currentRemaining();
    if (lastLapRemainingMs == null) lastLapRemainingMs = curRemain;
    const duration = Math.max(0, lastLapRemainingMs - curRemain);
    laps.push({ duration, remain: curRemain });
    lastLapRemainingMs = curRemain;
    renderLaps();
  };

  lapBtn?.addEventListener('click', () => {
    if (!running) return;
    addLap();
  });

  clearLapsBtn?.addEventListener('click', () => {
    laps = [];
    lastLapRemainingMs = running ? currentRemaining() : null;
    renderLaps();
  });
})();
