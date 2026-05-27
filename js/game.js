(function () {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const hud = document.getElementById("hud");
  const scoreEl = document.getElementById("score");
  const lengthEl = document.getElementById("length");
  const leaderboardEl = document.getElementById("leaderboard");
  const onlineCountEl = document.getElementById("online-count");
  const boostFill = document.getElementById("boost-fill");
  const boostBar = document.getElementById("boost-bar");

  const screenLanding = document.getElementById("screen-landing");
  const screenSetup = document.getElementById("screen-setup");
  const screenGameover = document.getElementById("screen-gameover");
  const deathReasonEl = document.getElementById("death-reason");
  const finalScoreEl = document.getElementById("final-score");
  const finalLengthEl = document.getElementById("final-length");
  const highScoreEl = document.getElementById("high-score");
  const playerNameInput = document.getElementById("player-name");
  const playerColorOptionsEl = document.getElementById("player-color-options");
  const hudHintEl = document.getElementById("hud-hint");

  let state = "landing";
  let rafId = 0;
  let player = null;
  let snakes = [];
  let pellets = [];
  let camX = 0;
  let camY = 0;
  let pointer = { active: false, worldAngle: 0, aimX: 0, aimY: 60, locked: false };
  let lastTime = 0;
  let gameTime = 0;
  let highScore = parseInt(localStorage.getItem("ransanmoi-high") || "0", 10);
  let selectedPlayerPaletteId = localStorage.getItem("ransanmoi-player-color") || CONFIG.PLAYER_PALETTES[0].id;

  function resize() {
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    canvas.width = w;
    canvas.height = h;
  }

  const AIM_MARGIN = 48;

  function getAimBounds() {
    const hw = canvas.width / 2 - AIM_MARGIN;
    const hh = canvas.height / 2 - AIM_MARGIN;
    return { minX: -hw, maxX: hw, minY: -hh, maxY: hh };
  }

  function clampAim() {
    const b = getAimBounds();
    pointer.aimX = clamp(pointer.aimX, b.minX, b.maxX);
    pointer.aimY = clamp(pointer.aimY, b.minY, b.maxY);
    if (pointer.aimX === 0 && pointer.aimY === 0) pointer.aimY = 1;
    pointer.worldAngle = Math.atan2(pointer.aimY, pointer.aimX);
  }

  function resetAim() {
    pointer.aimX = 0;
    pointer.aimY = 60;
    clampAim();
  }

  function updatePointerFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const lx = clamp(clientX, rect.left, rect.right) - cx;
    const ly = clamp(clientY, rect.top, rect.bottom) - cy;
    pointer.aimX = lx;
    pointer.aimY = ly;
    clampAim();
  }

  function syncPointerLockState() {
    pointer.locked = document.pointerLockElement === canvas;
    canvas.classList.toggle("pointer-locked", pointer.locked);
    updateLockHint();
  }

  function updateLockHint() {
    if (!hudHintEl || state !== "playing") return;
    if (pointer.locked) {
      hudHintEl.textContent =
        "Di chuột trong vùng chơi · Giữ chuột để tăng tốc · ESC mở khóa chuột";
    } else {
      hudHintEl.textContent =
        "Nhấp vùng chơi để khóa chuột trong màn hình · ESC để mở khóa";
    }
  }

  function requestPlayLock() {
    if (!canvas.requestPointerLock) {
      updateLockHint();
      return;
    }
    try {
      const p = canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && typeof p.catch === "function") {
        p.catch(() => syncPointerLockState());
      }
    } catch {
      syncPointerLockState();
    }
  }

  function exitPlayLock() {
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
    pointer.locked = false;
    canvas.classList.remove("pointer-locked");
  }

  function showScreen(screen) {
    state = screen;
    screenLanding.classList.toggle("hidden", screen !== "landing");
    screenSetup.classList.toggle("hidden", screen !== "setup");
    screenGameover.classList.toggle("hidden", screen !== "gameover");

    const isPlaying = screen === "playing";
    hud.classList.toggle("hidden", !isPlaying);
    canvas.classList.toggle("hidden", !isPlaying);
    canvas.classList.toggle("playing", isPlaying);
    canvas.setAttribute("aria-hidden", isPlaying ? "false" : "true");
  }

  function getSelectedPlayerPalette() {
    return (
      CONFIG.PLAYER_PALETTES.find((p) => p.id === selectedPlayerPaletteId) ||
      CONFIG.PLAYER_PALETTES[0]
    );
  }

  function renderPlayerColorOptions() {
    if (!playerColorOptionsEl) return;
    playerColorOptionsEl.innerHTML = "";

    CONFIG.PLAYER_PALETTES.forEach((palette) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-option";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", palette.id === selectedPlayerPaletteId ? "true" : "false");
      button.dataset.colorId = palette.id;
      button.innerHTML = `<span class="color-dot" style="background:${palette.head}"></span><span class="color-name">${palette.name}</span>`;
      button.addEventListener("click", () => {
        selectedPlayerPaletteId = palette.id;
        localStorage.setItem("ransanmoi-player-color", selectedPlayerPaletteId);
        renderPlayerColorOptions();
      });
      playerColorOptionsEl.appendChild(button);
    });
  }

  function resetGameState() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    player = null;
    snakes = [];
    pellets = [];
    camX = 0;
    camY = 0;
    gameTime = 0;
    pointer.active = false;
    exitPlayLock();
    canvas.classList.remove("playing");
    canvas.classList.remove("pointer-locked");
  }

  function goToLanding() {
    exitPlayLock();
    resetGameState();
    showScreen("landing");
  }

  function goToSetup() {
    exitPlayLock();
    resetGameState();
    showScreen("setup");
    renderPlayerColorOptions();
    playerNameInput.focus();
  }

  function createBot(index) {
    const pos = randomSpawnFar(snakes, CONFIG.SPAWN_MIN_DIST);
    const bot = new Snake(
      pos.x,
      pos.y,
      CONFIG.BOT_NAMES[index % CONFIG.BOT_NAMES.length],
      CONFIG.COLORS.bots[index % CONFIG.COLORS.bots.length],
      false
    );
    bot.botIndex = index;
    bot.personality = pickPersonality(index);
    bot.angle = Math.random() * Math.PI * 2;
    bot.length = CONFIG.START_LENGTH + randRange(-15, 55);
    return bot;
  }

  function initGame() {
    resize();
    const playerPalette = getSelectedPlayerPalette();

    const name = (playerNameInput.value.trim() || "Bạn").slice(0, 12);
    const spawn = {
      x: CONFIG.WORLD_W / 2 + randRange(-120, 120),
      y: CONFIG.WORLD_H / 2 + randRange(-120, 120),
    };
    player = new Snake(spawn.x, spawn.y, name, playerPalette, true);
    player.angle = 0;
    snakes = [player];

    for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
      snakes.push(createBot(i));
    }

    pellets = [
      ...spawnPellets(CONFIG.PELLET_COUNT, CONFIG.WORLD_W, CONFIG.WORLD_H, CONFIG.PELLET_VALUE),
      ...spawnPellets(CONFIG.ORB_COUNT, CONFIG.WORLD_W, CONFIG.WORLD_H, CONFIG.ORB_VALUE),
    ];

    gameTime = 0;
    showScreen("playing");
    resetAim();
    lastTime = performance.now();
    requestPlayLock();
    updateLockHint();
    rafId = requestAnimationFrame(loop);
  }

  function endGame() {
    if (state !== "playing") return;

    exitPlayLock();

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    highScore = Math.max(highScore, player.score);
    localStorage.setItem("ransanmoi-high", String(highScore));

    deathReasonEl.textContent = player.deathReason || "Rắn đã gục.";
    finalScoreEl.textContent = player.score;
    finalLengthEl.textContent = Math.floor(player.length);
    highScoreEl.textContent = highScore;

    screenLanding.classList.add("hidden");
    screenSetup.classList.add("hidden");
    screenGameover.classList.remove("hidden");
    hud.classList.add("hidden");
    canvas.classList.remove("playing");
    canvas.classList.remove("hidden");
    state = "gameover";
  }

  function eatPellets(snake) {
    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i];
      const d = dist(snake.x, snake.y, p.x, p.y);
      if (d < snake.headRadius + p.radius) {
        snake.grow(p.value);
        pellets.splice(i, 1);
      }
    }
    while (pellets.length < CONFIG.PELLET_COUNT + CONFIG.ORB_COUNT) {
      const isOrb = Math.random() < 0.04;
      pellets.push(
        ...spawnPellets(1, CONFIG.WORLD_W, CONFIG.WORLD_H, isOrb ? CONFIG.ORB_VALUE : CONFIG.PELLET_VALUE)
      );
    }
  }

  function processBotRespawns() {
    for (let i = 0; i < snakes.length; i++) {
      const s = snakes[i];
      if (s.isPlayer || s.alive) continue;

      if (!s.respawnAt) {
        s.respawnAt = gameTime + randRange(CONFIG.BOT_RESPAWN_MIN, CONFIG.BOT_RESPAWN_MAX);
      } else if (gameTime >= s.respawnAt) {
        snakes[i] = createBot(s.botIndex);
      }
    }
  }

  function updateLeaderboard() {
    const sorted = snakes
      .filter((s) => s.alive)
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.LEADERBOARD_TOP);

    leaderboardEl.innerHTML = "";
    sorted.forEach((s, i) => {
      const li = document.createElement("li");
      if (s.isPlayer) li.className = "you";
      const name = s.name.length > 10 ? s.name.slice(0, 9) + "…" : s.name;
      li.innerHTML = `<span class="rank">${i + 1}.</span><span class="lb-name">${name}</span><span>${s.score}</span>`;
      leaderboardEl.appendChild(li);
    });

    if (onlineCountEl) {
      const alive = snakes.filter((s) => s.alive).length;
      onlineCountEl.textContent = alive + " đang chơi";
    }
  }

  function updateHUD() {
    if (!player) return;
    scoreEl.textContent = player.score;
    lengthEl.textContent = Math.floor(player.length);
    const boostRatio = clamp((player.length - CONFIG.MIN_LENGTH) / (CONFIG.START_LENGTH * 2), 0, 1);
    boostFill.style.transform = `scaleX(${boostRatio})`;
    boostBar.classList.toggle("active", player.boosting && boostRatio > 0.1);
    updateLeaderboard();
  }

  function update(dt) {
    if (state !== "playing" || !player) return;
    gameTime += dt;

    if (player.alive) {
      player.targetAngle = pointer.worldAngle;
      player.steerToward(player.targetAngle, dt);
      player.boosting = pointer.active && player.length > CONFIG.MIN_LENGTH;
      player.update(dt, CONFIG.WORLD_W, CONFIG.WORLD_H);
      eatPellets(player);
    }

    for (const snake of snakes) {
      if (snake === player || !snake.alive) continue;
      snake.updateAI(dt, pellets, snakes);
      snake.update(dt, CONFIG.WORLD_W, CONFIG.WORLD_H);
      eatPellets(snake);
    }

    for (const snake of snakes) {
      snake.checkCollisionWith(snakes);
      if (!snake.alive && !snake._dropped) {
        snake._dropped = true;
        dropPelletsFromSnake(snake, pellets);
      }
    }

    processBotRespawns();

    if (!player.alive) {
      endGame();
      return;
    }

    camX = player.x - canvas.width / 2;
    camY = player.y - canvas.height / 2;
    camX = clamp(camX, 0, Math.max(0, CONFIG.WORLD_W - canvas.width));
    camY = clamp(camY, 0, Math.max(0, CONFIG.WORLD_H - canvas.height));

    updateHUD();
  }

  function drawGrid() {
    const gs = CONFIG.GRID_SIZE;
    const startX = Math.floor(camX / gs) * gs;
    const startY = Math.floor(camY / gs) * gs;

    ctx.strokeStyle = "rgba(40, 55, 75, 0.35)";
    ctx.lineWidth = 1;
    for (let x = startX; x < camX + canvas.width + gs; x += gs) {
      const sx = x - camX;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < camY + canvas.height + gs; y += gs) {
      const sy = y - camY;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(canvas.width, sy);
      ctx.stroke();
    }
  }

  function drawWorldBounds() {
    const x0 = -camX;
    const y0 = -camY;
    const x1 = CONFIG.WORLD_W - camX;
    const y1 = CONFIG.WORLD_H - camY;

    ctx.strokeStyle = "rgba(255, 80, 80, 0.6)";
    ctx.lineWidth = 4;
    ctx.strokeRect(x0, y0, CONFIG.WORLD_W, CONFIG.WORLD_H);

    ctx.fillStyle = "rgba(255, 60, 60, 0.08)";
    if (camX < 0) ctx.fillRect(0, 0, -camX, canvas.height);
    if (camY < 0) ctx.fillRect(0, 0, canvas.width, -camY);
    if (camX + canvas.width > CONFIG.WORLD_W)
      ctx.fillRect(x1, 0, canvas.width - x1, canvas.height);
    if (camY + canvas.height > CONFIG.WORLD_H)
      ctx.fillRect(0, y1, canvas.width, canvas.height - y1);
  }

  function drawMinimap() {
    const mw = 120;
    const mh = 120;
    const mx = canvas.width - mw - 12;
    const my = canvas.height - mh - 12;
    const scale = mw / CONFIG.WORLD_W;

    ctx.fillStyle = "rgba(10, 14, 22, 0.75)";
    ctx.strokeStyle = "rgba(88, 240, 160, 0.3)";
    ctx.lineWidth = 1;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeRect(mx, my, mw, mh);

    for (const s of snakes) {
      if (!s.alive) continue;
      ctx.fillStyle = s.colors.head;
      ctx.beginPath();
      ctx.arc(mx + s.x * scale, my + s.y * scale, s.isPlayer ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayerMarker() {
    if (!player || !player.alive) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = player.headRadius;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const aimLen = Math.hypot(pointer.aimX, pointer.aimY);
    const scale = aimLen > 1 ? Math.min(48, aimLen) / aimLen : 0;
    const tx = cx + pointer.aimX * scale;
    const ty = cy + pointer.aimY * scale;
    ctx.strokeStyle = "rgba(88, 240, 160, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }

  function draw() {
    if (canvas.width < 10 || canvas.height < 10) resize();

    ctx.fillStyle = "#121820";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawWorldBounds();

    for (const p of pellets) {
      const sx = p.x - camX;
      const sy = p.y - camY;
      if (sx < -25 || sy < -25 || sx > canvas.width + 25 || sy > canvas.height + 25) continue;
      p.draw(ctx, camX, camY, gameTime);
    }

    const drawOrder = snakes.filter((s) => s.alive).sort((a, b) => a.y - b.y);
    for (const s of drawOrder) {
      if (!s.isOnScreen(camX, camY, canvas.width, canvas.height, 120)) continue;
      s.draw(ctx, camX, camY);
    }

    drawMinimap();
    drawPlayerMarker();
  }

  function loop(ts) {
    if (state !== "playing") return;
    const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0);
    lastTime = ts;
    update(dt);
    draw();
    if (state === "playing") rafId = requestAnimationFrame(loop);
  }

  function onPointerMove(e) {
    if (state !== "playing") return;

    if (document.pointerLockElement === canvas) {
      pointer.aimX += e.movementX || 0;
      pointer.aimY += e.movementY || 0;
      clampAim();
    } else if (e.clientX != null) {
      updatePointerFromClient(e.clientX, e.clientY);
    }
  }

  document.addEventListener("mousemove", (e) => {
    if (state !== "playing") return;
    if (document.pointerLockElement === canvas) {
      pointer.aimX += e.movementX || 0;
      pointer.aimY += e.movementY || 0;
      clampAim();
      return;
    }
    if (e.target === canvas || canvas.contains(e.target)) {
      onPointerMove(e);
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    if (state !== "playing") return;
    if (e.button === 0) {
      pointer.active = true;
      if (document.pointerLockElement !== canvas) {
        requestPlayLock();
      }
      updatePointerFromClient(e.clientX, e.clientY);
    }
  });
  window.addEventListener("mouseup", () => {
    pointer.active = false;
  });

  canvas.addEventListener("click", () => {
    if (state === "playing" && document.pointerLockElement !== canvas) {
      requestPlayLock();
    }
  });

  document.addEventListener("pointerlockchange", syncPointerLockState);
  document.addEventListener("pointerlockerror", syncPointerLockState);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state === "playing") {
      exitPlayLock();
      updateLockHint();
    }
  });

  window.addEventListener("blur", () => {
    if (state === "playing" && document.pointerLockElement === canvas) {
      syncPointerLockState();
    }
  });

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (state !== "playing") return;
    pointer.active = true;
    const t = e.touches[0];
    updatePointerFromClient(t.clientX, t.clientY);
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (state !== "playing") return;
    const t = e.touches[0];
    updatePointerFromClient(t.clientX, t.clientY);
  }, { passive: false });
  canvas.addEventListener("touchend", () => {
    pointer.active = false;
  });

  document.getElementById("btn-landing-play").addEventListener("click", goToSetup);
  document.getElementById("btn-start").addEventListener("click", initGame);
  document.getElementById("btn-replay").addEventListener("click", goToSetup);
  document.getElementById("btn-exit").addEventListener("click", goToLanding);

  playerNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && state === "setup") initGame();
  });

  window.addEventListener("resize", () => {
    resize();
    if (state === "playing") clampAim();
  });

  resize();
  renderPlayerColorOptions();
  showScreen("landing");
})();
