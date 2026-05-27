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
  const connectionStatusEl = document.getElementById("connection-status");
  const setupTaglineEl = document.querySelector(".screen-setup .tagline");

  let state = "landing";
  let gameMode = null;
  let rafId = 0;
  let socket = null;
  let myPlayerId = null;
  let snapshot = null;
  let hasJoined = false;
  let intentionalClose = false;
  let connectTimeoutId = null;
  let lastFrameTime = 0;
  let highScore = parseInt(localStorage.getItem("ransanmoi-high") || "0", 10);
  let selectedPlayerPaletteId = localStorage.getItem("ransanmoi-player-color") || CONFIG.PLAYER_PALETTES[0].id;

  let pointer = {
    active: false,
    worldAngle: 0,
    aimX: 0,
    aimY: 60,
    locked: false,
  };
  let mobileSteerTouchId = null;
  const AIM_MARGIN = 48;

  function resize() {
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    canvas.width = w;
    canvas.height = h;
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
      button.innerHTML = `<span class="color-dot" style="background:${palette.head}"></span><span class="color-name">${palette.name}</span>`;
      button.addEventListener("click", () => {
        selectedPlayerPaletteId = palette.id;
        localStorage.setItem("ransanmoi-player-color", selectedPlayerPaletteId);
        renderPlayerColorOptions();
      });
      playerColorOptionsEl.appendChild(button);
    });
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

  function closeSocket() {
    if (connectTimeoutId) {
      clearTimeout(connectTimeoutId);
      connectTimeoutId = null;
    }
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
      socket = null;
    }
    myPlayerId = null;
    snapshot = null;
    hasJoined = false;
  }

  function resetGameState() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    pointer.active = false;
    mobileSteerTouchId = null;
    intentionalClose = false;
    closeSocket();
    OfflineMode.reset();
    gameMode = null;
    exitPlayLock();
  }

  function goToLanding() {
    resetGameState();
    showScreen("landing");
  }

  function goToSetup() {
    resetGameState();
    showScreen("setup");
    renderPlayerColorOptions();
    updateConnectionStatus();
    playerNameInput.focus();
  }

  function isStaticPagesHost() {
    const h = location.hostname;
    return /\.(github|gitlab)\.io$/i.test(h) || /\.pages\.dev$/i.test(h);
  }

  function resolveWsUrl() {
    const params = new URLSearchParams(location.search);
    const queryWs = params.get("ws");
    if (queryWs && queryWs.trim()) return queryWs.trim();

    const stored = localStorage.getItem("ransanmoi-ws-url");
    if (stored && stored.trim()) return stored.trim();

    const cfg = CONFIG.NETWORK.WS_URL;
    if (cfg && String(cfg).trim()) return String(cfg).trim();

    if (isStaticPagesHost()) return null;

    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}${CONFIG.NETWORK.WS_PATH}`;
  }

  function setConnectionError(message) {
    if (!connectionStatusEl) return;
    connectionStatusEl.className = "connection-status error";
    connectionStatusEl.textContent = message;
  }

  function updateConnectionStatus() {
    if (!connectionStatusEl) return;
    const url = resolveWsUrl();
    if (url) {
      connectionStatusEl.className = "connection-status online";
      connectionStatusEl.textContent =
        "Chế độ online: kết nối máy chủ game khi vào trận (cùng trang hoặc WS_URL).";
      if (setupTaglineEl) setupTaglineEl.textContent = "Nhiều người chơi thời gian thực trên cùng bản đồ.";
    } else {
      connectionStatusEl.className = "connection-status offline";
      connectionStatusEl.textContent =
        "Chế độ ngoại tuyến (16 bot). GitHub Pages không chạy máy chủ — chạy npm run dev hoặc đặt WS_URL / ?ws= để chơi online.";
      if (setupTaglineEl) setupTaglineEl.textContent = "16 người chơi ảo — không cần máy chủ.";
    }
  }

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
    pointer.aimX = clamp(clientX, rect.left, rect.right) - cx;
    pointer.aimY = clamp(clientY, rect.top, rect.bottom) - cy;
    clampAim();
  }

  function syncPointerLockState() {
    pointer.locked = document.pointerLockElement === canvas;
    canvas.classList.toggle("pointer-locked", pointer.locked);
    updateLockHint();
  }

  function updateLockHint() {
    if (!hudHintEl || state !== "playing") return;
    const modeLabel = gameMode === "offline" ? "Ngoại tuyến" : "Online";
    const mobileBoostHelp = " · Mobile: giữ 2 ngón để tăng tốc";
    if (pointer.locked) {
      hudHintEl.textContent = `${modeLabel} · Giữ chuột để tăng tốc · ESC mở khóa chuột${mobileBoostHelp}`;
    } else {
      hudHintEl.textContent = `Nhấp vùng chơi để khóa chuột · ${modeLabel}${mobileBoostHelp}`;
    }
  }

  function requestPlayLock() {
    if (!canvas.requestPointerLock) return;
    try {
      const req = canvas.requestPointerLock({ unadjustedMovement: true });
      if (req && typeof req.catch === "function") req.catch(() => {});
    } catch {
      // noop
    }
  }

  function exitPlayLock() {
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
    pointer.locked = false;
    canvas.classList.remove("pointer-locked");
  }

  function sendInput() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !myPlayerId || state !== "playing") return;
    socket.send(
      JSON.stringify({
        type: "input",
        angle: pointer.worldAngle,
        boost: pointer.active,
      })
    );
  }

  function abortMultiplayerConnection(message) {
    intentionalClose = true;
    if (socket) {
      socket.onclose = null;
      socket.close();
      socket = null;
    }
    if (connectTimeoutId) {
      clearTimeout(connectTimeoutId);
      connectTimeoutId = null;
    }
    myPlayerId = null;
    snapshot = null;
    hasJoined = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    exitPlayLock();
    showScreen("setup");
    setConnectionError(message);
  }

  function startOfflineGame(name, palette) {
    gameMode = "offline";
    intentionalClose = false;
    showScreen("playing");
    resetAim();
    requestPlayLock();
    updateLockHint();
    OfflineMode.init(name, palette);
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function startMultiplayerGame(name, palette, url) {
    gameMode = "multiplayer";
    hasJoined = false;
    intentionalClose = false;
    showScreen("playing");
    resetAim();
    requestPlayLock();
    updateLockHint();

    const timeoutMs = CONFIG.NETWORK.CONNECT_TIMEOUT_MS || 8000;
    connectTimeoutId = setTimeout(() => {
      if (!hasJoined && state === "playing" && gameMode === "multiplayer") {
        abortMultiplayerConnection(
          "Không kết nối được máy chủ trong thời gian chờ. Chạy npm run dev hoặc cấu hình WS_URL / ?ws=."
        );
      }
    }, timeoutMs);

    socket = new WebSocket(url);
    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "join",
          name,
          colorId: palette.id,
        })
      );
      sendInput();
    };

    socket.onmessage = (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (msg.type === "joined") {
        myPlayerId = msg.playerId;
        hasJoined = true;
        if (connectTimeoutId) {
          clearTimeout(connectTimeoutId);
          connectTimeoutId = null;
        }
        return;
      }
      if (msg.type === "snapshot") {
        snapshot = msg;
      }
    };

    socket.onclose = () => {
      if (intentionalClose || state !== "playing" || gameMode !== "multiplayer") return;
      if (!hasJoined) {
        abortMultiplayerConnection("Không kết nối được máy chủ. Kiểm tra npm run dev hoặc địa chỉ WS_URL.");
        return;
      }
      const me = getMyPlayer();
      endGame({
        score: me ? me.score : 0,
        length: me ? me.length : 0,
        deathReason: "Mất kết nối server!",
      });
    };

    rafId = requestAnimationFrame(loop);
  }

  function initGame() {
    resetGameState();
    resize();

    const palette = getSelectedPlayerPalette();
    const name = (playerNameInput.value.trim() || "Bạn").slice(0, 12);
    const url = resolveWsUrl();

    if (!url) {
      startOfflineGame(name, palette);
      return;
    }
    startMultiplayerGame(name, palette, url);
  }

  function getMyPlayer() {
    if (!snapshot || !myPlayerId) return null;
    return snapshot.players.find((p) => p.id === myPlayerId) || null;
  }

  function endGame(player) {
    if (state !== "playing") return;
    highScore = Math.max(highScore, Math.floor(player.score));
    localStorage.setItem("ransanmoi-high", String(highScore));

    deathReasonEl.textContent = player.deathReason || "Bạn đã thua!";
    finalScoreEl.textContent = Math.floor(player.score);
    finalLengthEl.textContent = Math.floor(player.length);
    highScoreEl.textContent = highScore;

    showScreen("gameover");
    intentionalClose = true;
    closeSocket();
    OfflineMode.reset();
    gameMode = null;
    exitPlayLock();
  }

  function endGameOffline(player) {
    endGame({
      score: player.score,
      length: player.length,
      deathReason: player.deathReason || "Bạn đã thua!",
    });
  }

  function updateHUDOffline(player) {
    scoreEl.textContent = Math.floor(player.score);
    lengthEl.textContent = Math.floor(player.length);
    const boostRatio = clamp((player.length - CONFIG.MIN_LENGTH) / (CONFIG.START_LENGTH * 2), 0, 1);
    boostFill.style.transform = `scaleX(${boostRatio})`;
    boostBar.classList.toggle("active", pointer.active && boostRatio > 0.1);

    leaderboardEl.innerHTML = "";
    OfflineMode.getLeaderboard().forEach((entry, idx) => {
      const li = document.createElement("li");
      if (entry.isYou) li.className = "you";
      const shortName = entry.name.length > 10 ? `${entry.name.slice(0, 9)}…` : entry.name;
      li.innerHTML = `<span class="rank">${idx + 1}.</span><span class="lb-name">${shortName}</span><span>${Math.floor(entry.score)}</span>`;
      leaderboardEl.appendChild(li);
    });

    const alive = OfflineMode.snakes.filter((s) => s.alive).length;
    onlineCountEl.textContent = `${alive} đang chơi (ngoại tuyến)`;
  }

  function updateHUD(player) {
    scoreEl.textContent = Math.floor(player.score);
    lengthEl.textContent = Math.floor(player.length);
    const boostRatio = clamp((player.length - CONFIG.MIN_LENGTH) / (CONFIG.START_LENGTH * 2), 0, 1);
    boostFill.style.transform = `scaleX(${boostRatio})`;
    boostBar.classList.toggle("active", pointer.active && boostRatio > 0.1);

    leaderboardEl.innerHTML = "";
    (snapshot?.leaderboard || []).forEach((entry, idx) => {
      const li = document.createElement("li");
      if (entry.id === myPlayerId) li.className = "you";
      const shortName = entry.name.length > 10 ? `${entry.name.slice(0, 9)}…` : entry.name;
      li.innerHTML = `<span class="rank">${idx + 1}.</span><span class="lb-name">${shortName}</span><span>${Math.floor(entry.score)}</span>`;
      leaderboardEl.appendChild(li);
    });

    onlineCountEl.textContent = `${snapshot?.players?.length || 0} đang chơi`;
  }

  function drawGrid(camX, camY) {
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

  function drawWorldBounds(camX, camY, worldW, worldH) {
    ctx.strokeStyle = "rgba(255,80,80,0.6)";
    ctx.lineWidth = 4;
    ctx.strokeRect(-camX, -camY, worldW, worldH);
  }

  function drawFood(camX, camY) {
    if (!snapshot) return;
    for (const food of snapshot.foods || []) {
      const sx = food.x - camX;
      const sy = food.y - camY;
      if (sx < -25 || sy < -25 || sx > canvas.width + 25 || sy > canvas.height + 25) continue;
      const radius = food.radius || (food.value > 1 ? 10 : 5);
      const color = food.value > 1 ? "#ffd166" : "#70f0a0";
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSnake(player, camX, camY) {
    if (!player.alive) return;
    const segments = player.segments || [];
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      const sx = seg.x - camX;
      const sy = seg.y - camY;
      const isHead = i === 0;

      ctx.fillStyle = isHead ? player.color.head : player.color.body;
      ctx.beginPath();
      ctx.arc(sx, sy, seg.r, 0, Math.PI * 2);
      ctx.fill();

      if (player.color.stroke) {
        ctx.strokeStyle = player.color.stroke;
        ctx.lineWidth = isHead ? 2.3 : 1.2;
        ctx.globalAlpha = isHead ? 0.95 : 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (isHead) {
        const ex = sx + Math.cos(player.angle) * seg.r * 0.45;
        const ey = sy + Math.sin(player.angle) * seg.r * 0.45;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(ex - 4, ey - 3, 2.5, 0, Math.PI * 2);
        ctx.arc(ex + 4, ey - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(player.name, player.x - camX + 1, player.y - camY - 24 + 1);
    ctx.fillStyle = player.id === myPlayerId ? "#ffd166" : "#e8edf5";
    ctx.fillText(player.name, player.x - camX, player.y - camY - 24);
  }

  function drawMinimap(worldW, worldH) {
    const mw = 120;
    const mh = 120;
    const mx = canvas.width - mw - 12;
    const my = canvas.height - mh - 12;
    const scaleX = mw / worldW;
    const scaleY = mh / worldH;
    ctx.fillStyle = "rgba(10, 14, 22, 0.75)";
    ctx.strokeStyle = "rgba(88, 240, 160, 0.3)";
    ctx.lineWidth = 1;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeRect(mx, my, mw, mh);
    for (const p of snapshot?.players || []) {
      if (!p.alive) continue;
      ctx.fillStyle = p.color.head;
      ctx.beginPath();
      ctx.arc(mx + p.x * scaleX, my + p.y * scaleY, p.id === myPlayerId ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayerMarker() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const aimLen = Math.hypot(pointer.aimX, pointer.aimY);
    const scale = aimLen > 1 ? Math.min(48, aimLen) / aimLen : 0;
    const tx = cx + pointer.aimX * scale;
    const ty = cy + pointer.aimY * scale;
    ctx.strokeStyle = "rgba(88,240,160,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }

  function drawOffline() {
    ctx.fillStyle = "#121820";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const player = OfflineMode.player;
    const worldW = CONFIG.WORLD_W;
    const worldH = CONFIG.WORLD_H;
    const camX = player
      ? clamp(player.x - canvas.width / 2, 0, Math.max(0, worldW - canvas.width))
      : 0;
    const camY = player
      ? clamp(player.y - canvas.height / 2, 0, Math.max(0, worldH - canvas.height))
      : 0;

    drawGrid(camX, camY);
    drawWorldBounds(camX, camY, worldW, worldH);
    for (const p of OfflineMode.pellets) {
      p.draw(ctx, camX, camY, 0);
    }
    const sorted = [...OfflineMode.snakes].sort((a, b) => a.y - b.y);
    for (const snake of sorted) {
      snake.draw(ctx, camX, camY);
    }
    drawMinimapOffline(worldW, worldH);
    drawPlayerMarker();
  }

  function drawMinimapOffline(worldW, worldH) {
    const mw = 120;
    const mh = 120;
    const mx = canvas.width - mw - 12;
    const my = canvas.height - mh - 12;
    const scaleX = mw / worldW;
    const scaleY = mh / worldH;
    ctx.fillStyle = "rgba(10, 14, 22, 0.75)";
    ctx.strokeStyle = "rgba(88, 240, 160, 0.3)";
    ctx.lineWidth = 1;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeRect(mx, my, mw, mh);
    for (const s of OfflineMode.snakes) {
      if (!s.alive) continue;
      ctx.fillStyle = s.colors.head;
      ctx.beginPath();
      ctx.arc(mx + s.x * scaleX, my + s.y * scaleY, s.isPlayer ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    ctx.fillStyle = "#121820";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!snapshot || !snapshot.world) return;
    const me = getMyPlayer();
    const worldW = snapshot.world.width;
    const worldH = snapshot.world.height;

    const camX = me ? clamp(me.x - canvas.width / 2, 0, Math.max(0, worldW - canvas.width)) : 0;
    const camY = me ? clamp(me.y - canvas.height / 2, 0, Math.max(0, worldH - canvas.height)) : 0;

    drawGrid(camX, camY);
    drawWorldBounds(camX, camY, worldW, worldH);
    drawFood(camX, camY);

    const sorted = [...(snapshot.players || [])].sort((a, b) => a.y - b.y);
    for (const player of sorted) {
      drawSnake(player, camX, camY);
    }

    drawMinimap(worldW, worldH);
    drawPlayerMarker();
  }

  function loop(now) {
    if (state !== "playing") return;

    if (gameMode === "offline") {
      const t = typeof now === "number" ? now : performance.now();
      const dt = Math.min(0.05, (t - lastFrameTime) / 1000 || 0.016);
      lastFrameTime = t;
      const result = OfflineMode.update(dt, pointer);
      const player = result.player;
      if (player) {
        updateHUDOffline(player);
        if (!player.alive) {
          endGameOffline(player);
          return;
        }
      }
      drawOffline();
      rafId = requestAnimationFrame(loop);
      return;
    }

    const me = getMyPlayer();
    if (me) {
      updateHUD(me);
      if (!me.alive) {
        endGame(me);
        return;
      }
    }
    sendInput();
    draw();
    rafId = requestAnimationFrame(loop);
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

  function getTouchById(touchList, id) {
    for (let i = 0; i < touchList.length; i++) {
      if (touchList[i].identifier === id) return touchList[i];
    }
    return null;
  }

  function updateTouchInput(e) {
    if (state !== "playing") return;
    const touches = e.touches;
    pointer.active = touches.length >= 2;

    if (touches.length === 0) {
      mobileSteerTouchId = null;
      return;
    }

    let steerTouch = null;
    if (mobileSteerTouchId != null) {
      steerTouch = getTouchById(touches, mobileSteerTouchId);
    }
    if (!steerTouch) {
      steerTouch = touches[0];
      mobileSteerTouchId = steerTouch.identifier;
    }
    updatePointerFromClient(steerTouch.clientX, steerTouch.clientY);
  }

  document.addEventListener("mousemove", (e) => {
    if (state !== "playing") return;
    if (document.pointerLockElement === canvas) {
      onPointerMove(e);
      return;
    }
    if (e.target === canvas || canvas.contains(e.target)) onPointerMove(e);
  });

  canvas.addEventListener("mousedown", (e) => {
    if (state !== "playing") return;
    if (e.button !== 0) return;
    pointer.active = true;
    if (document.pointerLockElement !== canvas) requestPlayLock();
  });
  window.addEventListener("mouseup", () => {
    pointer.active = false;
  });

  canvas.addEventListener("click", () => {
    if (state === "playing" && document.pointerLockElement !== canvas) requestPlayLock();
  });
  document.addEventListener("pointerlockchange", syncPointerLockState);
  document.addEventListener("pointerlockerror", syncPointerLockState);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state === "playing") exitPlayLock();
  });

  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (state !== "playing") return;
      updateTouchInput(e);
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (state !== "playing") return;
      updateTouchInput(e);
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      updateTouchInput(e);
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchcancel",
    (e) => {
      e.preventDefault();
      updateTouchInput(e);
    },
    { passive: false }
  );

  document.getElementById("btn-landing-play").addEventListener("click", goToSetup);
  document.getElementById("btn-start").addEventListener("click", initGame);
  document.getElementById("btn-replay").addEventListener("click", goToSetup);
  document.getElementById("btn-exit").addEventListener("click", goToLanding);

  playerNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && state === "setup") initGame();
  });

  window.addEventListener("resize", () => {
    resize();
    clampAim();
  });

  resize();
  resetAim();
  renderPlayerColorOptions();
  updateConnectionStatus();
  showScreen("landing");
})();
