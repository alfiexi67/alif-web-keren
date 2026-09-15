/* ============================================================
   aurora-bg.js
   Efek latar belakang: aurora borealis + bintang jatuh (canvas).
   Tinggal include <script src="js/aurora-bg.js"></script>
   sebelum tag </body> di halaman manapun — tidak butuh library lain.
   ============================================================ */
(function () {
  // ---- Buat canvas & pasang ke halaman ----
  const canvas = document.createElement("canvas");
  canvas.id = "auroraBgCanvas";
  Object.assign(canvas.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "-1",
    pointerEvents: "none",
    display: "block",
  });
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d");
  let W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  // ---- Bintang kelap-kelip ----
  const STAR_COUNT = 130;
  let stars = [];
  function buildStars() {
    stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.75,
      r: Math.random() * 1.4 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.02 + 0.006,
    }));
  }
  buildStars();
  window.addEventListener("resize", buildStars);

  // ---- Bintang jatuh (shooting star) ----
  let shootingStars = [];
  function spawnShootingStar() {
    shootingStars.push({
      x: Math.random() * W * 0.7 + W * 0.15,
      y: Math.random() * H * 0.25,
      len: Math.random() * 90 + 60,
      speed: Math.random() * 7 + 6,
      angle: Math.PI / 4 + (Math.random() * 0.25 - 0.125),
      life: 1,
    });
  }
  setInterval(() => {
    if (Math.random() < 0.65) spawnShootingStar();
  }, 2200);

  // ---- Pita-pita aurora (warna selaras tema ungu-pink situs) ----
  const auroraBands = [
    { color: "rgba(120,255,190,", amp: 45, freq: 0.006, speedPh: 0.0006, base: 0.28 },
    { color: "rgba(140,170,255,", amp: 55, freq: 0.004, speedPh: 0.00045, base: 0.42 },
    { color: "rgba(210,120,255,", amp: 38, freq: 0.008, speedPh: 0.0007, base: 0.56 },
  ];

  let t = 0;
  function draw() {
    t += 1;
    // Canvas dibiarkan transparan (tidak diisi warna solid)
    // supaya gradasi ungu-pink asli di CSS tetap terlihat utuh,
    // dan efek berikut hanya "menimpa" di atasnya.
    ctx.clearRect(0, 0, W, H);

    // Bintang
    stars.forEach((s) => {
      const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * tw})`;
      ctx.fill();
    });

    // Aurora (mode "lighter" biar warnanya nge-glow saat tumpang tindih)
    ctx.globalCompositeOperation = "lighter";
    auroraBands.forEach((band, bi) => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 10) {
        const y =
          H * band.base +
          Math.sin(x * band.freq + t * band.speedPh + bi) * band.amp +
          Math.sin(x * band.freq * 2.3 + t * band.speedPh * 1.7) * band.amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, H * band.base - band.amp, 0, H);
      grad.addColorStop(0, band.color + "0.35)");
      grad.addColorStop(1, band.color + "0)");
      ctx.fillStyle = grad;
      ctx.fill();
    });
    ctx.globalCompositeOperation = "source-over";

    // Bintang jatuh
    shootingStars.forEach((s) => {
      const dx = Math.cos(s.angle) * s.speed;
      const dy = Math.sin(s.angle) * s.speed;
      s.x += dx;
      s.y += dy;
      s.life -= 0.02;

      const tailX = s.x - Math.cos(s.angle) * s.len;
      const tailY = s.y - Math.sin(s.angle) * s.len;
      const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
      grad.addColorStop(0, `rgba(255,255,255,${Math.max(s.life, 0)})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
    });
    shootingStars = shootingStars.filter(
      (s) => s.life > 0 && s.x < W + 100 && s.y < H + 100
    );

    requestAnimationFrame(draw);
  }
  draw();
})();

/* ============================================================
   Efek kartu berkilau (bling-bling): sapuan cahaya + titik sparkle
   di sekeliling tepi setiap elemen .card. Murni CSS animation,
   dibuat lewat JS supaya tidak perlu ubah file CSS.
   ============================================================ */
(function () {
  function initCardSparkle() {
    const style = document.createElement("style");
    style.textContent = `
      .card { position: relative; overflow: hidden; }
      .card-shine {
        position: absolute;
        top: 0;
        left: -150%;
        width: 60%;
        height: 100%;
        background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%);
        transform: skewX(-20deg);
        pointer-events: none;
        animation: cardShineSweep 4.5s ease-in-out infinite;
        z-index: 5;
      }
      @keyframes cardShineSweep {
        0%   { left: -150%; }
        35%  { left: 150%; }
        100% { left: 150%; }
      }
      .card-sparkle {
        position: absolute;
        width: 6px;
        height: 6px;
        background: #fff;
        border-radius: 50%;
        pointer-events: none;
        box-shadow: 0 0 6px 2px rgba(255,255,255,0.9);
        animation: cardSparkleTwinkle linear infinite;
        z-index: 6;
      }
      @keyframes cardSparkleTwinkle {
        0%, 100% { opacity: 0; transform: scale(0.3); }
        50%      { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);

    document.querySelectorAll(".card").forEach((card) => {
      // sapuan cahaya diagonal yang lewat berkala
      const shine = document.createElement("div");
      shine.className = "card-shine";
      card.appendChild(shine);

      // titik-titik kerlip tersebar di sekeliling tepi kartu
      const SPARKLE_COUNT = 14;
      for (let i = 0; i < SPARKLE_COUNT; i++) {
        const sp = document.createElement("span");
        sp.className = "card-sparkle";

        // sebar di 4 sisi tepi (bukan di tengah, biar tidak menutupi konten)
        const edge = Math.random();
        let top, left;
        if (edge < 0.25) {
          top = Math.random() * 100 + "%";
          left = Math.random() * 6 + "%";
        } else if (edge < 0.5) {
          top = Math.random() * 100 + "%";
          left = 94 - Math.random() * 6 + "%";
        } else if (edge < 0.75) {
          top = Math.random() * 6 + "%";
          left = Math.random() * 100 + "%";
        } else {
          top = 94 - Math.random() * 6 + "%";
          left = Math.random() * 100 + "%";
        }
        sp.style.top = top;
        sp.style.left = left;
        sp.style.animationDuration = (Math.random() * 2 + 1.5).toFixed(2) + "s";
        sp.style.animationDelay = (Math.random() * 3).toFixed(2) + "s";
        card.appendChild(sp);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCardSparkle);
  } else {
    initCardSparkle();
  }
})();
