function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function pickPersonality(index) {
  const list = CONFIG.BOT_PERSONALITIES;
  return list[index % list.length];
}

class Pellet {
  constructor(x, y, value = 1) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.radius = value > 1 ? 10 : 5;
    this.phase = Math.random() * Math.PI * 2;
    this.color = value > 1 ? "#ffd166" : `hsl(${Math.floor(randRange(100, 180))}, 80%, 65%)`;
  }

  draw(ctx, camX, camY, time) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    const pulse = 0.85 + Math.sin(time * 4 + this.phase) * 0.15;
    const r = this.radius * pulse;

    ctx.save();
    ctx.globalAlpha = 0.45;
    const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.5);
    grd.addColorStop(0, this.color);
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

class Snake {
  constructor(x, y, name, colorSet, isPlayer = false) {
    this.x = x;
    this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.name = name;
    this.colors = colorSet;
    this.isPlayer = isPlayer;
    this.isBot = !isPlayer;
    this.alive = true;
    this.score = 0;
    this.length = CONFIG.START_LENGTH + (isPlayer ? 0 : randRange(-20, 40));
    this.boosting = false;
    this.path = [{ x, y }];
    this.targetAngle = this.angle;
    this.aiTimer = 0;
    this.aiTarget = null;
    this.personality = "wanderer";
    this.botIndex = 0;
    this.respawnAt = 0;
    this._dropped = false;
  }

  get segmentCount() {
    return Math.max(8, Math.floor(this.length / CONFIG.SEGMENT_SPACING));
  }

  get headRadius() {
    const bonus = this.isPlayer ? 2 : 0;
    return CONFIG.HEAD_RADIUS + Math.min(8, this.length / 80) + bonus;
  }

  getPoints() {
    const pts = [];
    const spacing = CONFIG.SEGMENT_SPACING;
    const path = this.path;

    pts.push({ x: this.x, y: this.y, r: this.headRadius });

    if (path.length < 2) return pts;

    let distAcc = 0;
    let pathIdx = path.length - 2;
    let px = this.x;
    let py = this.y;

    for (let s = 1; s < this.segmentCount && pathIdx >= 0; s++) {
      while (distAcc < spacing && pathIdx >= 0) {
        const nx = path[pathIdx].x;
        const ny = path[pathIdx].y;
        const seg = dist(px, py, nx, ny);
        if (seg <= 0.001) {
          pathIdx--;
          continue;
        }
        const need = spacing - distAcc;
        if (seg >= need) {
          const t = need / seg;
          px = px + (nx - px) * t;
          py = py + (ny - py) * t;
          distAcc = spacing;
        } else {
          distAcc += seg;
          px = nx;
          py = ny;
          pathIdx--;
        }
      }
      distAcc = 0;
      const t = s / this.segmentCount;
      const r = CONFIG.BODY_RADIUS * (1 - t * 0.25) + 2;
      pts.push({ x: px, y: py, r });
    }
    return pts;
  }

  steerToward(targetAngle, dt) {
    const diff = angleDiff(this.angle, targetAngle);
    const maxTurn = CONFIG.TURN_SPEED * dt * (this.personality === "nervous" ? 1.15 : 1);
    this.angle += clamp(diff, -maxTurn, maxTurn);
  }

  update(dt, worldW, worldH) {
    if (!this.alive) return;

    const speed = this.boosting ? CONFIG.BOOST_SPEED : CONFIG.BASE_SPEED;
    if (this.boosting && this.length > CONFIG.MIN_LENGTH) {
      this.length -= CONFIG.BOOST_LENGTH_DRAIN * dt;
    }

    this.x += Math.cos(this.angle) * speed * dt;
    this.y += Math.sin(this.angle) * speed * dt;

    const m = CONFIG.WALL_MARGIN;
    if (this.x < m || this.x > worldW - m || this.y < m || this.y > worldH - m) {
      if (this.isBot) {
        this.targetAngle = Math.atan2(worldH / 2 - this.y, worldW / 2 - this.x);
        this.x = clamp(this.x, m + 5, worldW - m - 5);
        this.y = clamp(this.y, m + 5, worldH - m - 5);
      } else {
        this.die("Đã chạm biên bản đồ!");
        return;
      }
    }

    this.path.push({ x: this.x, y: this.y });

    const maxPath = this.segmentCount * 3 + 40;
    while (this.path.length > maxPath) {
      this.path.shift();
    }

    while (this.pathLength() > this.length && this.path.length > 2) {
      this.path.shift();
    }
  }

  pathLength() {
    let len = 0;
    for (let i = 1; i < this.path.length; i++) {
      len += dist(this.path[i - 1].x, this.path[i - 1].y, this.path[i].x, this.path[i].y);
    }
    return len;
  }

  grow(amount) {
    this.length += amount * 3.5;
    this.score += amount;
  }

  die(reason) {
    this.alive = false;
    this.deathReason = reason || "Rắn đã gục.";
  }

  findNearestPellet(pellets, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of pellets) {
      const d = dist(this.x, this.y, p.x, p.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  updateAI(dt, pellets, snakes) {
    if (!this.alive) return;

    this.aiTimer -= dt;
    const personality = this.personality || "wanderer";

    if (this.aiTimer <= 0) {
      this.aiTimer = randRange(0.25, personality === "wanderer" ? 1.4 : 0.9);

      const food = this.findNearestPellet(pellets, personality === "foodie" ? 550 : 380);
      const player = snakes.find((s) => s.isPlayer && s.alive);

      if (personality === "hunter" && player && player !== this) {
        const d = dist(this.x, this.y, player.x, player.y);
        if (d < 320 && this.length >= player.length * 0.85) {
          this.aiTarget = { x: player.x, y: player.y };
        } else if (food) {
          this.aiTarget = { x: food.x, y: food.y };
        }
      } else if (personality === "foodie" && food) {
        this.aiTarget = { x: food.x, y: food.y };
      } else if (food && Math.random() < (personality === "wanderer" ? 0.45 : 0.7)) {
        this.aiTarget = { x: food.x, y: food.y };
      } else {
        this.aiTarget = {
          x: randRange(200, CONFIG.WORLD_W - 200),
          y: randRange(200, CONFIG.WORLD_H - 200),
        };
      }

      const boostChance = personality === "foodie" ? 0.14 : personality === "hunter" ? 0.12 : 0.07;
      this.boosting = Math.random() < boostChance && this.length > CONFIG.MIN_LENGTH + 35;
    }

    if (this.aiTarget) {
      this.targetAngle = Math.atan2(this.aiTarget.y - this.y, this.aiTarget.x - this.x);
    }

    for (const other of snakes) {
      if (other === this || !other.alive) continue;
      const pts = other.getPoints();
      const dangerDist = personality === "nervous" ? 120 : 75;
      for (let i = 4; i < pts.length; i += 2) {
        const d = dist(this.x, this.y, pts[i].x, pts[i].y);
        if (d < dangerDist) {
          const avoid = Math.atan2(this.y - pts[i].y, this.x - pts[i].x);
          this.targetAngle = avoid;
          if (personality === "nervous" || d < 50) {
            this.boosting = this.length > CONFIG.MIN_LENGTH + 25 && Math.random() < 0.35;
          }
          break;
        }
      }
    }

    this.steerToward(this.targetAngle, dt);
  }

  isOnScreen(camX, camY, viewW, viewH, margin = 80) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    return sx > -margin && sy > -margin && sx < viewW + margin && sy < viewH + margin;
  }

  draw(ctx, camX, camY) {
    if (!this.alive) return;

    const pts = this.getPoints();
    if (pts.length === 0) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      const sx = p.x - camX;
      const sy = p.y - camY;
      const r = p.r;
      const isHead = i === 0;
      const fillColor = isHead ? this.colors.head : this.colors.body;

      if (isHead && this.boosting) {
        ctx.shadowColor = this.colors.glow;
        ctx.shadowBlur = 16;
      }

      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (this.colors.stroke) {
        ctx.strokeStyle = this.colors.stroke;
        ctx.lineWidth = isHead ? 2.5 : 1.5;
        ctx.globalAlpha = isHead ? 0.9 : 0.55;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (isHead) {
        const ex = sx + Math.cos(this.angle) * r * 0.45;
        const ey = sy + Math.sin(this.angle) * r * 0.45;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(ex - 4, ey - 3, 2.5, 0, Math.PI * 2);
        ctx.arc(ex + 4, ey - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1a2030";
        ctx.beginPath();
        ctx.arc(ex - 4, ey - 3, 1.2, 0, Math.PI * 2);
        ctx.arc(ex + 4, ey - 3, 1.2, 0, Math.PI * 2);
        ctx.fill();

        if (this.isPlayer) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(sx, sy, r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    const hx = this.x - camX;
    const hy = this.y - camY - this.headRadius - 10;
    const showName = this.isPlayer || pts.length > 12;
    if (showName) {
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillText(this.name, hx + 1, hy + 1);
      ctx.fillStyle = this.isPlayer ? "#ffd166" : "#e8edf5";
      ctx.fillText(this.name, hx, hy);
    }
  }

  checkCollisionWith(snakes) {
    if (!this.alive) return;
    const head = { x: this.x, y: this.y };
    const hr = this.headRadius * 0.75;

    for (const other of snakes) {
      if (!other.alive) continue;
      const pts = other.getPoints();
      const startIdx = other === this ? 14 : 5;
      for (let i = startIdx; i < pts.length; i++) {
        const d = dist(head.x, head.y, pts[i].x, pts[i].y);
        if (d < hr + pts[i].r * 0.85) {
          if (other === this) return;
          this.die("Va vào thân rắn " + other.name + "!");
          return;
        }
      }
    }
  }
}

function spawnPellets(count, worldW, worldH, value = 1) {
  const list = [];
  const margin = 80;
  for (let i = 0; i < count; i++) {
    list.push(
      new Pellet(
        randRange(margin, worldW - margin),
        randRange(margin, worldH - margin),
        value
      )
    );
  }
  return list;
}

function dropPelletsFromSnake(snake, pellets) {
  const pts = snake.getPoints();
  const step = Math.max(2, Math.floor(pts.length / 20));
  const maxDrop = 18;
  let dropped = 0;
  for (let i = 0; i < pts.length && dropped < maxDrop; i += step) {
    if (Math.random() < 0.55) {
      pellets.push(new Pellet(pts[i].x + randRange(-8, 8), pts[i].y + randRange(-8, 8), 1));
      dropped++;
    }
  }
}

function randomSpawnFar(avoidSnakes, minDist) {
  const m = 200;
  for (let t = 0; t < 40; t++) {
    const p = {
      x: randRange(m, CONFIG.WORLD_W - m),
      y: randRange(m, CONFIG.WORLD_H - m),
    };
    let ok = true;
    for (const s of avoidSnakes) {
      if (!s || !s.alive) continue;
      if (dist(p.x, p.y, s.x, s.y) < minDist) {
        ok = false;
        break;
      }
    }
    if (ok) return p;
  }
  return {
    x: randRange(m, CONFIG.WORLD_W - m),
    y: randRange(m, CONFIG.WORLD_H - m),
  };
}
