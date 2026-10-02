/** Modal dialogs: generic modal, confirm, core opening, results, revive, pause, onboarding. */
import { h, clear, fmt, currency, countUp, costLabel } from './dom.js';
import { RARITY } from '../data/rarity.js';
import { CORES, openCore } from '../meta/cores.js';
import { canAfford, equip } from '../meta/economy.js';
import { itemArt, itemName, itemRarity, typeName } from './art.js';
import { Rng } from '../core/rng.js';
import { reviveCost } from '../meta/progress.js';
import { SECTOR_BY_ID, MODES } from '../data/sectors.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { levelFromXp } from '../data/progression.js';

const root = () => document.getElementById('modals');
let stack = [];
export const modalOpen = () => stack.length > 0;

export function modal(build, { wide = false, dismissable = true, onClose, className = '' } = {}) {
  const wrap = h('div.modal-wrap', { role: 'dialog', 'aria-modal': 'true' });
  const box = h(`div.modal${wide ? '.wide' : ''}${className ? '.' + className : ''}`);
  let closed = false;
  const close = (v) => {
    if (closed) return; closed = true;
    wrap.style.animation = 'fadeIn .18s reverse forwards';
    setTimeout(() => wrap.remove(), 170);
    stack = stack.filter((s) => s !== entry);
    onClose?.(v);
  };
  const entry = { close, dismissable };
  box.append(...[build(close)].flat().filter(Boolean));
  wrap.append(box);
  if (dismissable) wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
  root().append(wrap);
  stack.push(entry);
  setTimeout(() => box.querySelector('[data-autofocus]')?.focus(), 60);
  return { close, el: box };
}
/** Escape closes the top-most dismissable modal. Returns true if handled. */
export function closeTopModal() {
  const top = stack[stack.length - 1];
  if (top && top.dismissable) { top.close(); return true; }
  return false;
}

export function confirmDialog({ title, text, ok = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    modal((close) => [
      h('h2', {}, title), h('p.sub', {}, text),
      h('div.actions', {}, h('button.btn', { onclick: () => close(false) }, 'Cancel'),
        h(`button.btn${danger ? '' : '.primary'}`, { style: danger ? { background: 'var(--danger)', color: '#fff', border: 0 } : {}, onclick: () => close(true), 'data-autofocus': true }, ok))
    ], { onClose: (v) => resolve(!!v) });
  });
}

/* ---------------- core opening ---------------- */
export function openCoreFlow(app, coreId, { free = false, minRarity = null } = {}) {
  return new Promise((resolve) => {
    const core = CORES[coreId];
    if (!free && !canAfford(app.save, core.cost)) { app.toast('Not enough currency', 'bad'); app.audio.play('error'); return resolve(null); }
    const res = openCore(app.save, coreId, new Rng(), { free, minRarity });
    if (!res) return resolve(null);
    app.commit(true); // persist before the animation so refreshing can't re-roll
    const color = RARITY[res.rarity].color;
    const layer = h('div.opening');
    const orb = h(`div.big-orb.core-orb.${coreId}.shaking`, { 'aria-label': 'Open core' }, h('div.rays'));
    const hint = h('div.tap-hint', {}, 'Tap to open');
    const title = h('h3', { style: { letterSpacing: '.3em', color: 'var(--muted)', fontSize: '13px' } }, core.name.toUpperCase());
    layer.append(title, orb, hint);
    root().append(layer);
    stack.push({ close: () => {}, dismissable: false });
    let revealed = false;
    let shakeTimer = setInterval(() => app.audio.play('coreShake'), 140);
    const tint = setTimeout(() => { orb.style.setProperty('--rc', color); orb.style.boxShadow = `0 0 90px ${color}`; }, 800);
    const reveal = () => {
      if (revealed) return; revealed = true;
      clearInterval(shakeTimer); clearTimeout(tint);
      orb.style.setProperty('--rc', color);
      orb.classList.remove('shaking'); orb.classList.add('burst');
      app.audio.play('reveal', res.rarity);
      app.haptic(res.rarity === 'legendary' || res.rarity === 'mythic' ? [30, 40, 60] : 15);
      setTimeout(() => {
        clear(layer);
        const r = res.result;
        const status = r.duplicate ? h('div.sub', {}, 'Duplicate · converted to ', currency('stardust', r.refund || r.stardust || 120))
          : r.fragment ? (r.assembled ? h('div', { style: { color: 'var(--ok)', fontWeight: 800 } }, '🧬 Species assembled! Now playable.') : h('div.sub', {}, `Fragment ${r.count}/${SPECIES_BY_ID[res.key.split(':')[1]].fragments}`))
          : h('div', { style: { color: 'var(--ok)', fontWeight: 800, letterSpacing: '.12em', fontSize: '12px' } }, 'NEW!');
        const card = h('div.reveal-card', { style: { '--rc': color } },
          h('div.art', {}, itemArt(res.key, app.save, 260, 120)),
          h(`span.rarity.r-${res.rarity}`, {}, RARITY[res.rarity].name),
          h('b', {}, itemName(res.key)), h('small.sub', {}, typeName(res.key)), status,
          res.pityTriggered ? h('small', { style: { color: 'var(--dust)' } }, '★ Pity guarantee triggered') : null);
        const [type, id] = res.key.split(':');
        const canEquip = r.isNew && ['skin', 'trail', 'crown', 'fx', 'title'].includes(type);
        const again = !free && canAfford(app.save, core.cost);
        const done = () => { layer.remove(); stack.pop(); app.refresh(); resolve(res); };
        const actions = h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' } },
          canEquip ? h('button.btn.primary', { onclick: () => { equip(app.save, type, id); app.commit(); app.toast(`Equipped ${itemName(res.key)}`); done(); } }, 'Equip') : null,
          again ? h('button.btn', { onclick: () => { done(); setTimeout(() => openCoreFlow(app, coreId), 50); } }, 'Open another · ', costLabel(core.cost)) : null,
          h('button.btn', { onclick: done, 'data-autofocus': true }, 'Done'));
        layer.append(card, actions);
        setTimeout(() => actions.querySelector('[data-autofocus]')?.focus(), 50);
      }, 420);
    };
    orb.addEventListener('click', reveal); hint.addEventListener('click', reveal);
    setTimeout(reveal, 1900);
  });
}

export function oddsModal(coreId) {
  const core = CORES[coreId];
  modal((close) => [
    h('h2', {}, core.name + ' · Drop rates'),
    h('p.sub', {}, 'Every core contains exactly one item. Duplicates convert to Stardust, so nothing is ever wasted.'),
    h('div.odds', {}, ...Object.entries(core.odds).filter(([, w]) => w > 0).flatMap(([r, w]) => [h(`span.rarity.r-${r}`, { style: { justifySelf: 'start' } }, RARITY[r].name), h('b', {}, (w * 100).toFixed(w < 0.01 ? 1 : 1) + '%')])),
    h('p.sub', {}, `Pity: guaranteed ${RARITY[core.pity.minRarity].name} or better within ${core.pity.every} opens.`),
    h('button.btn.block', { onclick: () => close(), 'data-autofocus': true }, 'Got it')
  ]);
}

/* ---------------- run flow ---------------- */
export function reviveModal(app, game, { onRevive, onSkip }) {
  const cost = reviveCost(game.revives);
  let left = 5000, timer;
  const ring = h('div.revive-ring', { style: { '--p': 100 } }, h('b', {}, '5'));
  const afford = canAfford(app.save, cost);
  const m = modal((close) => [
    h('div.center', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      h('h2', {}, 'Continue?'), h('p.sub', {}, game.reason),
      ring,
      h('button.btn.premium.block', { disabled: !afford, onclick: () => { clearInterval(timer); close('revive'); }, 'data-autofocus': true }, 'Revive · ', currency('crystals', cost.crystals)),
      !afford ? h('small.sub', {}, `You need ${cost.crystals} Void Crystals. Earn them from missions, the pass and daily rewards.`) : null,
      h('button.btn.ghost.block', { onclick: () => { clearInterval(timer); close('skip'); } }, 'No thanks'))
  ], { dismissable: false, onClose: (v) => (v === 'revive' ? onRevive(cost) : onSkip()) });
  timer = setInterval(() => {
    left -= 100;
    ring.style.setProperty('--p', (left / 5000) * 100);
    ring.firstChild.textContent = Math.ceil(left / 1000);
    if (left <= 0) { clearInterval(timer); m.close('skip'); }
  }, 100);
}

export function pauseModal(app, { onResume, onRestart, onQuit }) {
  modal((close) => [
    h('h2', {}, 'Paused'),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      h('button.btn.primary.block', { onclick: () => close('resume'), 'data-autofocus': true }, 'Resume'),
      h('button.btn.block', { onclick: () => close('restart') }, 'Restart run'),
      h('button.btn.ghost.block', { onclick: () => close('quit') }, 'End run & collect rewards')),
    h('p.sub', { style: { textAlign: 'center', fontSize: '12.5px' } }, h('span.kbd', {}, 'Esc'), ' resume · ', h('span.kbd', {}, '←↑↓→'), ' move · ', h('span.kbd', {}, 'Space'), ' ability')
  ], { onClose: (v) => (v === 'restart' ? onRestart() : v === 'quit' ? onQuit() : onResume()) });
}

export function resultsModal(app, summary, r, { onAgain, onHome }) {
  const sector = SECTOR_BY_ID[summary.sector], mode = MODES[summary.mode];
  const scoreEl = h('div.big-score', {}, '0');
  const rows = [
    ['✨ Stardust', currency('stardust', r.stardust), r.dailyFirst ? 'Daily first clear ×2' : `${sector.name} ×${sector.mult}`],
    r.crystals ? ['◆ Void Crystals found', currency('crystals', r.crystals), 'Rare find!'] : null,
    ['Pilot XP', h('b', {}, '+' + fmt(r.xp)), null],
    ['Pass XP', h('b', {}, '+' + fmt(r.passXp)), r.tiersGained ? `+${r.tiersGained} tier${r.tiersGained > 1 ? 's' : ''}!` : null],
    ...r.levels.map((l) => [`Level ${l.level} reached`, l.reward.crystals ? currency('crystals', l.reward.crystals) : currency('stardust', l.reward.stardust), 'Level reward']),
    ...r.achievements.map((a) => [`🏆 ${a.name}`, currency('crystals', a.reward.crystals), a.desc])
  ].filter(Boolean);
  const lv = levelFromXp(app.save.profile.xp);
  modal((close) => [
    h('div.center', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      h('h3', {}, `${mode.name}${summary.mode === 'endless' ? ' · ' + sector.name : ''}`),
      h('small.sub', {}, summary.reason || 'Run complete'),
      scoreEl,
      r.newBest ? h('span.new-best', {}, '★ NEW BEST') : h('small.sub', {}, `Best ${fmt(r.prevBest)}`),
      h('div.stat-grid', { style: { width: '100%', gridTemplateColumns: 'repeat(4,1fr)' } },
        ...[['Length', summary.length], ['Combo', 'x' + Math.min(5, summary.maxCombo || 1)], ['Level', summary.level], ['Time', `${Math.floor(summary.timeSec / 60)}:${String(summary.timeSec % 60).padStart(2, '0')}`]]
          .map(([k, v]) => h('div.card.stat', { style: { padding: '8px' } }, h('small', {}, k), h('b', { style: { fontSize: '16px' } }, v)))),
      h('div.reward-rows', {}, ...rows.map(([k, v, note], i) => h('div.rr', { style: { animationDelay: `${0.25 + i * 0.12}s` } }, h('div', { style: { textAlign: 'left' } }, h('div', {}, k), note ? h('small', {}, note) : null), v))),
      h('div', { style: { width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' } },
        h('small.sub', { style: { textAlign: 'left' } }, `Level ${lv.level} · ${fmt(lv.into)} / ${fmt(lv.need)} XP`),
        h('div.bar', {}, h('i', { style: { width: (lv.into / lv.need) * 100 + '%' } }))),
      h('div.actions', { style: { width: '100%' } },
        h('button.btn', { onclick: () => close('home') }, 'Home'),
        h('button.btn.primary', { onclick: () => close('again'), 'data-autofocus': true }, 'Play again')),
      h('small.sub', {}, h('span.kbd', {}, 'Enter'), ' play again'))
  ], { wide: false, onClose: (v) => (v === 'again' ? onAgain() : onHome()) });
  countUp(scoreEl, summary.score, 900);
}

/* ---------------- onboarding ---------------- */
export function onboarding(app, done) {
  const input = h('input.text-input', { maxLength: 16, placeholder: 'Pilot name', value: '', 'aria-label': 'Pilot name', 'data-autofocus': true });
  modal((close) => [
    h('div.center', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      h('div.logo', { style: { fontSize: '38px' } }, 'NEON SERPENT'), h('span.logo-sub', {}, 'COSMOS'),
      h('p.sub', {}, 'Pilot a cosmic serpent across five sectors of space. Eat orbs, chain combos, dodge hazards and unlock rare species.')),
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' } },
      ...[['🕹️', 'Move', 'Arrows / WASD / swipe'], ['⚡', 'Ability', 'Space / E / tap button'], ['🔥', 'Combos', 'Eat fast for up to x5'], ['◆', 'Crystals', 'Rare. Spend them wisely.']]
        .map(([i, t, d]) => h('div.card', { style: { padding: '10px' } }, h('div', { style: { fontSize: '20px' } }, i), h('b', {}, t), h('div.sub', { style: { fontSize: '12px' } }, d)))),
    input,
    h('button.btn.primary.block', { onclick: () => close('ok') }, 'Launch · claim welcome core 🎁')
  ], { dismissable: false, onClose: () => {
    const name = sanitizeName(input.value);
    app.save.profile.name = name || 'Pilot';
    app.save.profile.onboarded = true;
    app.commit(true);
    done();
  } });
}
export const sanitizeName = (v) => String(v || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16);
