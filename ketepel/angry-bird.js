window.addEventListener('DOMContentLoaded', () => {
  const { Engine, Render, Runner, World, Bodies, Composite, Constraint, Mouse, MouseConstraint, Events, Vector } = Matter;

  const canvas = document.getElementById('abCanvas');
  const W = 640, H = 380;
  canvas.width = W;
  canvas.height = H;

  const engine = Engine.create();
  const world = engine.world;
  world.gravity.y = 1;

  const render = Render.create({
    canvas,
    engine,
    options: { width: W, height: H, wireframes: false, background: 'transparent' },
  });
  Render.run(render);
  const runner = Runner.create();
  Runner.run(runner, engine);

  // Tanah
  const ground = Bodies.rectangle(W / 2, H + 20, W, 60, {
    isStatic: true,
    render: { fillStyle: '#8bc34a' },
  });

  // Tiang ketapel (visual, statis)
  const anchorPos = { x: 90, y: H - 130 };
  const pole = Bodies.rectangle(anchorPos.x, H - 40, 10, 130, {
    isStatic: true,
    render: { fillStyle: '#6d4c2f' },
  });

  // Bangunan: tumpukan kotak + atap
  const boxes = [];
  const boxW = 40, boxH = 30;
  const baseX = 480;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      const bx = Bodies.rectangle(
        baseX + col * boxW,
        H - 30 - row * boxH - boxH / 2,
        boxW - 4, boxH - 4,
        { restitution: 0.1, friction: 0.6, render: { fillStyle: row % 2 === 0 ? '#c99a5b' : '#e0b877' } }
      );
      boxes.push(bx);
    }
  }
  const roof = Bodies.rectangle(baseX + boxW / 2, H - 30 - 4 * boxH - 10, boxW * 2, 20, {
    restitution: 0.1, friction: 0.6, render: { fillStyle: '#b23b3b' },
  });
  boxes.push(roof);

  World.add(world, [ground, pole, ...boxes]);

  let bird, elastic, released = false;

  function spawnBird() {
    bird = Bodies.circle(anchorPos.x, anchorPos.y, 16, {
      restitution: 0.5,
      friction: 0.5,
      density: 0.006,
      render: { fillStyle: '#e63946' },
    });
    World.add(world, bird);
    elastic = Constraint.create({
      pointA: anchorPos,
      bodyB: bird,
      stiffness: 0.045,
      damping: 0.01,
      render: { strokeStyle: '#6d4c2f', lineWidth: 3 },
    });
    World.add(world, elastic);
    released = false;
  }

  const mouse = Mouse.create(render.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.2, render: { visible: false } },
  });
  World.add(world, mouseConstraint);
  render.mouse = mouse;

  // Hanya izinkan drag pada burung yang sedang di ketapel
  Events.on(mouseConstraint, 'startdrag', (e) => {
    if (e.body !== bird) {
      mouseConstraint.constraint.bodyB = null;
    }
  });

  Events.on(mouseConstraint, 'enddrag', (e) => {
    if (e.body === bird) released = true;
  });

  let birdsLeft = 3;
  let score = 0;
  const countedBoxes = new Set();
  let settleTimer = null;
  let gameOver = false;

  document.getElementById('abBirds').textContent = birdsLeft;

  Events.on(engine, 'afterUpdate', () => {
    if (gameOver) return;

    if (released && elastic.bodyB) {
      const d = Vector.magnitude(Vector.sub(bird.position, anchorPos));
      if (d < 20) {
        Composite.remove(world, elastic);
        elastic.bodyB = null;
        released = false;
        scheduleNextBird();
      }
    }

    boxes.forEach((b, i) => {
      if (!countedBoxes.has(i) && (Math.abs(b.angle) > 0.6 || b.position.y > H)) {
        countedBoxes.add(i);
        score += 100;
        document.getElementById('abScore').textContent = score;
      }
    });

    if (countedBoxes.size === boxes.length) {
      endGame(true);
    }
  });

  function scheduleNextBird() {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (gameOver) return;
      if (bird) World.remove(world, bird);
      birdsLeft--;
      document.getElementById('abBirds').textContent = Math.max(birdsLeft, 0);
      if (countedBoxes.size === boxes.length) {
        endGame(true);
      } else if (birdsLeft <= 0) {
        endGame(false);
      } else {
        spawnBird();
      }
    }, 3000);
  }

  function endGame(win) {
    if (gameOver) return;
    gameOver = true;
    Runner.stop(runner);
    const overlay = document.getElementById('abOverlay');
    const text = document.getElementById('abOverlayText');
    text.textContent = win ? `🎉 Bangunan hancur! Skor: ${score}` : `Game selesai. Skor: ${score}`;
    overlay.classList.remove('hidden');
  }

  document.getElementById('abRestartBtn').addEventListener('click', () => {
    location.reload();
  });

  spawnBird();
});
