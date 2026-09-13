(function () {
  const COLORS = { U: '#ffffff', D: '#ffd400', L: '#ff7a00', R: '#e6231e', F: '#22c55e', B: '#2563eb' };
  const DIRS = { U: [0, 1, 0], D: [0, -1, 0], L: [-1, 0, 0], R: [1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
  const AXIS_IDX = { x: 0, y: 1, z: 2 };
  const STEP = 62; // jarak antar cubie (px)

  const MOVES = {
    U: { axis: 'y', layer: 1, dir: 1 },
    "U'": { axis: 'y', layer: 1, dir: -1 },
    D: { axis: 'y', layer: -1, dir: -1 },
    "D'": { axis: 'y', layer: -1, dir: 1 },
    R: { axis: 'x', layer: 1, dir: 1 },
    "R'": { axis: 'x', layer: 1, dir: -1 },
    L: { axis: 'x', layer: -1, dir: -1 },
    "L'": { axis: 'x', layer: -1, dir: 1 },
    F: { axis: 'z', layer: 1, dir: -1 },
    "F'": { axis: 'z', layer: 1, dir: 1 },
    B: { axis: 'z', layer: -1, dir: 1 },
    "B'": { axis: 'z', layer: -1, dir: -1 },
  };
  const MOVE_NAMES = Object.keys(MOVES);

  let cubies = [];
  let sceneEl, cubeEl, sceneWrapEl;
  let animating = false;
  let moveCount = 0;
  let startTime = Date.now();

  // ==== state jeda (pause) & selesai ====
  let paused = false;
  let solved = false;
  let timerInterval = null;
  let totalPausedMs = 0;
  let pauseStartedAt = null;
  let shuffling = false; // true selagi proses acak berjalan
  let timerStarted = false; // waktu baru berjalan setelah acak selesai

  // ===== Ganti URL di bawah ini dengan URL Web App Apps Script kamu =====
  // Lihat file AppsScript-Leaderboard.gs untuk cara membuat & men-deploy-nya.
  const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbzJZ55-SLAehTcS2Qu9FXzzfDdH01-tCjrhnr-bs4NdQJsPORbDPZr-EixSM_Fea5Qo8w/exec';
  const LB_MAX = 10;

  function createCubies() {
    cubies = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const colors = {};
          if (x === 1) colors.R = COLORS.R;
          if (x === -1) colors.L = COLORS.L;
          if (y === 1) colors.U = COLORS.U;
          if (y === -1) colors.D = COLORS.D;
          if (z === 1) colors.F = COLORS.F;
          if (z === -1) colors.B = COLORS.B;
          cubies.push({ x, y, z, colors });
        }
      }
    }
  }

  function rotateVec(axis, dir, v) {
    const [x, y, z] = v;
    if (axis === 'x') return dir === 1 ? [x, -z, y] : [x, z, -y];
    if (axis === 'y') return dir === 1 ? [z, y, -x] : [-z, y, x];
    return dir === 1 ? [-y, x, z] : [y, -x, z];
  }

  function nameOf(v) {
    for (const k in DIRS) {
      const d = DIRS[k];
      if (d[0] === v[0] && d[1] === v[1] && d[2] === v[2]) return k;
    }
    return null;
  }

  function render() {
    cubeEl.innerHTML = '';
    cubies.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'cubie';
      el.dataset.idx = i;
      el.style.transform = `translate3d(${c.x * STEP}px, ${-c.y * STEP}px, ${c.z * STEP}px)`;
      ['U', 'D', 'L', 'R', 'F', 'B'].forEach((dir) => {
        const f = document.createElement('div');
        f.className = 'face face-' + dir;
        f.style.background = c.colors[dir] || '#2b1f4d';
        el.appendChild(f);
      });
      cubeEl.appendChild(el);
    });
  }

  function animateLayer(layerCubies, axis, dir, done) {
    const group = document.createElement('div');
    group.className = 'layer-group';
    const idxSet = new Set(layerCubies.map((c) => cubies.indexOf(c)));
    const nodes = Array.from(cubeEl.children).filter((n) => idxSet.has(Number(n.dataset.idx)));
    nodes.forEach((n) => group.appendChild(n));
    cubeEl.appendChild(group);
    // paksa reflow supaya transition ke-trigger
    group.getBoundingClientRect();
    group.style.transition = 'transform .28s ease';
    const axisCss = axis.toUpperCase();
    const angle = dir * 90;
    requestAnimationFrame(() => {
      group.style.transform = `rotate${axisCss}(${angle}deg)`;
    });
    setTimeout(() => {
      if (group.parentNode) group.remove();
      done();
    }, 300);
  }

  function applyMove(name, cb) {
    if (paused || solved) return; // dibekukan saat jeda / setelah selesai
    if (animating || !MOVES[name]) return;
    animating = true;
    const m = MOVES[name];
    const idx = AXIS_IDX[m.axis];
    const layerCubies = cubies.filter((c) => [c.x, c.y, c.z][idx] === m.layer);

    animateLayer(layerCubies, m.axis, m.dir, () => {
      layerCubies.forEach((c) => {
        const [nx, ny, nz] = rotateVec(m.axis, m.dir, [c.x, c.y, c.z]);
        const newColors = {};
        for (const k in c.colors) {
          const nv = rotateVec(m.axis, m.dir, DIRS[k]);
          newColors[nameOf(nv)] = c.colors[k];
        }
        c.x = nx; c.y = ny; c.z = nz; c.colors = newColors;
      });
      render();
      if (!shuffling) {
        moveCount++;
        document.getElementById('moveCount').textContent = moveCount;
      }
      animating = false;
      checkSolved();
      if (cb) cb();
    });
  }

  function isApiConfigured() {
    return SHEET_API_URL && SHEET_API_URL.indexOf('PASTE_URL') === -1;
  }

  async function fetchLeaderboard() {
    if (!isApiConfigured()) return null; // URL belum diisi
    try {
      const res = await fetch(SHEET_API_URL);
      if (!res.ok) throw new Error('Gagal memuat');
      return await res.json();
    } catch (e) {
      return null; // gagal memuat (offline / URL salah / dsb)
    }
  }

  async function postResult(entry) {
    if (!isApiConfigured()) return false;
    try {
      // Content-Type text/plain sengaja dipakai supaya browser tidak
      // mengirim preflight OPTIONS (Apps Script tidak menanganinya).
      await fetch(SHEET_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(entry),
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function renderLeaderboard(highlightEntry) {
    const listEl = document.getElementById('leaderboardList');
    const emptyEl = document.getElementById('leaderboardEmpty');
    if (!listEl) return;

    listEl.innerHTML = '';
    if (!isApiConfigured()) {
      if (emptyEl) {
        emptyEl.style.display = 'block';
        emptyEl.textContent = 'Papan skor belum diaktifkan. Isi SHEET_API_URL di rubik.js.';
      }
      return;
    }

    if (emptyEl) {
      emptyEl.style.display = 'block';
      emptyEl.textContent = 'Memuat papan skor...';
    }

    const list = await fetchLeaderboard();

    if (list === null) {
      if (emptyEl) emptyEl.textContent = 'Papan skor tidak dapat dimuat. Periksa koneksi internet.';
      return;
    }
    if (list.length === 0) {
      if (emptyEl) emptyEl.textContent = 'Belum ada rekor. Acak lalu selesaikan kubus untuk masuk papan skor!';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    listEl.innerHTML = '';
    list.forEach((entry, i) => {
      const li = document.createElement('li');
      if (highlightEntry && entry.date === highlightEntry.date) li.classList.add('lb-highlight');
      li.innerHTML =
        '<span class="lb-rank">#' + (i + 1) + '</span>' +
        '<span class="lb-name">' + escapeHtml(entry.name) + '</span>' +
        '<span class="lb-time">' + formatTimer(entry.timeMs) + '</span>' +
        '<span class="lb-moves">' + entry.moves + ' langkah</span>';
      listEl.appendChild(li);
    });
  }

  async function recordResult(timeMs, moves) {
    const nameInput = document.getElementById('playerName');
    let name = (nameInput && nameInput.value.trim()) || 'Anonim';
    if (name.length > 20) name = name.slice(0, 20);
    const entry = { name, timeMs, moves, date: Date.now() };
    await postResult(entry);
    renderLeaderboard(entry);
  }

  function checkSolved() {
    const faces = [
      { axis: 'y', val: 1, dir: 'U' }, { axis: 'y', val: -1, dir: 'D' },
      { axis: 'x', val: 1, dir: 'R' }, { axis: 'x', val: -1, dir: 'L' },
      { axis: 'z', val: 1, dir: 'F' }, { axis: 'z', val: -1, dir: 'B' },
    ];
    const solvedNow = faces.every((f) => {
      const idx = AXIS_IDX[f.axis];
      const group = cubies.filter((c) => [c.x, c.y, c.z][idx] === f.val);
      const set = new Set(group.map((c) => c.colors[f.dir]));
      return set.size === 1;
    });

    if (solvedNow && !solved) {
      // baru saja selesai: hentikan waktu seketika
      solved = true;
      stopTimerInterval();
      const pauseBtn = document.getElementById('pauseBtn');
      if (pauseBtn) pauseBtn.disabled = true;

      if (timerStarted) {
        const elapsed = Date.now() - startTime - totalPausedMs;
        recordResult(elapsed, moveCount);
      }
    }

    document.getElementById('status').textContent = solvedNow ? '🎉 Selesai!' : (paused ? '⏸️ Dijeda' : '');
    return solvedNow;
  }

  function formatTimer(ms) {
    const s = Math.floor(ms / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function updateTimer() {
    if (!timerStarted || paused || solved) return;
    const elapsed = Date.now() - startTime - totalPausedMs;
    document.getElementById('timer').textContent = formatTimer(elapsed);
  }

  // Dipanggil begitu proses acak benar-benar selesai (bukan karena dijeda/sudah selesai)
  function startSolveTimer() {
    timerStarted = true;
    startTime = Date.now();
    totalPausedMs = 0;
    pauseStartedAt = null;
    document.getElementById('timer').textContent = '00:00:00';
    startTimerInterval();
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.disabled = false;
    document.getElementById('status').textContent = '';
  }

  function startTimerInterval() {
    stopTimerInterval();
    timerInterval = setInterval(updateTimer, 1000);
  }

  function stopTimerInterval() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function setControlsEnabled(enabled) {
    document.querySelectorAll('[data-move]').forEach((b) => { b.disabled = !enabled; });
    const shuffleBtn = document.getElementById('shuffleBtn');
    if (shuffleBtn) shuffleBtn.disabled = !enabled;
  }

  function setFrozenLook(frozen) {
    if (!sceneWrapEl) return;
    if (frozen) {
      sceneWrapEl.style.filter = 'grayscale(0.65) brightness(0.75)';
      sceneWrapEl.style.pointerEvents = 'none';
      sceneWrapEl.style.transition = 'filter .2s ease';
    } else {
      sceneWrapEl.style.filter = '';
      sceneWrapEl.style.pointerEvents = '';
    }
  }

  function togglePause() {
    if (solved || !timerStarted) return; // tidak ada gunanya jeda sebelum waktu mulai / sudah selesai
    paused = !paused;
    const pauseBtn = document.getElementById('pauseBtn');

    if (paused) {
      pauseStartedAt = Date.now();
      stopTimerInterval();
      if (pauseBtn) pauseBtn.textContent = '▶️ Lanjut';
      document.getElementById('status').textContent = '⏸️ Dijeda';
      setFrozenLook(true);
      setControlsEnabled(false);
    } else {
      totalPausedMs += Date.now() - pauseStartedAt;
      pauseStartedAt = null;
      startTimerInterval();
      if (pauseBtn) pauseBtn.textContent = '⏸️ Pause';
      document.getElementById('status').textContent = '';
      setFrozenLook(false);
      setControlsEnabled(true);
    }
  }

  function shuffle(n) {
    if (paused || solved) {
      // terhenti karena dijeda/sudah selesai: jangan mulai waktu
      shuffling = false;
      return;
    }
    if (n <= 0) {
      shuffling = false;
      // acakan benar-benar selesai: mulai hitungan langkah & waktu dari nol
      moveCount = 0;
      document.getElementById('moveCount').textContent = 0;
      startSolveTimer();
      return;
    }
    shuffling = true;
    const mv = MOVE_NAMES[Math.floor(Math.random() * MOVE_NAMES.length)];
    applyMove(mv, () => shuffle(n - 1));
  }

  // ==== drag untuk orbit kamera ====
  let rotX = -25, rotY = -35, dragging = false, lastX = 0, lastY = 0;
  function updateSceneTransform() {
    sceneEl.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    sceneEl = document.getElementById('scene');
    cubeEl = document.getElementById('cube');
    sceneWrapEl = document.getElementById('sceneWrap');

    createCubies();
    render();
    updateSceneTransform();
    renderLeaderboard();
    document.getElementById('timer').textContent = '00:00:00';

    sceneWrapEl.addEventListener('pointerdown', (e) => {
      if (paused) return;
      dragging = true; lastX = e.clientX; lastY = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging || paused) return;
      rotY += (e.clientX - lastX) * 0.5;
      rotX -= (e.clientY - lastY) * 0.5;
      lastX = e.clientX; lastY = e.clientY;
      updateSceneTransform();
    });
    window.addEventListener('pointerup', () => { dragging = false; });

    document.querySelectorAll('[data-move]').forEach((btn) => {
      btn.addEventListener('click', () => applyMove(btn.dataset.move));
    });

    document.getElementById('shuffleBtn').addEventListener('click', () => shuffle(20));

    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.addEventListener('click', togglePause);

    document.getElementById('resetBtn').addEventListener('click', () => {
      createCubies();
      moveCount = 0;
      document.getElementById('moveCount').textContent = 0;
      startTime = Date.now();
      totalPausedMs = 0;
      pauseStartedAt = null;
      paused = false;
      solved = false;
      timerStarted = false;
      stopTimerInterval();
      document.getElementById('status').textContent = '';
      document.getElementById('timer').textContent = '00:00:00';
      setFrozenLook(false);
      setControlsEnabled(true);
      if (pauseBtn) { pauseBtn.textContent = '⏸️ Pause'; pauseBtn.disabled = true; }
      render();
    });
  });
})();
