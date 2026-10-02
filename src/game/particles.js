/** Lightweight pooled particle system for the canvas renderer. */
export class Particles {
  constructor(max = 900) { this.list = []; this.max = max; this.scale = 1; }
  add(p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ vx: 0, vy: 0, life: 1, decay: 0.02, size: 3, drag: 0.95, gravity: 0, shape: 'c', spin: 0, rot: 0, ...p });
  }
  burst(x, y, colors, n, speed = 3, extra = {}) {
    n = Math.round(n * this.scale);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * speed;
      this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, decay: 0.012 + Math.random() * 0.025, size: 1.2 + Math.random() * 2.8, color: colors[(Math.random() * colors.length) | 0], ...extra });
    }
  }
  ring(x, y, color, r = 6, grow = 1.2, width = 2) { this.add({ x, y, shape: 'ring', color, size: r, grow, decay: 0.035, width }); }
  update(f) {
    for (const p of this.list) {
      if (p.shape === 'ring') p.size += p.grow * f;
      else {
        if (p.attract) { const dx = p.attract.x - p.x, dy = p.attract.y - p.y; p.vx += dx * 0.02 * f; p.vy += dy * 0.02 * f; }
        p.vy += p.gravity * f; p.x += p.vx * f; p.y += p.vy * f;
        p.vx *= Math.pow(p.drag, f); p.vy *= Math.pow(p.drag, f); p.rot += p.spin * f;
      }
      p.life -= p.decay * f;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }
  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      const c = p.color === 'rainbow' ? `hsl(${(p.x + p.y) % 360},90%,65%)` : p.color;
      if (p.shape === 'ring') { ctx.strokeStyle = c; ctx.lineWidth = p.width; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.stroke(); continue; }
      ctx.fillStyle = c;
      const s = p.size * (p.grow ? 1 + (1 - p.life) * p.grow : 0.5 + p.life * 0.5);
      if (p.shape === 's') ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
      else if (p.shape === 'r') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s, -s * 0.5, s * 2, s); ctx.restore(); }
      else if (p.shape === 'o') { ctx.strokeStyle = c; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, 6.283); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, 6.283); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
}
