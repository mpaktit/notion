/**
 * Pure game simulation (no DOM, no canvas). Rendering and audio react to the
 * `events` queue. Deterministic for a given seed + input sequence.
 */
import { Rng } from '../core/rng.js';
import { MODES, SECTOR_BY_ID } from '../data/sectors.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { POWERS, POWER_IDS } from '../data/powers.js';
import { UPGRADE_BY_ID } from '../data/progression.js';

export const GRID = 24;
const COUNT_STEP = 600;
const DIRS4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

export class Game {
  constructor({ mode = 'endless', sector = 'orbit', species = 'terran', upgrades = {}, seed, demo = false, skipCountdown = false } = {}) {
    this.mode = mode; this.modeDef = MODES[mode] || MODES.endless;
    this.sector = sector; this.sectorDef = SECTOR_BY_ID[sector] || SECTOR_BY_ID.orbit;
    this.speciesId = species; this.sp = SPECIES_BY_ID[species] || SPECIES_BY_ID.terran;
    this.up = { duration: 0, yield: 0, combo: 0, luck: 0, cooldown: 0, ...upgrades };
    this.demo = demo;
    this.seed = seed ?? ((Math.random() * 2 ** 32) >>> 0);
    this.rng = new Rng(this.seed);
    this.hazard = this.modeDef.hazards ? this.sectorDef.hazard : 'none';
    this.N = GRID;
    this.events = [];
    this.reset(skipCountdown || demo);
  }

  reset(skipCountdown) {
    const N = this.N, y0 = this.hazard === 'blackhole' ? 4 : N >> 1;
    this.snake = []; for (let i = 0; i < 4; i++) this.snake.push({ x: 6 - i, y: y0 });
    this.prev = this.snake.map((p) => ({ ...p }));
    this.dir = { x: 1, y: 0 }; this.queue = [];
    this.items = []; this.obstacles = new Map(); this.asteroids = []; this.hole = new Set();
    this.effects = {}; this.shield = this.sp.passive.startShield ? 1 : 0; this.shieldT = this.shield ? Infinity : 0;
    this.abilityCd = 0; this.abilityMax = Math.round(this.sp.ability.cd * 1000 * (1 - this.up.cooldown * UPGRADE_BY_ID.cooldown.per));
    this.score = 0; this.food = 0; this.golds = 0; this.powerups = 0; this.abilities = 0;
    this.crystalsPicked = 0; this.stardustPicked = 0; this.combo = 0; this.maxCombo = 0; this.lastEat = -1e9;
    this.level = 1; this.grow = 0; this.time = 0; this.acc = 0; this.ticks = 0; this.revives = 0;
    this.timeLeft = this.modeDef.timeLimit || 0;
    this.stormT = 0; this.nextStorm = 20000; this.nextPulse = 11000; this.fogRadius = 7;
    this.state = skipCountdown ? 'playing' : 'countdown'; this.count = 3; this.countT = 0;
    this.reason = '';
    this.setupHazards();
    this.spawn('apple');
    if (this.mode === 'blitz') this.spawn('apple');
  }

  /* ---------- helpers ---------- */
  key(x, y) { return x + y * this.N; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.N && y < this.N; }
  get ghost() { return (this.effects.ghost || 0) > 0 || (this.effects.phase || 0) > 0 || (this.effects.invuln || 0) > 0; }
  get wraps() { return this.modeDef.wrap || this.ghost; }
  get comboWindow() { return 3000 + (this.sp.passive.comboWindow || 0) + this.up.combo * UPGRADE_BY_ID.combo.per; }
  get durMult() { return 1 + this.up.duration * UPGRADE_BY_ID.duration.per; }
  hazardAt(x, y) {
    const k = this.key(x, y);
    return this.obstacles.has(k) || this.hole.has(k) || this.asteroids.some((a) => a.x === x && a.y === y);
  }
  snakeAt(x, y, excludeTail = false) {
    const lim = excludeTail ? this.snake.length - 1 : this.snake.length;
    for (let i = 0; i < lim; i++) if (this.snake[i].x === x && this.snake[i].y === y) return i;
    return -1;
  }
  blocked(x, y) { return this.hazardAt(x, y) || this.snakeAt(x, y) >= 0 || this.items.some((i) => i.x === x && i.y === y); }
  emptyCell(minDist = 0, avoidEdge = false) {
    const h = this.snake[0];
    for (let t = 0; t < 600; t++) {
      const x = this.rng.int(this.N), y = this.rng.int(this.N);
      if (avoidEdge && (x === 0 || y === 0 || x === this.N - 1 || y === this.N - 1)) continue;
      if (this.blocked(x, y)) continue;
      if (minDist && Math.abs(x - h.x) + Math.abs(y - h.y) < minDist) continue;
      return { x, y };
    }
    return null;
  }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drain() { const e = this.events; this.events = []; return e; }

  interval() {
    if (this.demo) return 85;
    let iv = Math.max(58, 128 - (this.sp.stats.speed - 3) * 8 - (this.level - 1) * 6);
    if ((this.effects.dash || 0) > 0) iv /= 1.6;
    if ((this.effects.slow || 0) > 0 || (this.effects.warp || 0) > 0) iv *= 1.6;
    return iv;
  }

  /* ---------- hazards ---------- */
  setupHazards() {
    if (this.hazard === 'rocks') for (let i = 0; i < 5; i++) this.addRockCluster(false);
    if (this.hazard === 'asteroids') for (let i = 0; i < 3; i++) this.addAsteroid();
    if (this.hazard === 'blackhole') {
      const c = this.N / 2 - 1;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.hole.add(this.key(c + dx, c + dy));
    }
  }
  addRockCluster(temp, expire = 0) {
    const h = this.snake[0];
    for (let t = 0; t < 80; t++) {
      const len = temp ? 1 : 2 + this.rng.int(3), hor = this.rng.chance(0.5);
      const x = 1 + this.rng.int(this.N - 2 - (hor ? len : 0)), y = 1 + this.rng.int(this.N - 2 - (hor ? 0 : len));
      const cells = [];
      let ok = true;
      for (let i = 0; i < len; i++) {
        const cx = x + (hor ? i : 0), cy = y + (hor ? 0 : i);
        const ahead = Math.abs(cx - h.x) + Math.abs(cy - h.y) < 6 || (this.dir.x && cy === h.y && Math.sign(cx - h.x) === this.dir.x) || (this.dir.y && cx === h.x && Math.sign(cy - h.y) === this.dir.y);
        if (this.blocked(cx, cy) || ahead) { ok = false; break; }
        cells.push(this.key(cx, cy));
      }
      if (ok) { cells.forEach((k) => { this.obstacles.set(k, { temp, expire }); this.emit('hazardSpawn', { x: k % this.N, y: (k / this.N) | 0 }); }); return true; }
    }
    return false;
  }
  addAsteroid() {
    const h = this.snake[0];
    for (let t = 0; t < 60; t++) {
      const d = this.rng.pick(DIRS4);
      const x = d.x ? (d.x > 0 ? 0 : this.N - 1) : this.rng.int(this.N);
      const y = d.y ? (d.y > 0 ? 0 : this.N - 1) : this.rng.int(this.N);
      if (this.blocked(x, y) || Math.abs(x - h.x) + Math.abs(y - h.y) < 7) continue;
      this.asteroids.push({ x, y, dx: d.x, dy: d.y, px: x, py: y, rot: this.rng.next() * 6.28, size: 0.8 + this.rng.next() * 0.35, seed: this.rng.int(1e6) });
      return true;
    }
    return false;
  }
  moveAsteroids() {
    const h = this.snake[0];
    for (const a of this.asteroids) {
      a.px = a.x; a.py = a.y;
      let nx = a.x + a.dx, ny = a.y + a.dy;
      if (!this.inBounds(nx, ny)) { nx = (nx + this.N) % this.N; ny = (ny + this.N) % this.N; a.px = nx; a.py = ny; }
      if (nx === h.x && ny === h.y) {
        if (!this.ghost && !this.consumeShield()) { a.x = nx; a.y = ny; return this.die('Struck by an asteroid'); }
        this.destroyAsteroid(a); continue;
      }
      if (this.snakeAt(nx, ny) > 0 || this.obstacles.has(this.key(nx, ny)) || this.hole.has(this.key(nx, ny))) { a.dx = -a.dx; a.dy = -a.dy; a.px = a.x; a.py = a.y; continue; }
      const it = this.items.find((i) => i.x === nx && i.y === ny);
      if (it) { a.dx = -a.dx; a.dy = -a.dy; a.px = a.x; a.py = a.y; continue; }
      a.x = nx; a.y = ny;
    }
    this.asteroids = this.asteroids.filter((a) => !a.dead);
  }
  destroyAsteroid(a) { a.dead = true; this.emit('hazardDestroyed', { x: a.x, y: a.y, kind: 'asteroid' }); }
  gravityPulse() {
    const c = this.N / 2 - 0.5;
    for (const it of this.items) {
      const dx = c - it.x, dy = c - it.y;
      const step = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
      const tx = it.x + step.x, ty = it.y + step.y;
      if (!this.blocked(tx, ty)) { it.x = tx; it.y = ty; }
    }
    this.emit('pulse');
  }

  /* ---------- items ---------- */
  spawn(type, opts = {}) {
    const c = this.emptyCell(type === 'apple' ? 2 : 4, type !== 'apple');
    if (!c) return null;
    const ttl = { apple: Infinity, gold: 7000, dust: 8000, crystal: 6500 }[type] ?? 9000;
    const it = { type, x: c.x, y: c.y, vx: c.x, vy: c.y, born: this.time, ttl, ...opts };
    this.items.push(it);
    this.emit('spawn', { item: it });
    return it;
  }
  rollDrops() {
    if (!this.modeDef.powers) return;
    const luck = this.sp.stats.luck, has = (fn) => this.items.some(fn);
    const goldChance = 0.1 + (this.hazard === 'blackhole' ? 0.08 : 0);
    if (!has((i) => i.type === 'gold') && this.rng.chance(goldChance)) this.spawn('gold');
    const powerChance = 0.2 + luck * 0.015 + this.up.luck * UPGRADE_BY_ID.luck.per;
    if (!has((i) => POWERS[i.type]) && this.rng.chance(powerChance)) this.spawn(this.rng.pick(POWER_IDS));
    if (!has((i) => i.type === 'dust') && this.rng.chance(0.14 + luck * 0.01)) this.spawn('dust', { value: Math.round(12 * this.sectorDef.mult) });
    if (this.crystalsPicked < 2 && !has((i) => i.type === 'crystal') && this.rng.chance(0.004 + luck * 0.0015)) {
      this.spawn('crystal'); this.emit('crystalSpawn');
    }
  }

  /* ---------- input ---------- */
  queueDir(x, y) {
    if (this.demo || !(this.state === 'playing' || this.state === 'countdown')) return false;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if ((x === last.x && y === last.y) || (x === -last.x && y === -last.y)) return false;
    const cap = 2 + Math.floor(this.sp.stats.control / 2);
    if (this.queue.length >= cap) return false;
    this.queue.push({ x, y });
    return true;
  }
  useAbility() {
    if (this.demo || this.state !== 'playing' || this.abilityCd > 0) return false;
    const id = this.sp.ability.id, d = this.durMult;
    const h = this.snake[0];
    switch (id) {
      case 'dash': this.effects.dash = 3000 * d; break;
      case 'burrow': this.effects.ghost = Math.max(this.effects.ghost || 0, 3500 * d); break;
      case 'pulse': this.effects.magnet = Math.max(this.effects.magnet || 0, 7000 * d); break;
      case 'shield': this.shield = 1; this.shieldT = 12000 * d; break;
      case 'flare': {
        for (const [k, o] of [...this.obstacles]) { void o; const x = k % this.N, y = (k / this.N) | 0; if (Math.max(Math.abs(x - h.x), Math.abs(y - h.y)) <= 5) { this.obstacles.delete(k); this.emit('hazardDestroyed', { x, y, kind: 'rock' }); } }
        for (const a of this.asteroids) if (Math.max(Math.abs(a.x - h.x), Math.abs(a.y - h.y)) <= 5) this.destroyAsteroid(a);
        this.asteroids = this.asteroids.filter((a) => !a.dead);
        break;
      }
      case 'phase': this.effects.phase = 4500 * d; break;
      case 'warp': this.effects.warp = 6000 * d; break;
      case 'nova': {
        const food = this.items.filter((i) => i.type === 'apple' || i.type === 'gold');
        food.forEach((f) => { this.items.splice(this.items.indexOf(f), 1); this.eat(f); });
        break;
      }
    }
    this.abilityCd = this.abilityMax;
    this.abilities++;
    this.emit('ability', { id, x: h.x, y: h.y });
    return true;
  }

  /* ---------- core loop ---------- */
  update(dt) {
    if (this.state === 'countdown') {
      this.countT += dt;
      if (this.countT >= COUNT_STEP) {
        this.countT = 0; this.count--;
        if (this.count <= 0) { this.state = 'playing'; this.emit('go'); } else this.emit('count', { n: this.count });
      }
      return;
    }
    if (this.state !== 'playing') return;
    this.time += dt;
    for (const k in this.effects) this.effects[k] = Math.max(0, this.effects[k] - dt);
    if (this.abilityCd > 0) this.abilityCd = Math.max(0, this.abilityCd - dt);
    if (this.shield && this.shieldT !== Infinity) { this.shieldT -= dt; if (this.shieldT <= 0) { this.shield = 0; this.emit('shieldExpire'); } }
    // item expiry
    for (const it of this.items) if (it.ttl !== Infinity && this.time - it.born > it.ttl) { it.dead = true; this.emit('expire', { item: it }); }
    this.items = this.items.filter((i) => !i.dead);
    // temp rocks
    for (const [k, o] of this.obstacles) if (o.temp && this.time > o.expire) { this.obstacles.delete(k); this.emit('hazardDestroyed', { x: k % this.N, y: (k / this.N) | 0, kind: 'sand' }); }
    if (this.combo > 0 && this.time - this.lastEat > this.comboWindow) { this.combo = 0; this.emit('comboLost'); }
    // sector events
    if (this.hazard === 'rocks') {
      if (this.stormT > 0) this.stormT -= dt;
      if (this.time > this.nextStorm) {
        this.nextStorm = this.time + 24000; this.stormT = 6000; this.emit('storm');
        for (let i = 0; i < 3 + Math.floor(this.level / 3); i++) this.addRockCluster(true, this.time + 9000);
      }
    }
    if (this.hazard === 'blackhole' && this.time > this.nextPulse) {
      this.nextPulse = this.time + Math.max(5000, 11000 - this.level * 450); this.gravityPulse();
    }
    if (this.mode === 'blitz') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.state = 'over'; this.reason = "Time's up"; this.emit('timeUp'); return; }
    }
    this.acc += dt;
    const iv = this.interval();
    if (this.acc >= iv) { this.acc -= iv; if (this.acc > iv) this.acc = 0; this.tick(); }
  }

  consumeShield() {
    if (!this.shield) return false;
    this.shield = 0; this.shieldT = 0; this.effects.invuln = 1500;
    this.emit('shieldBreak', { x: this.snake[0].x, y: this.snake[0].y });
    return true;
  }

  tick() {
    this.prev = this.snake.map((p) => ({ ...p }));
    if (this.demo) this.dir = this.aiDir();
    else while (this.queue.length) { const d = this.queue.shift(); if (!(d.x === -this.dir.x && d.y === -this.dir.y)) { this.dir = d; break; } }
    const h = this.snake[0];
    let nx = h.x + this.dir.x, ny = h.y + this.dir.y;
    if (!this.inBounds(nx, ny)) {
      if (!this.wraps && !this.consumeShield()) return this.die('Hit the wall');
      nx = (nx + this.N) % this.N; ny = (ny + this.N) % this.N;
    }
    const k = this.key(nx, ny);
    const asteroid = this.asteroids.find((a) => a.x === nx && a.y === ny);
    if ((this.obstacles.has(k) || this.hole.has(k) || asteroid) && !this.ghost) {
      if (!this.consumeShield()) return this.die(this.hole.has(k) ? 'Swallowed by the black hole' : asteroid ? 'Struck by an asteroid' : 'Crashed into rocks');
      if (this.obstacles.has(k)) { this.obstacles.delete(k); this.emit('hazardDestroyed', { x: nx, y: ny, kind: 'rock' }); }
      if (asteroid) { this.destroyAsteroid(asteroid); this.asteroids = this.asteroids.filter((a) => !a.dead); }
    }
    const hit = this.snakeAt(nx, ny, this.grow === 0);
    if (hit >= 0 && !this.ghost) {
      if (this.modeDef.immortal) {
        const lost = this.snake.slice(hit);
        this.snake = this.snake.slice(0, hit); this.prev = this.prev.slice(0, hit); this.grow = 0; this.combo = 0;
        this.emit('cut', { cells: lost, x: nx, y: ny });
      } else if (!this.consumeShield()) return this.die('Bit your own tail');
    }
    this.snake.unshift({ x: nx, y: ny });
    if (this.grow > 0) this.grow--; else this.snake.pop();
    this.ticks++;
    const ii = this.items.findIndex((i) => i.x === nx && i.y === ny);
    if (ii >= 0) this.eat(this.items.splice(ii, 1)[0]);
    if (this.asteroids.length && this.ticks % 2 === 0) this.moveAsteroids();
    if (this.state !== 'playing') return;
    if ((this.effects.magnet || 0) > 0) this.magnet();
  }

  magnet() {
    const h = this.snake[0], range = 7 + (this.sp.passive.magnetRange || 0);
    for (const it of [...this.items]) {
      if (it.type === 'apple' || it.type === 'gold' || it.type === 'dust' || it.type === 'crystal') {
        const dx = h.x - it.x, dy = h.y - it.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > range) continue;
        const step = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
        const tx = it.x + step.x, ty = it.y + step.y;
        if (tx === h.x && ty === h.y) { this.items.splice(this.items.indexOf(it), 1); this.eat(it); continue; }
        if (!this.blocked(tx, ty)) { it.x = tx; it.y = ty; }
      }
    }
  }

  eat(it) {
    const scoreMult = (1 + (this.sp.passive.scoreMult || 0)) * ((this.effects.double || 0) > 0 ? 2 : 1) * ((this.effects.dash || 0) > 0 ? 1.5 : 1);
    if (it.type === 'apple' || it.type === 'gold') {
      this.combo = this.time - this.lastEat < this.comboWindow ? this.combo + 1 : 1;
      this.lastEat = this.time; this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = Math.round((it.type === 'gold' ? 50 : 10) * Math.min(this.combo, 5) * scoreMult);
      this.score += pts; this.grow += it.type === 'gold' ? 3 : 1;
      if (this.mode === 'blitz') this.timeLeft += it.type === 'gold' ? 4000 : 1500;
      if (it.type === 'gold') this.golds++;
      this.emit('eat', { item: it, pts, combo: this.combo, mult: Math.round(Math.min(this.combo, 5) * scoreMult * 10) / 10 });
      if (it.type === 'apple') {
        this.food++;
        if (!this.items.some((i) => i.type === 'apple') || (this.mode === 'blitz' && this.items.filter((i) => i.type === 'apple').length < 2)) this.spawn('apple');
        this.rollDrops();
        if (this.food % 5 === 0) this.levelUp();
      } else this.food++;
      return;
    }
    if (it.type === 'dust') { this.stardustPicked += it.value || 12; this.emit('pickup', { item: it, value: it.value || 12 }); return; }
    if (it.type === 'crystal') { this.crystalsPicked++; this.emit('crystal', { item: it }); return; }
    const P = POWERS[it.type];
    if (!P) return;
    this.powerups++;
    if (it.type === 'shrink') {
      const n = Math.max(0, Math.min(4, this.snake.length - 3));
      const cut = this.snake.splice(this.snake.length - n, n); this.prev.splice(this.prev.length - n, n);
      this.score += 15;
      this.emit('power', { item: it, id: it.type, cut });
    } else {
      this.effects[it.type] = Math.max(this.effects[it.type] || 0, P.dur * this.durMult);
      this.emit('power', { item: it, id: it.type });
    }
  }

  levelUp() {
    this.level++;
    if (this.hazard === 'rocks' && this.level % 2 === 0 && this.obstacles.size < 70) this.addRockCluster(false);
    if (this.hazard === 'asteroids' && this.asteroids.length < 3 + this.level && this.asteroids.length < 14) this.addAsteroid();
    if (this.hazard === 'fog') this.fogRadius = Math.max(3.5, 7 - this.level * 0.3);
    this.emit('level', { level: this.level });
  }

  die(reason) {
    this.state = 'dead'; this.reason = reason;
    this.emit('die', { reason, cells: this.snake.map((p) => ({ ...p })) });
  }

  canRevive() { return this.state === 'dead' && this.revives < 2 && !this.modeDef.immortal; }
  revive() {
    if (!this.canRevive()) return false;
    this.revives++;
    const h = this.snake[0];
    this.asteroids = this.asteroids.filter((a) => Math.abs(a.x - h.x) + Math.abs(a.y - h.y) > 3);
    this.effects.invuln = 3000; this.queue = [];
    this.state = 'countdown'; this.count = 3; this.countT = 0;
    this.emit('revive');
    return true;
  }

  summary() {
    return {
      mode: this.mode, sector: this.sector, species: this.speciesId, score: this.score, food: this.food,
      golds: this.golds, powerups: this.powerups, abilities: this.abilities, maxCombo: this.maxCombo,
      length: this.snake.length, timeMs: Math.round(this.time), timeSec: Math.floor(this.time / 1000),
      level: this.level, crystalsPicked: this.crystalsPicked, stardustPicked: this.stardustPicked, reason: this.reason
    };
  }

  /* ---------- demo AI (attract mode) ---------- */
  flood(sx, sy, limit) {
    const seen = new Set(this.snake.slice(0, -1).map((p) => this.key(p.x, p.y)));
    this.obstacles.forEach((_, k) => seen.add(k)); this.hole.forEach((k) => seen.add(k));
    const st = [[sx, sy]]; let n = 0; seen.add(this.key(sx, sy));
    while (st.length && n < limit) {
      const [x, y] = st.pop(); n++;
      for (const d of DIRS4) {
        const nx = x + d.x, ny = y + d.y, k = this.key(nx, ny);
        if (!this.inBounds(nx, ny) || seen.has(k)) continue;
        seen.add(k); st.push([nx, ny]);
      }
    }
    return n;
  }
  aiDir() {
    const h = this.snake[0];
    const target = this.items.find((i) => i.type === 'gold') || this.items.find((i) => i.type === 'apple');
    let best = this.dir, bs = -Infinity;
    for (const d of DIRS4) {
      if (d.x === -this.dir.x && d.y === -this.dir.y) continue;
      const nx = h.x + d.x, ny = h.y + d.y;
      if (!this.inBounds(nx, ny) || this.hazardAt(nx, ny) || this.snakeAt(nx, ny, true) >= 0) continue;
      const space = this.flood(nx, ny, this.snake.length * 2);
      let sc = target ? -(Math.abs(target.x - nx) + Math.abs(target.y - ny)) : 0;
      if (space < this.snake.length + 2) sc -= 1000 - space;
      sc += this.rng.next() * 0.5;
      if (sc > bs) { bs = sc; best = d; }
    }
    return best;
  }
}
