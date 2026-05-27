/** Local single-player fallback when no WebSocket server is available (e.g. GitHub Pages). */
const OfflineMode = (function () {
  let player = null;
  let snakes = [];
  let pellets = [];
  let gameTime = 0;

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

  function eatPellets(snake) {
    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i];
      if (dist(snake.x, snake.y, p.x, p.y) < snake.headRadius + p.radius) {
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

  function init(name, palette) {
    gameTime = 0;
    const spawn = {
      x: CONFIG.WORLD_W / 2 + randRange(-120, 120),
      y: CONFIG.WORLD_H / 2 + randRange(-120, 120),
    };
    player = new Snake(spawn.x, spawn.y, name, palette, true);
    player.angle = 0;
    snakes = [player];
    for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
      snakes.push(createBot(i));
    }
    pellets = [
      ...spawnPellets(CONFIG.PELLET_COUNT, CONFIG.WORLD_W, CONFIG.WORLD_H, CONFIG.PELLET_VALUE),
      ...spawnPellets(CONFIG.ORB_COUNT, CONFIG.WORLD_W, CONFIG.WORLD_H, CONFIG.ORB_VALUE),
    ];
  }

  function update(dt, pointer) {
    if (!player) return { player: null, alive: false };

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
    return { player, alive: player.alive };
  }

  function getLeaderboard() {
    return snakes
      .filter((s) => s.alive)
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.LEADERBOARD_TOP)
      .map((s) => ({
        id: s.isPlayer ? "you" : s.name,
        name: s.name,
        score: s.score,
        alive: s.alive,
        isYou: s.isPlayer,
      }));
  }

  function reset() {
    player = null;
    snakes = [];
    pellets = [];
    gameTime = 0;
  }

  return { init, update, reset, get player() { return player; }, get snakes() { return snakes; }, get pellets() { return pellets; }, getLeaderboard };
})();
