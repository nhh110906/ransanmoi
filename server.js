const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");

const PORT = process.env.PORT || 8080;
const WORLD_W = 5000;
const WORLD_H = 5000;
const TICK_RATE = 20;
const DT = 1 / TICK_RATE;

const BASE_SPEED = 150;
const BOOST_SPEED = 270;
const BOOST_DRAIN = 24;
const START_LENGTH = 120;
const MIN_LENGTH = 45;
const SEGMENT_SPACING = 7;
const HEAD_RADIUS = 14;

const FOOD_COUNT = 450;
const FOOD_VALUE_SMALL = 1;
const FOOD_VALUE_BIG = 8;

const PLAYER_COLORS = {
  mint: { head: "#58f0a0", body: "#3bc87a", glow: "rgba(88,240,160,0.5)", stroke: "#e8fff2" },
  sky: { head: "#6eb5ff", body: "#4090d4", glow: "rgba(110,181,255,0.45)", stroke: "#d8eeff" },
  violet: { head: "#c77dff", body: "#9b5fd4", glow: "rgba(199,125,255,0.45)", stroke: "#f0d8ff" },
  sun: { head: "#ffe066", body: "#d4b030", glow: "rgba(255,224,102,0.45)", stroke: "#fff8d0" },
  rose: { head: "#ff7eb9", body: "#e05590", glow: "rgba(255,126,185,0.45)", stroke: "#ffd8ec" },
  fire: { head: "#ff8866", body: "#d45a40", glow: "rgba(255,136,102,0.45)", stroke: "#ffe0d8" },
};

const app = express();
app.use(express.static(path.resolve(__dirname)));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

let playerSeq = 1;
const clients = new Map();
const players = new Map();
const foods = [];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randomFood(value = FOOD_VALUE_SMALL) {
  return {
    x: rand(80, WORLD_W - 80),
    y: rand(80, WORLD_H - 80),
    value,
    radius: value === FOOD_VALUE_BIG ? 10 : 5,
  };
}

function refillFood() {
  while (foods.length < FOOD_COUNT) {
    const value = Math.random() < 0.04 ? FOOD_VALUE_BIG : FOOD_VALUE_SMALL;
    foods.push(randomFood(value));
  }
}

function randomSpawn() {
  return {
    x: rand(200, WORLD_W - 200),
    y: rand(200, WORLD_H - 200),
  };
}

function makePlayer(name, colorId) {
  const spawn = randomSpawn();
  const id = `p${playerSeq++}`;
  return {
    id,
    name: (name || "Người chơi").slice(0, 14),
    color: PLAYER_COLORS[colorId] || PLAYER_COLORS.mint,
    x: spawn.x,
    y: spawn.y,
    angle: 0,
    boost: false,
    inputAngle: 0,
    alive: true,
    deathReason: "",
    score: 0,
    length: START_LENGTH,
    path: [{ x: spawn.x, y: spawn.y }],
  };
}

function computeSegments(player) {
  const points = [];
  const path = player.path;
  const segmentCount = Math.max(8, Math.floor(player.length / SEGMENT_SPACING));
  points.push({ x: player.x, y: player.y, r: HEAD_RADIUS });

  if (path.length < 2) return points;

  let pathIdx = path.length - 2;
  let px = player.x;
  let py = player.y;
  let distAcc = 0;

  for (let i = 1; i < segmentCount && pathIdx >= 0; i++) {
    while (distAcc < SEGMENT_SPACING && pathIdx >= 0) {
      const nx = path[pathIdx].x;
      const ny = path[pathIdx].y;
      const seg = dist(px, py, nx, ny);
      if (seg <= 0.001) {
        pathIdx--;
        continue;
      }
      const need = SEGMENT_SPACING - distAcc;
      if (seg >= need) {
        const t = need / seg;
        px += (nx - px) * t;
        py += (ny - py) * t;
        distAcc = SEGMENT_SPACING;
      } else {
        distAcc += seg;
        px = nx;
        py = ny;
        pathIdx--;
      }
    }
    distAcc = 0;
    const t = i / segmentCount;
    points.push({
      x: px,
      y: py,
      r: 10 * (1 - t * 0.25) + 2,
    });
  }

  return points;
}

function trimPath(player) {
  const maxPath = Math.max(50, Math.floor(player.length / 2));
  while (player.path.length > maxPath) {
    player.path.shift();
  }
}

function pathLength(path) {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    len += dist(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
  }
  return len;
}

function dropFoodFromPlayer(player) {
  const points = computeSegments(player);
  const step = Math.max(2, Math.floor(points.length / 20));
  let dropped = 0;
  for (let i = 0; i < points.length && dropped < 18; i += step) {
    if (Math.random() < 0.6) {
      foods.push({
        x: points[i].x + rand(-8, 8),
        y: points[i].y + rand(-8, 8),
        value: FOOD_VALUE_SMALL,
        radius: 5,
      });
      dropped++;
    }
  }
}

function killPlayer(player, reason) {
  if (!player.alive) return;
  player.alive = false;
  player.deathReason = reason || "Đã bị hạ!";
  dropFoodFromPlayer(player);
}

function updatePlayers() {
  for (const player of players.values()) {
    if (!player.alive) continue;
    player.angle = player.inputAngle;

    const speed = player.boost ? BOOST_SPEED : BASE_SPEED;
    if (player.boost && player.length > MIN_LENGTH) {
      player.length -= BOOST_DRAIN * DT;
    }

    player.x += Math.cos(player.angle) * speed * DT;
    player.y += Math.sin(player.angle) * speed * DT;
    player.x = clamp(player.x, 30, WORLD_W - 30);
    player.y = clamp(player.y, 30, WORLD_H - 30);

    player.path.push({ x: player.x, y: player.y });
    trimPath(player);

    while (pathLength(player.path) > player.length && player.path.length > 2) {
      player.path.shift();
    }

    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      if (dist(player.x, player.y, f.x, f.y) < HEAD_RADIUS + f.radius) {
        player.length += f.value * 3.5;
        player.score += f.value;
        foods.splice(i, 1);
      }
    }
  }
}

function checkCollisions() {
  const all = Array.from(players.values()).filter((p) => p.alive);
  for (const p of all) {
    const hr = HEAD_RADIUS * 0.7;
    for (const other of all) {
      if (p.id === other.id) continue;
      const otherSegments = computeSegments(other);
      for (let i = 5; i < otherSegments.length; i++) {
        const seg = otherSegments[i];
        if (dist(p.x, p.y, seg.x, seg.y) < hr + seg.r * 0.85) {
          killPlayer(p, `Va vào thân rắn ${other.name}!`);
          break;
        }
      }
      if (!p.alive) break;
    }
  }
}

function broadcastState() {
  const playerSnapshots = Array.from(players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    x: p.x,
    y: p.y,
    angle: p.angle,
    score: p.score,
    length: p.length,
    alive: p.alive,
    deathReason: p.deathReason || "",
    segments: computeSegments(p),
  }));

  const leaderboard = [...playerSnapshots]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((p) => ({ id: p.id, name: p.name, score: p.score, alive: p.alive }));

  const payload = JSON.stringify({
    type: "snapshot",
    world: { width: WORLD_W, height: WORLD_H },
    players: playerSnapshots,
    foods,
    leaderboard,
    ts: Date.now(),
  });

  for (const ws of clients.keys()) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

function tick() {
  updatePlayers();
  checkCollisions();
  refillFood();
  broadcastState();
}

wss.on("connection", (ws) => {
  clients.set(ws, { playerId: null });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join") {
      const p = makePlayer(msg.name, msg.colorId);
      players.set(p.id, p);
      clients.get(ws).playerId = p.id;
      ws.send(JSON.stringify({ type: "joined", playerId: p.id }));
      return;
    }

    if (msg.type === "input") {
      const pid = clients.get(ws)?.playerId;
      if (!pid || !players.has(pid)) return;
      const p = players.get(pid);
      if (!p.alive) return;
      if (typeof msg.angle === "number") p.inputAngle = msg.angle;
      p.boost = !!msg.boost;
    }
  });

  ws.on("close", () => {
    const pid = clients.get(ws)?.playerId;
    if (pid && players.has(pid)) {
      players.delete(pid);
    }
    clients.delete(ws);
  });
});

refillFood();
setInterval(tick, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
