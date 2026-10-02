/** In-run heads-up display (DOM, updated each frame with minimal writes). */
import { h, fmt } from './dom.js';
import { EFFECT_META } from '../data/powers.js';

export class Hud {
  constructor(root, { onPause, onAbility, onDir }) {
    this.root = root;
    this.score = h('b', {}, '0'); this.best = h('small', {}, 'BEST 0');
    this.combo = h('div.pill.combo-pill', { 'aria-live': 'polite' }, h('span', {}, 'x1'), h('i.fill'));
    this.level = h('div.pill', {}, 'LV 1');
    this.timer = h('div.pill', { style: { color: 'var(--dust)', display: 'none' } }, '1:30');
    this.effects = h('div.hud-effects', { style: { top: '60px' } });
    this.count = h('div.countdown');
    this.banners = h('div');
    this.fps = h('div', { style: { position: 'absolute', top: '62px', left: '12px', fontSize: '11px', color: 'var(--muted)', display: 'none' } });
    this.abIcon = h('span', {}, '⚡'); this.abLabel = h('small', {}, 'ABILITY');
    this.ability = h('button.ability-btn', { 'aria-label': 'Use ability', onpointerdown: (e) => { e.preventDefault(); e.stopPropagation(); onAbility(); } }, this.abIcon, this.abLabel);
    const pad = h('div.dpad', {}, h('span'), btn('▲', 0, -1), h('span'), btn('◀', -1, 0), btn('▼', 0, 1), btn('▶', 1, 0));
    function btn(t, x, y) { return h('button', { 'aria-label': 'Move', onpointerdown: (e) => { e.preventDefault(); e.stopPropagation(); onDir(x, y); } }, t); }
    root.append(
      h('div.hud-top', {}, h('div.hud-score', {}, this.score, this.best), h('div.hud-mid', {}, this.combo, this.level, this.timer),
        h('div.hud-right', {}, h('button.icon-btn', { 'aria-label': 'Pause', onclick: onPause }, '⏸'))),
      this.effects, this.fps, this.count, this.banners, this.ability, pad);
    this.fxEls = {}; this.last = {}; this.frames = 0; this.fpsT = 0;
  }
  setPlacement(touch) {
    Object.assign(this.ability.style, touch ? { right: '20px', bottom: '26px' } : { right: '28px', bottom: '36px' });
  }
  start(game, best, abilityIcon, abilityName) {
    this.last = {}; this.best.textContent = 'BEST ' + fmt(best); this.bestVal = best;
    this.abIcon.textContent = abilityIcon; this.abLabel.textContent = abilityName.toUpperCase();
    this.timer.style.display = game.mode === 'blitz' ? '' : 'none';
    for (const k in this.fxEls) this.fxEls[k].remove(); this.fxEls = {};
  }
  set(key, val, fn) { if (this.last[key] !== val) { this.last[key] = val; fn(val); } }
  update(g, now, showFps) {
    this.set('score', g.score, (v) => {
      this.score.textContent = fmt(v); this.score.classList.add('bump'); clearTimeout(this.bt); this.bt = setTimeout(() => this.score.classList.remove('bump'), 110);
      if (v > this.bestVal && this.bestVal > 0 && !this.bestShown) { this.bestShown = true; this.banner('NEW BEST!', 'Keep going', '#FFC93C'); }
    });
    const c = Math.max(1, Math.min(5, g.combo || 1));
    this.set('combo', c, (v) => { this.combo.firstChild.textContent = 'x' + v + (v >= 5 ? ' MAX' : ''); this.combo.className = 'pill combo-pill' + (v >= 5 ? ' max' : v >= 3 ? ' hot' : ''); });
    const left = g.combo > 0 ? Math.max(0, 1 - (g.time - g.lastEat) / g.comboWindow) : 0;
    this.combo.lastChild.style.width = left * 100 + '%';
    this.set('level', g.level, (v) => (this.level.textContent = 'LV ' + v));
    if (g.mode === 'blitz') this.set('time', Math.ceil(g.timeLeft / 1000), (v) => { this.timer.textContent = `⏱ ${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; this.timer.style.color = v <= 10 ? 'var(--danger)' : 'var(--dust)'; });
    // ability
    const p = g.abilityMax ? 100 - (g.abilityCd / g.abilityMax) * 100 : 100;
    this.ability.style.setProperty('--p', p.toFixed(1));
    this.set('ready', g.abilityCd === 0, (v) => this.ability.classList.toggle('ready', v));
    // effects
    const active = Object.keys(g.effects).filter((k) => g.effects[k] > 0);
    if (g.shield) active.push('shield');
    for (const k of active) {
      const meta = k === 'shield' ? { icon: '🛡️', name: 'Shield', color: '#7FD4FF' } : EFFECT_META[k];
      if (!meta) continue;
      if (!this.fxEls[k]) { this.fxEls[k] = h('div.pill', { style: { color: meta.color } }, meta.icon + ' ', h('span', { style: { color: 'var(--text)' } }, meta.name), h('i.fill')); this.effects.append(this.fxEls[k]); this.fxEls[k].max = g.effects[k] || 1; }
      const el = this.fxEls[k]; if (k !== 'shield') { el.max = Math.max(el.max, g.effects[k]); el.lastChild.style.width = (g.effects[k] / el.max) * 100 + '%'; } else el.lastChild.style.width = '100%';
    }
    for (const k in this.fxEls) if (!active.includes(k)) { this.fxEls[k].remove(); delete this.fxEls[k]; }
    // fps
    this.frames++;
    if (now - this.fpsT > 500) { this.fps.textContent = Math.round((this.frames * 1000) / (now - this.fpsT)) + ' FPS'; this.fps.style.display = showFps ? '' : 'none'; this.frames = 0; this.fpsT = now; }
  }
  countdown(n) { this.count.replaceChildren(h('span', {}, n === 0 ? 'GO' : String(n))); if (n === 0) setTimeout(() => this.count.replaceChildren(), 600); }
  clearCountdown() { this.count.replaceChildren(); }
  banner(title, sub, color) {
    const b = h('div.banner', {}, h('b', { style: color ? { textShadow: `0 0 30px ${color}`, color } : {} }, title), sub ? h('small', {}, sub) : null);
    this.banners.append(b); setTimeout(() => b.remove(), 1700);
  }
  reset() { this.bestShown = false; this.clearCountdown(); this.banners.replaceChildren(); }
}
