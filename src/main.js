/**
 * App controller: wires save data, menus, the game session, input, audio and rendering.
 */
import '../styles/main.css';
import { loadSave, persist, defaultSave, enforceInvariants } from './core/storage.js';
import { hashString, dayKey } from './core/rng.js';
import { audio } from './core/audio.js';
import { Game, GRID } from './game/engine.js';
import { Renderer } from './game/render.js';
import { SPECIES_BY_ID } from './data/species.js';
import { SECTOR_BY_ID, MODES } from './data/sectors.js';
import { cosmetic } from './data/cosmetics.js';
import { levelFromXp } from './data/progression.js';
import { spend } from './meta/economy.js';
import * as P from './meta/progress.js';
import { h, clear, fmt, currency, $ } from './ui/dom.js';
import { SCREENS, dailySector } from './ui/screens.js';
import { Hud } from './ui/hud.js';
import { modalOpen, closeTopModal, reviveModal, pauseModal, resultsModal, onboarding, openCoreFlow } from './ui/modals.js';
import { itemName } from './ui/art.js';

const VERSION = '1.0.0';
const ABILITY_ICON = { dash: '🚀', burrow: '🕳️', pulse: '🧲', shield: '🛡️', flare: '☀️', phase: '🌀', warp: '⌛', nova: '💫' };
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

/* ---------------- state ---------------- */
const loaded = loadSave();
const app = {
  save: loaded.save, audio, version: VERSION, ui: { lockerTab: 'skin' }, screen: 'home',
  commit(immediate = false) { persist(app.save, immediate); refreshChrome(); },
  refresh() { renderScreen(); refreshChrome(); },
  refreshChrome: () => refreshChrome(),
  go(name) { if (!SCREENS[name]) return; app.screen = name; audio.play('click'); renderScreen(true); refreshChrome(); },
  toast, haptic, startRun: () => startRun(),
  claimLogin, claimMission, claimMissionBonus, claimPass, claimAllPass,
  applySettings, resetSave
};
P.ensureMissions(app.save);
P.syncLevel(app.save);
enforceInvariants(app.save);
if (loaded.tampered) setTimeout(() => toast('Save data failed an integrity check — currency was reset.', 'bad'), 800);

/* ---------------- DOM shell ---------------- */
const canvas = $('#board'), stage = $('#stage');
const renderer = new Renderer(canvas);
const hud = new Hud($('#hud'), {
  onPause: () => pause(), onAbility: () => useAbility(), onDir: (x, y) => game?.queueDir(x, y)
});
hud.setPlacement(isTouch);
const NAV = [['home', '🕹️', 'Play'], ['species', '🐍', 'Species'], ['locker', '🎨', 'Locker'], ['shop', '🛒', 'Shop'], ['pass', '🎟️', 'Pass'], ['quests', '🎯', 'Quests']];
const navInner = h('div.nav-inner', {}, ...NAV.map(([id, icon, label]) => h('button', { dataset: { id }, 'aria-label': label, onclick: () => app.go(id) }, h('span.ni', {}, icon), label)));
$('#nav').append(navInner);

function refreshChrome() {
  const s = app.save, lv = levelFromXp(s.profile.xp);
  const title = cosmetic('title', s.equipped.title)?.name || '';
  $('#topbar').replaceChildren(
    h('button.pilot', { onclick: () => app.go('profile'), 'aria-label': 'Profile and settings' },
      h('div.lvl-ring', { style: { '--p': (lv.into / lv.need) * 100 } }, h('b', {}, lv.level)),
      h('div.pilot-meta', {}, h('b', {}, s.profile.name), h('small', {}, title))),
    h('div.wallet', {},
      h('button', { onclick: () => app.go('shop'), 'aria-label': 'Stardust' }, currency('stardust', s.wallet.stardust)),
      h('button', { onclick: () => app.go('shop'), 'aria-label': 'Void Crystals' }, currency('crystals', s.wallet.crystals)),
      h('button.icon-btn', { onclick: () => app.go('profile'), 'aria-label': 'Settings', style: { width: '36px', height: '36px', borderRadius: '999px' } }, '⚙️')));
  const badges = {
    quests: P.loginStatus(s).available || s.missions.list.some((m) => !m.claimed && m.progress >= (missionGoal(m.id))) || (!s.missions.bonusClaimed && s.missions.list.every((m) => m.claimed)),
    pass: P.claimablePassCount(s) > 0
  };
  navInner.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b.dataset.id === app.screen); b.classList.toggle('badge-dot', !!badges[b.dataset.id]); });
}
import { MISSION_BY_ID } from './data/missions.js';
const missionGoal = (id) => MISSION_BY_ID[id]?.goal ?? Infinity;

function renderScreen() {
  const root = $('#screens');
  const prevScroll = root.firstChild?.scrollTop || 0;
  const same = root.dataset.screen === app.screen;
  const el = SCREENS[app.screen](app);
  clear(root).append(el);
  root.dataset.screen = app.screen;
  if (same) { el.style.animation = 'none'; el.scrollTop = prevScroll; }
}

/* ---------------- feedback ---------------- */
function toast(text, kind = '') {
  const t = h(`div.toast${kind ? '.' + kind : ''}`, { role: 'status' }, text);
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2600);
}
function haptic(pattern) { if (app.save.settings.haptics && navigator.vibrate) try { navigator.vibrate(pattern); } catch { /* ignore */ } }
function describe(result) {
  const parts = [];
  if (result.stardust) parts.push(`+${fmt(result.stardust)} ✨`);
  if (result.crystals) parts.push(`+${fmt(result.crystals)} ◆`);
  if (result.passXp) parts.push(`+${fmt(result.passXp)} Pass XP`);
  if (result.item) parts.push(result.item.duplicate ? `${itemName(result.item.key)} (dupe → ✨)` : `Unlocked ${itemName(result.item.key)}`);
  return parts.join(' · ');
}
async function deliver(result, kind = 'gold') {
  if (!result) return;
  audio.play('claim'); haptic(15);
  const text = describe(result);
  if (text) toast(text, result.crystals ? 'crystal' : kind);
  app.commit(true);
  if (result.core) await openCoreFlow(app, result.core, { free: true });
  app.refresh();
}
function claimLogin() { const r = P.claimLogin(app.save); if (r) deliver(r.result); }
function claimMission(i) { deliver(P.claimMission(app.save, i)); }
function claimMissionBonus() { deliver(P.claimMissionBonus(app.save), 'crystal'); }
function claimPass(track, tier) { const r = P.claimPass(app.save, track, tier); if (r) deliver(r.result); }
async function claimAllPass() {
  const s = app.save, tier = P.passTier(s), cores = [];
  const total = { stardust: 0, crystals: 0 };
  for (let t = 1; t <= tier; t++) for (const track of ['free', 'premium']) {
    const r = P.claimPass(s, track, t);
    if (r) { total.stardust += r.result.stardust || 0; total.crystals += r.result.crystals || 0; if (r.result.core) cores.push(r.result.core); if (r.result.item?.isNew) toast(`Unlocked ${itemName(r.result.item.key)}`, 'gold'); }
  }
  app.commit(true); audio.play('claim');
  toast(describe(total) || 'Rewards claimed', 'gold');
  for (const c of cores) await openCoreFlow(app, c, { free: true });
  app.refresh();
}
function applySettings() {
  const s = app.save.settings;
  audio.setVolumes(s.sfx, s.music);
  renderer.setSettings({ shake: s.shake, reducedMotion: s.reducedMotion });
  document.body.classList.toggle('reduced', s.reducedMotion);
  document.body.classList.toggle('dpad-on', !!s.dpad);
}
function resetSave(next) {
  app.save = enforceInvariants(next);
  P.ensureMissions(app.save);
  persist(app.save, true);
  applySettings(); app.screen = 'home'; app.refresh();
  if (!app.save.profile.onboarded) runOnboarding();
}

/* ---------------- game session ---------------- */
let game = null, demo = null, runDone = false, deathTimer = null;
function newDemo() {
  const s = app.save.settings;
  const sector = s.lastMode === 'endless' && P.sectorUnlocked(app.save, s.lastSector) ? s.lastSector : s.lastMode === 'daily' ? dailySector() : 'orbit';
  demo = new Game({ demo: true, sector, mode: 'endless', species: app.save.equipped.species });
  applyLook(app.save.equipped.species);
}
function applyLook(speciesId) {
  const e = app.save.equipped, sp = SPECIES_BY_ID[speciesId];
  renderer.setLook({ skin: cosmetic('skin', e.skin), trail: cosmetic('trail', e.trail), crown: e.crown, fx: e.fx, speciesColors: sp.colors });
}
function startRun() {
  if (game && (game.state === 'playing' || game.state === 'countdown')) return;
  while (modalOpen() && closeTopModal()) { /* close menus */ }
  const s = app.save, set = s.settings;
  const mode = MODES[set.lastMode] ? set.lastMode : 'endless';
  let sector = mode === 'endless' ? set.lastSector : mode === 'daily' ? dailySector() : 'orbit';
  if (mode === 'endless' && !P.sectorUnlocked(s, sector)) sector = 'orbit';
  const seed = mode === 'daily' ? hashString('daily:' + dayKey()) >>> 0 : undefined;
  game = new Game({ mode, sector, species: s.equipped.species, upgrades: s.upgrades, seed });
  runDone = false; clearTimeout(deathTimer);
  applyLook(s.equipped.species);
  const sp = SPECIES_BY_ID[s.equipped.species];
  hud.reset(); hud.start(game, s.best[P.bestKeyFor(mode, sector)] || 0, ABILITY_ICON[sp.ability.id] || '⚡', sp.ability.name);
  hud.countdown(3);
  document.body.classList.remove('menu'); document.body.classList.add('playing');
  audio.init(); audio.play('count'); audio.setScene(SECTOR_BY_ID[sector].music, 0); audio.startMusic(SECTOR_BY_ID[sector].music);
  layout();
}
function endSession() {
  game = null; clearTimeout(deathTimer);
  document.body.classList.remove('playing'); document.body.classList.add('menu');
  hud.reset(); newDemo(); layout(); audio.setScene(SECTOR_BY_ID[demo.sector].music, 0);
  app.refresh();
}
function useAbility() { if (game?.useAbility()) haptic(12); }
function pause() {
  if (!game || !(game.state === 'playing' || game.state === 'countdown') || modalOpen()) return;
  game.state = 'paused'; hud.clearCountdown();
  pauseModal(app, {
    onResume: () => { if (game) { game.state = 'countdown'; game.count = 3; game.countT = 0; hud.countdown(3); } },
    onRestart: () => { finishRun(true); startRun(); },
    onQuit: () => finishRun()
  });
}
function onDeath() {
  if (!game || runDone) return;
  if (game.canRevive()) {
    reviveModal(app, game, {
      onRevive: (cost) => {
        if (!spend(app.save, cost, 'Revive')) { toast('Not enough Void Crystals', 'bad'); return finishRun(); }
        app.commit(true); game.revive(); hud.countdown(3); audio.play('claim');
      },
      onSkip: () => finishRun()
    });
  } else finishRun();
}
function finishRun(silent = false) {
  if (!game || runDone) return;
  runDone = true;
  const summary = game.summary();
  if (summary.timeMs < 1500 && summary.score === 0) { if (!silent) endSession(); return; }
  const r = P.processRun(app.save, summary);
  app.commit(true);
  if (silent) { toast(`Run saved · +${fmt(r.stardust)} ✨`); return; }
  audio.setScene(SECTOR_BY_ID[summary.sector].music, 0);
  if (r.levels.length) audio.play('level');
  resultsModal(app, summary, r, { onAgain: () => { startRun(); }, onHome: () => endSession() });
}

/* ---------------- events -> audio/hud ---------------- */
function handleEvents(events, g) {
  if (!events.length) return;
  renderer.handle(events, g);
  if (g.demo) return;
  for (const e of events) {
    switch (e.type) {
      case 'eat': audio.play(e.item.type === 'gold' ? 'gold' : 'eat', e.combo); if (e.combo === 5) hud.banner('MAX COMBO', 'x5 multiplier', '#FF4F8B'); break;
      case 'pickup': audio.play('pickup'); break;
      case 'crystal': audio.play('crystal'); haptic([20, 30, 40]); toast('◆ Void Crystal secured!', 'crystal'); break;
      case 'crystalSpawn': toast('◆ A Void Crystal appeared — grab it!', 'crystal'); break;
      case 'power': audio.play('power'); haptic(10); break;
      case 'ability': audio.play('ability'); break;
      case 'shieldBreak': audio.play('shield'); haptic([30, 20, 30]); break;
      case 'level': audio.play('level'); hud.banner(`LEVEL ${e.level}`, g.hazard === 'none' ? 'Speed up' : 'Faster · more hazards'); audio.setScene(g.sectorDef.music, Math.min(1, e.level / 10)); break;
      case 'count': audio.play('count'); hud.countdown(e.n); break;
      case 'go': audio.play('go'); hud.countdown(0); break;
      case 'storm': audio.play('storm'); hud.banner('SANDSTORM', 'Temporary rocks incoming', '#FF8A4C'); break;
      case 'pulse': audio.play('pulse'); break;
      case 'cut': audio.play('cut'); break;
      case 'die': audio.play('die'); haptic([40, 30, 80]); deathTimer = setTimeout(onDeath, 950); break;
      case 'timeUp': audio.play('timeUp'); hud.banner("TIME'S UP"); deathTimer = setTimeout(() => finishRun(), 900); break;
    }
  }
}

/* ---------------- loop ---------------- */
let last = performance.now(), demoDeadAt = 0;
function frame(t) {
  const dt = Math.min(50, t - last); last = t;
  const g = game || demo;
  g.update(dt);
  handleEvents(g.drain(), g);
  if (!game && demo.state === 'dead') { demoDeadAt ||= t; if (t - demoDeadAt > 1400) { demoDeadAt = 0; newDemo(); } }
  renderer.draw(g, t, dt);
  if (game) hud.update(game, t, app.save.settings.showFps);
  requestAnimationFrame(frame);
}

/* ---------------- layout ---------------- */
function layout() {
  const vw = innerWidth, vh = innerHeight;
  let top = 0, bottom = 0;
  if (game) { top = 98; bottom = isTouch ? (app.save.settings.dpad ? 130 : 110) : 24; }
  stage.style.top = top + 'px'; stage.style.bottom = bottom + 'px';
  const size = Math.max(200, Math.min(vw - 16, vh - top - bottom - 8, game ? 900 : 1100));
  renderer.resize(size, GRID);
}
addEventListener('resize', layout);

/* ---------------- input ---------------- */
const KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
addEventListener('keydown', (e) => {
  audio.init();
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) { if (k === 'Escape') e.target.blur(); return; }
  if (modalOpen()) { if (k === 'Escape') { e.preventDefault(); closeTopModal(); } return; }
  if (game && (game.state === 'playing' || game.state === 'countdown')) {
    if (KEYS[k]) { e.preventDefault(); game.queueDir(...KEYS[k]); return; }
    if (k === ' ' || k === 'e' || k === 'Shift') { e.preventDefault(); useAbility(); return; }
    if (k === 'Escape' || k === 'p') { e.preventDefault(); pause(); return; }
    return;
  }
  if (!game && k === 'Enter' && app.screen === 'home' && document.activeElement === document.body) { e.preventDefault(); startRun(); }
});
let swipe = null;
addEventListener('pointerdown', (e) => {
  audio.init();
  if (!game || e.target.closest('button')) return;
  swipe = { x: e.clientX, y: e.clientY };
});
addEventListener('pointermove', (e) => {
  if (!swipe || !game) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.hypot(dx, dy) > 20) { Math.abs(dx) > Math.abs(dy) ? game.queueDir(Math.sign(dx), 0) : game.queueDir(0, Math.sign(dy)); swipe = { x: e.clientX, y: e.clientY }; }
}, { passive: true });
addEventListener('pointerup', () => (swipe = null));
addEventListener('pointercancel', () => (swipe = null));
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); persist(app.save, true); } });
addEventListener('blur', () => pause());
addEventListener('pagehide', () => persist(app.save, true));

/* ---------------- boot ---------------- */
function runOnboarding() {
  onboarding(app, async () => {
    refreshChrome();
    await openCoreFlow(app, 'standard', { free: true, minRarity: 'rare' });
    toast(`Welcome aboard, ${app.save.profile.name}! 🚀`, 'gold');
    app.refresh();
  });
}
document.body.classList.add('menu');
applySettings();
newDemo();
layout();
app.refresh();
requestAnimationFrame(frame);
if (!app.save.profile.onboarded) setTimeout(runOnboarding, 400);
setInterval(() => { if (P.ensureMissions(app.save)) { app.commit(); if (!game) app.refresh(); } }, 60000);

if (import.meta.env?.PROD && 'serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
// Debug hook for automated tests (no gameplay authority — reads only).
window.__ns = { get game() { return game; }, get demo() { return demo; }, app, startRun, finishRun };
void defaultSave;
