/**
 * Canvas renderer. Reads Game state, never mutates gameplay.
 * Handles sector backgrounds, skins, trails, crowns, effects and juice.
 */
import { Particles } from './particles.js';
import { POWERS } from '../data/powers.js';
import { Rng } from '../core/rng.js';

const TAU = Math.PI * 2;
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Apple Color Emoji","Noto Color Emoji",sans-serif';

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.fx = new Particles(); this.floats = [];
    this.shake = 0; this.flash = 0; this.flashColor = '255,255,255';
    this.settings = { shake: true, reducedMotion: false };
    this.look = { skin: null, trail: null, crown: 'none', fx: 'standard', speciesColors: ['#3CF0C5', '#2A7BFF'] };
    this.bg = null; this.bgKey = ''; this.fogCv = document.createElement('canvas');
    this.size = 480; this.cell = 20; this.dpr = 1; this.trailT = 0;
  }
  resize(px, N) {
    this.N = N; this.cell = Math.max(10, Math.floor(px / N)); this.size = this.cell * N;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = this.size * this.dpr; this.cv.height = this.size * this.dpr;
    this.cv.style.width = this.cv.style.height = this.size + 'px';
    this.fogCv.width = this.cv.width; this.fogCv.height = this.cv.height;
    this.bgKey = '';
  }
  setLook(look) { Object.assign(this.look, look); }
  setSettings(s) { this.settings = { ...this.settings, ...s }; this.fx.scale = s.reducedMotion ? 0.4 : 1; }
  center(x, y) { return { x: (x + 0.5) * this.cell, y: (y + 0.5) * this.cell }; }

  /* ---------- palette helpers ---------- */
  skinColors() {
    const s = this.look.skin;
    if (!s || s.pattern === 'species') return this.look.speciesColors[0] === 'rainbow' ? ['#FF5C7A', '#FFC93C', '#3CF0C5', '#5EC8FF', '#B49CFF'] : this.look.speciesColors;
    if (s.pattern === 'rainbow') return ['#FF5C7A', '#FFC93C', '#3CF0C5', '#5EC8FF', '#B49CFF'];
    if (s.pattern === 'void') return ['#FFFFFF', '#B49CFF', '#000000'];
    return s.colors;
  }
  segColor(i, len, t) {
    const s = this.look.skin;
    const pattern = !s || s.pattern === 'species' ? (this.look.speciesColors[0] === 'rainbow' ? 'rainbow' : 'gradient') : s.pattern;
    const [a, b] = !s || s.pattern === 'species' ? this.look.speciesColors : s.colors;
    const u = len > 1 ? i / (len - 1) : 0;
    switch (pattern) {
      case 'rainbow': return `hsl(${((i * 14 - t * 0.12) % 360 + 360) % 360},90%,62%)`;
      case 'stripes': return Math.floor(i / 2) % 2 ? b : a;
      case 'pulse': return mix(a, b, (Math.sin(i * 0.45 - t * 0.006) + 1) / 2);
      case 'fire': return mix(a, b, Math.min(1, u * 0.8 + (Math.sin(i * 1.7 + t * 0.02) + 1) * 0.12));
      case 'metal': return mix(a, b, (Math.sin(i * 0.6 - t * 0.004) + 1) / 2 * 0.8 + u * 0.2);
      case 'galaxy': return mix('#3B2A80', '#0A0620', u);
      case 'void': return '#050507';
      case 'circuit': return mix('#0E3A24', '#06180F', u);
      default: return mix(a, b, u);
    }
  }

  /* ---------- events -> juice ---------- */
  handle(events, game) {
    const c = this.cell;
    for (const e of events) {
      const at = (o) => this.center(o.x, o.y);
      switch (e.type) {
        case 'eat': {
          const p = at(e.item), gold = e.item.type === 'gold';
          this.fx.burst(p.x, p.y, gold ? ['#FFC93C', '#FFF3B0', '#FF9F1C'] : ['#FF5C7A', '#FFB3C1', ...this.skinColors()], gold ? 40 : 16, gold ? 4 : 3);
          this.fx.ring(p.x, p.y, gold ? '#FFC93C' : '#FF8FA3', c * 0.3, c * 0.06);
          this.float(p.x, p.y, `+${e.pts}`, gold ? '#FFC93C' : '#FFFFFF', e.combo >= 3 ? 1.25 : 1);
          if (gold) this.kick(5);
          break;
        }
        case 'pickup': { const p = at(e.item); this.fx.burst(p.x, p.y, ['#FFC93C', '#FFF3B0'], 22, 3); this.float(p.x, p.y, `+${e.value} ✨`, '#FFD86B'); break; }
        case 'crystal': { const p = at(e.item); this.fx.burst(p.x, p.y, ['#C77DFF', '#FFFFFF', '#7B6CFF'], 60, 5); this.fx.ring(p.x, p.y, '#C77DFF', c * 0.4, c * 0.12, 3); this.float(p.x, p.y, '+1 ◆ VOID CRYSTAL', '#E2B8FF', 1.2); this.flashOn(0.35, '199,125,255'); this.kick(8); break; }
        case 'power': {
          const p = at(e.item), P = POWERS[e.id];
          this.fx.burst(p.x, p.y, [P.color, '#FFFFFF'], 28, 3.5); this.fx.ring(p.x, p.y, P.color, c * 0.3, c * 0.1, 3);
          this.float(p.x, p.y, P.name.toUpperCase() + '!', P.color, 1.1); this.flashOn(0.2);
          (e.cut || []).forEach((s) => { const q = at(s); this.fx.burst(q.x, q.y, this.skinColors(), 6, 2); });
          break;
        }
        case 'spawn': { const p = at(e.item); this.fx.ring(p.x, p.y, e.item.type === 'crystal' ? '#C77DFF' : 'rgba(255,255,255,.6)', c * 0.2, c * 0.05); break; }
        case 'expire': { const p = at(e.item); this.fx.burst(p.x, p.y, ['#666', '#999'], 8, 1.5); break; }
        case 'hazardSpawn': { const p = at(e); this.fx.burst(p.x, p.y, ['#FF5C7A', '#7B2B3B'], 5, 1.4); break; }
        case 'hazardDestroyed': { const p = at(e); this.fx.burst(p.x, p.y, e.kind === 'asteroid' ? ['#C8C2B4', '#7A7266', '#FFB547'] : ['#FF8A4C', '#FFE45C', '#8A3A1E'], 18, 3); break; }
        case 'cut': { e.cells.forEach((s) => { const q = at(s); this.fx.burst(q.x, q.y, this.skinColors(), 5, 2); }); const p = at(e); this.float(p.x, p.y, `-${e.cells.length}`, '#FF5C7A'); this.kick(6); break; }
        case 'shieldBreak': { const p = at(e); this.fx.burst(p.x, p.y, ['#E0F7FF', '#7FD4FF', '#FFFFFF'], 40, 5, { shape: 's' }); this.fx.ring(p.x, p.y, '#7FD4FF', c * 0.5, c * 0.15, 3); this.float(p.x, p.y, 'SHIELD BROKEN', '#7FD4FF'); this.kick(10); this.flashOn(0.3, '127,212,255'); break; }
        case 'ability': { const p = at(e); this.fx.ring(p.x, p.y, '#FFFFFF', c * 0.5, c * 0.2, 3); this.fx.burst(p.x, p.y, this.skinColors(), 30, 4); if (e.id === 'flare') { this.fx.ring(p.x, p.y, '#FFB547', c, c * 0.35, 6); this.flashOn(0.4, '255,181,71'); this.kick(8); } if (e.id === 'nova') { this.flashOn(0.5); this.kick(10); } break; }
        case 'level': this.fx.ring(this.size / 2, this.size / 2, 'rgba(180,156,255,.6)', this.size * 0.1, this.size * 0.02, 3); break;
        case 'storm': this.kick(4); break;
        case 'pulse': this.fx.ring(this.size / 2, this.size / 2, 'rgba(255,201,60,.5)', this.size * 0.45, -this.size * 0.012, 4); this.kick(3); break;
        case 'die': this.death(e.cells, game); break;
        case 'revive': { const h = game.snake[0], p = at(h); this.fx.ring(p.x, p.y, '#FFFFFF', c * 0.3, c * 0.25, 4); this.fx.burst(p.x, p.y, ['#FFFFFF', '#C77DFF'], 40, 4); break; }
      }
    }
  }
  death(cells, game) {
    const style = this.look.fx, cols = this.skinColors();
    this.kick(18); this.flashOn(0.5, '255,92,122');
    const head = this.center(cells[0].x, cells[0].y);
    cells.forEach((s, i) => {
      const p = this.center(s.x, s.y);
      if (style === 'pixel') this.fx.burst(p.x, p.y, cols, 5, 2.5, { shape: 's', drag: 0.9 });
      else if (style === 'confetti') this.fx.burst(p.x, p.y, ['#FF5C7A', '#FFC93C', '#3CF0C5', '#5EC8FF', '#B49CFF'], 5, 4, { shape: 'r', gravity: 0.08, spin: 0.2, drag: 0.97, decay: 0.01 });
      else if (style === 'blackhole') this.fx.burst(p.x, p.y, ['#FFFFFF', '#B49CFF', ...cols], 4, 1, { attract: head, drag: 0.9, decay: 0.015 });
      else this.fx.burst(p.x, p.y, i === 0 ? ['#FFFFFF', '#FF5C7A'] : cols, i === 0 ? 20 : 4, 3);
    });
    if (style === 'supernova') {
      this.flashOn(0.9);
      for (let i = 0; i < 4; i++) this.fx.ring(head.x, head.y, i % 2 ? '#FFC93C' : '#FFFFFF', this.cell * (0.3 + i * 0.4), this.cell * (0.35 + i * 0.1), 4 - i * 0.5);
      this.fx.burst(head.x, head.y, ['#FFFFFF', '#FFE45C', '#FF8A4C'], 120, 8);
    }
    if (style === 'blackhole') this.fx.ring(head.x, head.y, '#B49CFF', this.cell * 3, -this.cell * 0.08, 3);
    void game;
  }
  float(x, y, text, color, scale = 1) { this.floats.push({ x, y, text, color, life: 1, scale }); }
  kick(n) { if (this.settings.shake && !this.settings.reducedMotion) this.shake = Math.max(this.shake, n); }
  flashOn(a, rgb = '255,255,255') { if (this.settings.reducedMotion) a *= 0.4; this.flash = Math.max(this.flash, a); this.flashColor = rgb; }

  /* ---------- background ---------- */
  buildBackground(sector) {
    const S = this.size, c = document.createElement('canvas');
    c.width = S * this.dpr; c.height = S * this.dpr;
    const g = c.getContext('2d'); g.scale(this.dpr, this.dpr);
    const pal = sector.palette, rng = new Rng('bg:' + sector.id);
    g.fillStyle = pal.bg; g.fillRect(0, 0, S, S);
    // nebula clouds
    const clouds = sector.id === 'nebula' ? 7 : 3;
    for (let i = 0; i < clouds; i++) {
      const x = rng.next() * S, y = rng.next() * S, r = S * (0.25 + rng.next() * 0.35);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const col = sector.id === 'nebula' ? (i % 2 ? '255,79,139' : '120,80,255') : sector.id === 'dunes' ? '255,110,60' : sector.id === 'horizon' ? '255,170,60' : '60,120,255';
      gr.addColorStop(0, `rgba(${col},${sector.id === 'nebula' ? 0.16 : 0.07})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }
    // stars
    for (let i = 0; i < 160; i++) {
      g.globalAlpha = 0.2 + rng.next() * 0.6; g.fillStyle = rng.chance(0.15) ? '#BFD9FF' : '#FFFFFF';
      const r = rng.next() < 0.92 ? 0.7 : 1.4; g.beginPath(); g.arc(rng.next() * S, rng.next() * S, r, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    // planet
    if (sector.id !== 'horizon') {
      const px = sector.id === 'dunes' ? S * 0.1 : S * 0.92, py = sector.id === 'dunes' ? S * 0.08 : S * 0.95, pr = S * (sector.id === 'belt' ? 0.16 : 0.32);
      const pg = g.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
      pg.addColorStop(0, pal.planet[0]); pg.addColorStop(1, pal.planet[1]);
      g.globalAlpha = 0.55; g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill();
      g.globalAlpha = 0.35; g.strokeStyle = pal.glow; g.lineWidth = 2; g.beginPath(); g.arc(px, py, pr + 2, 0, TAU); g.stroke(); g.globalAlpha = 1;
      if (sector.id === 'belt') { g.globalAlpha = 0.25; g.strokeStyle = '#C8C2B4'; g.lineWidth = 3; g.beginPath(); g.ellipse(px, py, pr * 1.8, pr * 0.4, -0.4, 0, TAU); g.stroke(); g.globalAlpha = 1; }
    }
    // grid
    const cell = this.cell;
    g.fillStyle = 'rgba(255,255,255,.065)';
    for (let y = 1; y < this.N; y++) for (let x = 1; x < this.N; x++) { g.beginPath(); g.arc(x * cell, y * cell, 0.9, 0, TAU); g.fill(); }
    // vignette
    const vg = g.createRadialGradient(S / 2, S / 2, S * 0.25, S / 2, S / 2, S * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, S, S);
    this.bg = c;
  }

  /* ---------- main draw ---------- */
  draw(game, now, dt = 16.7) {
    const ctx = this.ctx, S = this.size, cell = this.cell, f = dt / 16.67;
    const key = game.sectorDef.id + ':' + S + ':' + this.dpr;
    if (key !== this.bgKey) { this.buildBackground(game.sectorDef); this.bgKey = key; }
    this.fx.update(f);
    for (const t of this.floats) { t.y -= 0.55 * f; t.life -= 0.017 * f; }
    this.floats = this.floats.filter((t) => t.life > 0);
    this.shake *= Math.pow(0.86, f); this.flash = Math.max(0, this.flash - 0.03 * f);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    if (this.shake > 0.3) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    ctx.drawImage(this.bg, 0, 0, S, S);
    this.twinkle(ctx, now);
    const a = game.state === 'playing' ? Math.min(1, game.acc / game.interval()) : game.state === 'dead' || game.state === 'over' ? 1 : 0;

    // board frame
    ctx.lineWidth = 2;
    if (game.wraps) { ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(180,156,255,.45)'; }
    else { ctx.strokeStyle = game.sectorDef.palette.glow; ctx.globalAlpha = 0.45; ctx.shadowColor = game.sectorDef.palette.glow; ctx.shadowBlur = 12; }
    ctx.strokeRect(1, 1, S - 2, S - 2); ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    if (game.hole.size) this.drawBlackHole(ctx, game, now);
    this.drawObstacles(ctx, game, now);
    this.drawAsteroids(ctx, game, a, now);
    this.drawItems(ctx, game, now);
    if (game.state !== 'dead' || !game.deadDrawn) this.drawSnake(ctx, game, a, now, f);
    this.fx.draw(ctx);
    this.drawFloats(ctx);
    ctx.restore();

    if (game.hazard === 'fog') this.drawFog(ctx, game, a);
    if (game.stormT > 0) this.drawStorm(ctx, game, now);
    if ((game.effects.slow || 0) > 0 || (game.effects.warp || 0) > 0) { ctx.fillStyle = 'rgba(94,200,255,.07)'; ctx.fillRect(0, 0, S, S); }
    if (this.flash > 0) { ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.35})`; ctx.fillRect(0, 0, S, S); }
    void cell;
  }

  twinkle(ctx, now) {
    if (this.settings.reducedMotion) return;
    const S = this.size;
    for (let i = 0; i < 14; i++) {
      const x = ((i * 977) % 1000) / 1000 * S, y = ((i * 613 + 211) % 1000) / 1000 * S;
      const al = (Math.sin(now / 600 + i * 1.7) + 1) / 2;
      ctx.globalAlpha = al * 0.8; ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawBlackHole(ctx, game, now) {
    const c = this.cell, cx = (game.N / 2) * c, cy = cx;
    ctx.save(); ctx.translate(cx, cy);
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.rotate(now / (1400 + i * 500) * (i % 2 ? -1 : 1));
      const g = ctx.createRadialGradient(0, 0, c * 0.8, 0, 0, c * (3.2 + i * 0.7));
      g.addColorStop(0, 'rgba(255,201,60,0)'); g.addColorStop(0.35, `rgba(255,${150 + i * 30},60,${0.35 - i * 0.08})`); g.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, c * (3.4 + i * 0.6), c * (1.1 + i * 0.3), 0.3, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.shadowColor = '#FFC93C'; ctx.shadowBlur = 30; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, c * 1.05, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,230,160,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, c * 1.1, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  drawObstacles(ctx, game, now) {
    const c = this.cell, dunes = game.sectorDef.id === 'dunes';
    for (const [k, o] of game.obstacles) {
      const x = (k % game.N) * c, y = ((k / game.N) | 0) * c, pad = c * 0.06;
      let alpha = 1;
      if (o.temp) { const left = o.expire - game.time; alpha = left < 1500 ? 0.4 + 0.4 * Math.abs(Math.sin(now / 90)) : 0.9; }
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(x, y, x + c, y + c);
      g.addColorStop(0, o.temp ? '#C8925A' : dunes ? '#8A3A1E' : '#3A1E2A'); g.addColorStop(1, o.temp ? '#7A5230' : dunes ? '#4A1A0E' : '#1E0E16');
      ctx.fillStyle = g; this.rr(ctx, x + pad, y + pad, c - pad * 2, c - pad * 2, c * 0.28); ctx.fill();
      ctx.strokeStyle = o.temp ? 'rgba(255,220,160,.6)' : dunes ? 'rgba(255,138,76,.7)' : 'rgba(255,92,122,.75)'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(x + c * 0.35, y + c * 0.35, c * 0.12, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawAsteroids(ctx, game, a, now) {
    const c = this.cell;
    for (const s of game.asteroids) {
      let x = s.px + (s.x - s.px) * (game.ticks % 2 === 0 ? a : 1), y = s.py + (s.y - s.py) * (game.ticks % 2 === 0 ? a : 1);
      if (Math.abs(s.x - s.px) > 1 || Math.abs(s.y - s.py) > 1) { x = s.x; y = s.y; }
      const cx = (x + 0.5) * c, cy = (y + 0.5) * c, r = c * 0.48 * s.size;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(s.rot + now / 1500);
      const rng = new Rng(s.seed);
      ctx.beginPath();
      for (let i = 0; i < 9; i++) { const ang = (i / 9) * TAU, rr = r * (0.75 + rng.next() * 0.3); ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
      ctx.closePath();
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
      g.addColorStop(0, '#B8AE9C'); g.addColorStop(1, '#4A4238');
      ctx.fillStyle = g; ctx.shadowColor = 'rgba(255,181,71,.5)'; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(r * 0.2, r * 0.1, r * 0.22, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.3, r * 0.12, 0, TAU); ctx.fill();
      ctx.restore();
      // motion streak
      ctx.strokeStyle = 'rgba(255,181,71,.08)'; ctx.lineWidth = r * 0.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - s.dx * c * 0.5, cy - s.dy * c * 0.5); ctx.stroke();
    }
  }

  drawItems(ctx, game, now) {
    const c = this.cell;
    for (const it of game.items) {
      it.vx = it.vx ?? it.x; it.vy = it.vy ?? it.y;
      it.vx += (it.x - it.vx) * 0.3; it.vy += (it.y - it.vy) * 0.3;
      const cx = (it.vx + 0.5) * c, cy = (it.vy + 0.5) * c;
      const left = it.ttl === Infinity ? 1 : 1 - (game.time - it.born) / it.ttl;
      if (left < 0.28 && Math.floor(now / 120) % 2) continue;
      const pulse = 1 + Math.sin(now / 180 + it.x) * 0.08;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(pulse, pulse);
      switch (it.type) {
        case 'apple': {
          const g = ctx.createRadialGradient(-c * 0.12, -c * 0.12, 1, 0, 0, c * 0.42);
          g.addColorStop(0, '#FFE0E8'); g.addColorStop(0.4, '#FF4F7B'); g.addColorStop(1, '#A1123A');
          ctx.shadowColor = '#FF4F7B'; ctx.shadowBlur = c * 0.9; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, c * 0.36, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,200,220,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, c * 0.55, c * 0.18, now / 700, 0, TAU); ctx.stroke();
          break;
        }
        case 'gold':
          ctx.rotate(now / 600); ctx.shadowColor = '#FFC93C'; ctx.shadowBlur = c;
          ctx.fillStyle = '#FFC93C'; this.star(ctx, 5, c * 0.46, c * 0.2); ctx.fill(); ctx.shadowBlur = 0;
          ctx.fillStyle = '#FFF3B0'; this.star(ctx, 5, c * 0.22, c * 0.1); ctx.fill();
          break;
        case 'dust':
          for (let i = 0; i < 5; i++) { const an = now / 500 + i * 1.26, r = c * 0.24; ctx.fillStyle = i % 2 ? '#FFF3B0' : '#FFC93C'; ctx.beginPath(); ctx.arc(Math.cos(an) * r, Math.sin(an) * r, c * 0.09, 0, TAU); ctx.fill(); }
          ctx.fillStyle = '#FFE08A'; ctx.shadowColor = '#FFC93C'; ctx.shadowBlur = c * 0.6; this.star(ctx, 4, c * 0.2, c * 0.07); ctx.fill(); ctx.shadowBlur = 0;
          break;
        case 'crystal': {
          ctx.save(); ctx.rotate(now / 900);
          for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.fillStyle = 'rgba(199,125,255,.22)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(c * 0.08, -c * 1.1); ctx.lineTo(-c * 0.08, -c * 1.1); ctx.fill(); }
          ctx.restore();
          ctx.shadowColor = '#C77DFF'; ctx.shadowBlur = c * 1.4;
          const g = ctx.createLinearGradient(0, -c * 0.45, 0, c * 0.45); g.addColorStop(0, '#F3E1FF'); g.addColorStop(0.5, '#C77DFF'); g.addColorStop(1, '#5B2BD6');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -c * 0.46); ctx.lineTo(c * 0.3, -c * 0.1); ctx.lineTo(0, c * 0.46); ctx.lineTo(-c * 0.3, -c * 0.1); ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.stroke();
          break;
        }
        default: {
          const P = POWERS[it.type]; if (!P) break;
          ctx.shadowColor = P.color; ctx.shadowBlur = c * 0.9;
          ctx.fillStyle = 'rgba(14,16,26,.95)'; this.rr(ctx, -c * 0.43, -c * 0.43, c * 0.86, c * 0.86, c * 0.22); ctx.fill();
          ctx.strokeStyle = P.color; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;
          ctx.font = `${it.type === 'double' ? '800 ' : ''}${Math.floor(c * 0.5)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = P.color; ctx.fillText(P.icon, 0, c * 0.03);
        }
      }
      ctx.restore();
      if (it.ttl !== Infinity) { ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, c * 0.62, -Math.PI / 2, -Math.PI / 2 + left * TAU); ctx.stroke(); }
    }
  }

  snakePoints(game, a) {
    const c = this.cell;
    return game.snake.map((s, i) => {
      const p = game.prev[i] || s; let x = s.x, y = s.y;
      if (Math.abs(p.x - s.x) + Math.abs(p.y - s.y) <= 1) { x = p.x + (s.x - p.x) * a; y = p.y + (s.y - p.y) * a; }
      return { x: (x + 0.5) * c, y: (y + 0.5) * c };
    });
  }

  drawSnake(ctx, game, a, now, f) {
    const c = this.cell, len = game.snake.length;
    if (!len) return;
    const pts = this.snakePoints(game, a);
    const brk = (i) => i > 0 && Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) > c * 1.5;
    const dead = game.state === 'dead' || game.state === 'over';
    if (game.state === 'dead') { game.deadT = (game.deadT || 0) + 16 * f; if (game.deadT > 160) { game.deadDrawn = true; return; } }
    else { game.deadT = 0; game.deadDrawn = false; }
    // trail emission
    if (game.state === 'playing') this.emitTrail(pts[len - 1], f, now);

    const skin = this.look.skin, pattern = skin?.pattern;
    ctx.save();
    if (game.ghost) ctx.globalAlpha = 0.5 + 0.2 * Math.sin(now / 90);
    if (dead && game.state === 'dead') ctx.globalAlpha = 1 - game.deadT / 160;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = (off = 0) => { ctx.beginPath(); pts.forEach((p, i) => (i === 0 || brk(i) ? ctx.moveTo(p.x + off, p.y + off) : ctx.lineTo(p.x + off, p.y + off))); };
    const headCol = this.segColor(0, len, now);

    // glow / outline pass
    if (pattern === 'void') { ctx.strokeStyle = '#FFFFFF'; ctx.shadowColor = '#B49CFF'; ctx.shadowBlur = c; ctx.lineWidth = c * 0.86; path(); ctx.stroke(); }
    else { ctx.shadowColor = headCol; ctx.shadowBlur = c * 0.9; ctx.strokeStyle = headCol; ctx.lineWidth = c * 0.5; path(); ctx.stroke(); }
    ctx.shadowBlur = 0;
    // body segments, tail -> head
    for (let i = len - 1; i >= 1; i--) {
      if (brk(i)) continue;
      ctx.strokeStyle = this.segColor(i, len, now);
      ctx.lineWidth = c * (0.8 - 0.32 * i / Math.max(1, len - 1));
      ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i - 1].x, pts[i - 1].y); ctx.stroke();
    }
    // pattern overlays
    if (pattern === 'scales' || pattern === 'galaxy' || pattern === 'circuit') {
      for (let i = 1; i < len; i++) {
        const p = pts[i], w = c * (0.8 - 0.32 * i / Math.max(1, len - 1));
        if (pattern === 'scales') { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(p.x, p.y, w * 0.22, 0, TAU); ctx.fill(); }
        if (pattern === 'galaxy') { const tw = (Math.sin(now / 300 + i * 2.3) + 1) / 2; ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.7})`; ctx.beginPath(); ctx.arc(p.x + Math.sin(i * 3.1) * w * 0.25, p.y + Math.cos(i * 2.7) * w * 0.25, 0.8 + tw * 0.8, 0, TAU); ctx.fill(); }
        if (pattern === 'circuit') { const on = (Math.floor(now / 120) + i) % 6 === 0; ctx.fillStyle = on ? '#B8FFD6' : '#39FF88'; ctx.beginPath(); ctx.arc(p.x, p.y, on ? w * 0.2 : w * 0.1, 0, TAU); ctx.fill(); }
      }
    }
    // shine
    if (pattern !== 'void') { ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = c * 0.13; path(-c * 0.1); ctx.stroke(); }

    // head
    const h = pts[0], d = game.dir, px = -d.y, py = d.x;
    if (game.state === 'playing' && now % 2200 < 200) {
      ctx.strokeStyle = '#FF4F6E'; ctx.lineWidth = Math.max(1.5, c * 0.07); ctx.beginPath();
      ctx.moveTo(h.x + d.x * c * 0.4, h.y + d.y * c * 0.4); ctx.lineTo(h.x + d.x * c * 0.72, h.y + d.y * c * 0.72);
      ctx.lineTo(h.x + d.x * c * 0.84 + px * c * 0.09, h.y + d.y * c * 0.84 + py * c * 0.09);
      ctx.moveTo(h.x + d.x * c * 0.72, h.y + d.y * c * 0.72); ctx.lineTo(h.x + d.x * c * 0.84 - px * c * 0.09, h.y + d.y * c * 0.84 - py * c * 0.09); ctx.stroke();
    }
    ctx.fillStyle = pattern === 'void' ? '#050507' : headCol;
    ctx.shadowColor = pattern === 'void' ? '#FFFFFF' : headCol; ctx.shadowBlur = c * 0.6;
    ctx.beginPath(); ctx.arc(h.x, h.y, c * 0.47, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    if (pattern === 'void') { ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.stroke(); }
    for (const s of [1, -1]) {
      const ex = h.x + d.x * c * 0.12 + px * c * 0.2 * s, ey = h.y + d.y * c * 0.12 + py * c * 0.2 * s;
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ex, ey, c * 0.13, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0A0C12'; ctx.beginPath(); ctx.arc(ex + d.x * c * 0.05, ey + d.y * c * 0.05, c * 0.07, 0, TAU); ctx.fill();
    }
    this.drawCrown(ctx, h, d, now);
    // shield bubble
    if (game.shield) {
      ctx.strokeStyle = `rgba(127,212,255,${0.55 + 0.25 * Math.sin(now / 150)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.x, h.y, c * 0.8, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(127,212,255,.08)'; ctx.fill();
    }
    if ((game.effects.magnet || 0) > 0) {
      const r = c * (7 + (game.sp.passive.magnetRange || 0)) * (0.92 + 0.08 * Math.sin(now / 200));
      ctx.strokeStyle = 'rgba(255,107,138,.18)'; ctx.setLineDash([4, 10]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  emitTrail(tail, f, now) {
    const t = this.look.trail;
    if (!t || t.id === 'none') return;
    this.trailT += f;
    const rate = { sparks: 1.5, bubbles: 4, stardust: 1.5, flame: 0.8, glitch: 2.5, comet: 0.7, rainbow: 0.8 }[t.id] || 2;
    while (this.trailT > rate) {
      this.trailT -= rate;
      const col = t.colors[0] === 'rainbow' ? `hsl(${(now / 5) % 360},90%,62%)` : t.colors[(Math.random() * t.colors.length) | 0];
      const j = () => (Math.random() - 0.5) * this.cell * 0.4;
      switch (t.id) {
        case 'sparks': this.fx.add({ x: tail.x + j(), y: tail.y + j(), vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, size: 1.4, color: col, decay: 0.05 }); break;
        case 'bubbles': this.fx.add({ x: tail.x + j(), y: tail.y + j(), vy: -0.4, size: 2 + Math.random() * 3, color: col, shape: 'o', decay: 0.02 }); break;
        case 'stardust': this.fx.add({ x: tail.x + j(), y: tail.y + j(), vy: 0.3, size: 1.2 + Math.random(), color: col, decay: 0.025, drag: 0.99 }); break;
        case 'flame': this.fx.add({ x: tail.x + j(), y: tail.y + j(), vy: -0.6, size: 2.5 + Math.random() * 2, grow: 0.8, color: col, decay: 0.04 }); break;
        case 'glitch': this.fx.add({ x: tail.x + j() * 2, y: tail.y + j(), size: 2 + Math.random() * 3, color: col, shape: 's', decay: 0.08 }); break;
        case 'comet': this.fx.add({ x: tail.x, y: tail.y, size: this.cell * 0.22, color: col, decay: 0.035, drag: 1 }); break;
        case 'rainbow': this.fx.add({ x: tail.x, y: tail.y, size: this.cell * 0.2, color: col, decay: 0.03 }); break;
      }
    }
  }

  drawCrown(ctx, h, d, now) {
    const id = this.look.crown, c = this.cell;
    if (!id || id === 'none') return;
    ctx.save();
    const top = { x: h.x, y: h.y - c * 0.55 };
    switch (id) {
      case 'antenna':
        ctx.strokeStyle = '#DDE3EE'; ctx.lineWidth = 1.5;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(h.x + s * c * 0.15, h.y - c * 0.35); ctx.lineTo(h.x + s * c * 0.32, h.y - c * 0.85); ctx.stroke(); ctx.fillStyle = s > 0 ? '#FF5C7A' : '#3CF0C5'; ctx.beginPath(); ctx.arc(h.x + s * c * 0.32, h.y - c * 0.88, c * 0.1, 0, TAU); ctx.fill(); }
        break;
      case 'halo':
        ctx.strokeStyle = '#FFE58A'; ctx.shadowColor = '#FFE58A'; ctx.shadowBlur = 10; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(h.x, h.y - c * 0.7 + Math.sin(now / 300) * 1.5, c * 0.36, c * 0.12, 0, 0, TAU); ctx.stroke();
        break;
      case 'horns':
        ctx.fillStyle = '#E8334D';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(h.x + s * c * 0.12, h.y - c * 0.32); ctx.quadraticCurveTo(h.x + s * c * 0.5, h.y - c * 0.5, h.x + s * c * 0.42, h.y - c * 0.92); ctx.lineTo(h.x + s * c * 0.34, h.y - c * 0.3); ctx.fill(); }
        break;
      case 'visor': {
        const ang = Math.atan2(d.y, d.x);
        ctx.translate(h.x, h.y); ctx.rotate(ang);
        ctx.fillStyle = 'rgba(10,14,24,.92)'; this.rr(ctx, c * 0.02, -c * 0.34, c * 0.3, c * 0.68, c * 0.12); ctx.fill();
        const g = ctx.createLinearGradient(0, -c * 0.34, 0, c * 0.34); g.addColorStop(0, '#3CF0C5'); g.addColorStop(1, '#2A7BFF');
        ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(c * 0.18, -c * 0.26, c * 0.05, c * 0.3);
        break;
      }
      case 'tophat':
        ctx.fillStyle = '#111318'; ctx.fillRect(top.x - c * 0.38, top.y + c * 0.02, c * 0.76, c * 0.1);
        ctx.fillRect(top.x - c * 0.24, top.y - c * 0.5, c * 0.48, c * 0.54);
        ctx.fillStyle = '#FF4F8B'; ctx.fillRect(top.x - c * 0.24, top.y - c * 0.1, c * 0.48, c * 0.1);
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.strokeRect(top.x - c * 0.24, top.y - c * 0.5, c * 0.48, c * 0.54);
        break;
      case 'crown': {
        const g = ctx.createLinearGradient(0, top.y - c * 0.4, 0, top.y + c * 0.1); g.addColorStop(0, '#FFF1A8'); g.addColorStop(1, '#C8901E');
        ctx.fillStyle = g; ctx.shadowColor = '#FFC93C'; ctx.shadowBlur = 8; ctx.beginPath();
        ctx.moveTo(top.x - c * 0.36, top.y + c * 0.1); ctx.lineTo(top.x - c * 0.36, top.y - c * 0.25); ctx.lineTo(top.x - c * 0.18, top.y - c * 0.06);
        ctx.lineTo(top.x, top.y - c * 0.4); ctx.lineTo(top.x + c * 0.18, top.y - c * 0.06); ctx.lineTo(top.x + c * 0.36, top.y - c * 0.25); ctx.lineTo(top.x + c * 0.36, top.y + c * 0.1); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#FF4F8B'; ctx.beginPath(); ctx.arc(top.x, top.y - c * 0.02, c * 0.07, 0, TAU); ctx.fill();
        break;
      }
      case 'starcrown':
        for (let i = 0; i < 6; i++) {
          const an = now / 700 + (i / 6) * TAU, x = h.x + Math.cos(an) * c * 0.7, y = h.y + Math.sin(an) * c * 0.7 * 0.55 - c * 0.45;
          ctx.save(); ctx.translate(x, y); ctx.rotate(an * 2);
          ctx.fillStyle = `hsl(${(i * 60 + now / 10) % 360},95%,70%)`; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
          this.star(ctx, 5, c * 0.14, c * 0.06); ctx.fill(); ctx.restore();
        }
        break;
    }
    ctx.restore();
  }

  drawFloats(ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.floats) {
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.font = `800 ${Math.max(12, this.cell * 0.6 * t.scale)}px ${FONT}`;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  drawFog(ctx, game, a) {
    const pts = this.snakePoints(game, a), h = pts[0];
    const fc = this.fogCv.getContext('2d'), S = this.size;
    fc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    fc.globalCompositeOperation = 'source-over'; fc.clearRect(0, 0, S, S);
    fc.fillStyle = 'rgba(8,3,16,.93)'; fc.fillRect(0, 0, S, S);
    fc.globalCompositeOperation = 'destination-out';
    const r = game.fogRadius * this.cell;
    const g = fc.createRadialGradient(h.x, h.y, r * 0.35, h.x, h.y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    fc.fillStyle = g; fc.beginPath(); fc.arc(h.x, h.y, r, 0, TAU); fc.fill();
    // faint beacons for items so the player can navigate
    for (const it of game.items) { const p = this.center(it.x, it.y); const gg = fc.createRadialGradient(p.x, p.y, 0, p.x, p.y, this.cell * 0.9); gg.addColorStop(0, 'rgba(0,0,0,.6)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); fc.fillStyle = gg; fc.beginPath(); fc.arc(p.x, p.y, this.cell * 0.9, 0, TAU); fc.fill(); }
    fc.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.fogCv, 0, 0); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  drawStorm(ctx, game, now) {
    const S = this.size, al = Math.min(1, game.stormT / 1000) * 0.5;
    ctx.fillStyle = `rgba(200,120,60,${al * 0.35})`; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = `rgba(255,200,150,${al})`; ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const y = ((i * 97) % S), x = ((now * 0.6 + i * 131) % (S + 80)) - 40;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 30, y + 4); ctx.stroke();
    }
  }

  rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  star(ctx, n, R, r) { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const an = (i * Math.PI) / n - Math.PI / 2, rad = i % 2 ? r : R; ctx.lineTo(Math.cos(an) * rad, Math.sin(an) * rad); } ctx.closePath(); }
}

/** Small static preview of a skin/species for cards (draws an S-curve snake). */
export function drawPreview(canvas, { colors, pattern = 'gradient', crown = 'none' }, w = 160, h = 90) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const r = new Renderer(canvas); r.cell = Math.min(w / 7, h / 3.2); r.ctx = ctx;
  r.look = { skin: { pattern, colors }, speciesColors: colors, crown };
  const pts = []; for (let i = 0; i < 18; i++) { const t = i / 17; pts.push({ x: w * 0.84 - t * w * 0.68, y: h * 0.56 + Math.sin(t * Math.PI * 2) * h * 0.18 }); }
  const len = pts.length, now = performance.now();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = r.segColor(0, len, now); ctx.shadowBlur = 12;
  for (let i = len - 1; i >= 1; i--) { ctx.strokeStyle = pattern === 'void' ? '#fff' : r.segColor(i, len, now); ctx.lineWidth = r.cell * (0.8 - 0.35 * i / len) + (pattern === 'void' ? 3 : 0); ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i - 1].x, pts[i - 1].y); ctx.stroke(); }
  if (pattern === 'void') for (let i = len - 1; i >= 1; i--) { ctx.strokeStyle = '#050507'; ctx.lineWidth = r.cell * (0.8 - 0.35 * i / len); ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i - 1].x, pts[i - 1].y); ctx.stroke(); }
  ctx.shadowBlur = 0;
  const hd = pts[0], c = r.cell;
  ctx.fillStyle = pattern === 'void' ? '#050507' : r.segColor(0, len, now); ctx.beginPath(); ctx.arc(hd.x, hd.y, c * 0.48, 0, TAU); ctx.fill();
  if (pattern === 'void') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  for (const s of [1, -1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hd.x + c * 0.12, hd.y + c * 0.2 * s, c * 0.13, 0, TAU); ctx.fill(); ctx.fillStyle = '#0A0C12'; ctx.beginPath(); ctx.arc(hd.x + c * 0.17, hd.y + c * 0.2 * s, c * 0.07, 0, TAU); ctx.fill(); }
  r.drawCrown(ctx, hd, { x: 1, y: 0 }, now);
}
