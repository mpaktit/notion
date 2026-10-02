/** All menu screens. Each renderer returns a fresh DOM tree built from the save. */
import { h, fmt, currency, costLabel, bar, timeUntilMidnight } from './dom.js';
import { RARITY } from '../data/rarity.js';
import { SPECIES } from '../data/species.js';
import { SECTORS, SECTOR_BY_ID, MODES } from '../data/sectors.js';
import { COSMETICS, COSMETIC_TYPES } from '../data/cosmetics.js';
import { UPGRADES, PASS, LOGIN_REWARDS, levelFromXp } from '../data/progression.js';
import { MISSION_BY_ID, MISSION_BONUS } from '../data/missions.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { CORES } from '../meta/cores.js';
import { canAfford, owns, equip } from '../meta/economy.js';
import * as P from '../meta/progress.js';
import { itemArt, itemName, snakeCanvas, lookFor, rewardBits } from './art.js';
import { openCoreFlow, oddsModal, confirmDialog, modal, sanitizeName } from './modals.js';
import { exportCode, importCode, defaultSave } from '../core/storage.js';
import { dayKey } from '../core/rng.js';

const screen = (...children) => h('div.screen', {}, h('div.screen-inner', {}, ...children));
const section = (title, right, ...children) => h('div.section', {}, h('div.section-head', {}, h('h3', {}, title), right || null), ...children);

export function dailySector(day = dayKey()) {
  const n = day.split('-').reduce((a, b) => a + +b, 0);
  return SECTORS[n % SECTORS.length].id;
}

/* ================= HOME ================= */
export function Home(app) {
  const s = app.save, set = s.settings;
  const mode = MODES[set.lastMode] || MODES.endless;
  const login = P.loginStatus(s);
  const lv = levelFromXp(s.profile.xp);
  void lv;

  const modeSeg = h('div.seg', { role: 'tablist' }, ...Object.values(MODES).map((m) =>
    h(`button${m.id === mode.id ? '.on' : ''}`, { role: 'tab', 'aria-selected': m.id === mode.id, onclick: () => { set.lastMode = m.id; app.commit(); app.audio.play('click'); app.refresh(); } },
      m.id === 'daily' && !(s.dailyRun.day === dayKey() && s.dailyRun.cleared) ? '☀️ ' : '', m.name)));

  let sectorBlock = null;
  if (mode.id === 'endless') {
    sectorBlock = h('div.sectors', {}, ...SECTORS.map((sec) => {
      const unlocked = P.sectorUnlocked(s, sec.id);
      const best = s.best[`endless_${sec.id}`] || 0;
      return h(`button.sector${set.lastSector === sec.id ? '.on' : ''}${unlocked ? '' : '.locked'}`, {
        style: { background: `linear-gradient(160deg, ${sec.palette.bg}, #0B0E1C)` }, 'data-lock': `🔒 LEVEL ${sec.level}`,
        'aria-label': `${sec.name}${unlocked ? '' : ', locked until level ' + sec.level}`,
        onclick: () => { if (!unlocked) { app.toast(`Reach level ${sec.level} to unlock ${sec.name}`, 'bad'); app.audio.play('error'); return; } set.lastSector = sec.id; app.commit(); app.audio.play('click'); app.refresh(); }
      },
      h('div.planet', { style: { background: sec.id === 'horizon' ? 'radial-gradient(circle, #000 40%, #FFC93C 48%, transparent 62%)' : `radial-gradient(circle at 35% 35%, ${sec.palette.planet[0]}, ${sec.palette.planet[1]} 70%)`, boxShadow: `0 0 30px ${sec.palette.glow}55` } }),
      h('span.mult', {}, `✨ ×${sec.mult}`), h('b', {}, sec.name), h('small', {}, best ? `Best ${fmt(best)}` : sec.tagline));
    }));
  } else if (mode.id === 'daily') {
    const sec = SECTOR_BY_ID[dailySector()], cleared = s.dailyRun.day === dayKey() && s.dailyRun.cleared;
    sectorBlock = h('div.card', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
      h('div', { style: { fontSize: '30px' } }, '☀️'),
      h('div', { style: { flex: 1 } }, h('b', {}, `Today: ${sec.name}`), h('div.sub', { style: { fontSize: '13px' } }, cleared ? 'First clear bonus claimed. Practice runs still earn rewards.' : 'Same layout for every pilot. First run today earns ×2 Stardust.')),
      h('span.timer-pill', {}, 'Resets in ' + timeUntilMidnight()));
  }

  const sp = SPECIES.find((x) => x.id === s.equipped.species);
  const missionsDone = s.missions.list.filter((m) => m.claimed).length;
  const claimable = s.missions.list.some((m) => !m.claimed && m.progress >= (MISSION_BY_ID[m.id]?.goal ?? 1e9));

  return screen(
    h('div.hero', {}, h('div.logo', {}, 'NEON SERPENT'), h('div', {}, h('span.logo-sub', {}, 'COSMOS'))),
    login.available ? h('div.claim-banner', {}, h('span.ico', {}, '🎁'), h('div.t', {}, h('b', {}, `Day ${login.day} reward ready`), h('small', {}, 'Log in daily — day 7 drops a Prime Core.')),
      h('button.btn.gold.sm', { onclick: () => app.claimLogin() }, 'Claim')) : null,
    h('div.home-grid', {},
      h('div.panel', { style: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' } },
        h('h3', {}, 'Mode'), modeSeg, h('div.mode-desc', {}, mode.desc),
        sectorBlock ? h('h3', {}, mode.id === 'endless' ? 'Sector' : 'Daily Run') : null, sectorBlock,
        h('button.btn.primary.play-btn', { onclick: () => app.startRun(), 'data-autofocus': true }, 'PLAY'),
        h('div.hint-row', {}, h('span', {}, h('span.kbd', {}, 'Enter'), ' play'), h('span', {}, h('span.kbd', {}, 'Space'), ' ability'), h('span', {}, h('span.kbd', {}, 'Esc'), ' pause'))),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        h('button.card.loadout', { onclick: () => app.go('species') },
          snakeCanvas(lookFor(s), 192, 112),
          h('div.meta', { style: { textAlign: 'left' } }, h(`span.rarity.r-${sp.rarity}`, {}, RARITY[sp.rarity].name), h('b', {}, sp.name), h('small', {}, `⚡ ${sp.ability.name} — ${sp.ability.desc}`)),
          h('span', { style: { color: 'var(--muted)' } }, '›')),
        h('div.quick', {},
          h(`button.card${claimable ? '.badge-dot' : ''}`, { onclick: () => app.go('quests') }, h('span', { style: { fontSize: '20px' } }, '🎯'), h('b', {}, 'Missions'), h('small', {}, `${missionsDone}/3 done`)),
          h(`button.card${P.claimablePassCount(s) ? '.badge-dot' : ''}`, { onclick: () => app.go('pass') }, h('span', { style: { fontSize: '20px' } }, '🎟️'), h('b', {}, 'Pass'), h('small', {}, `Tier ${P.passTier(s)}/${PASS.tiers}`)),
          h('button.card', { onclick: () => app.go('shop') }, h('span', { style: { fontSize: '20px' } }, '🛒'), h('b', {}, 'Shop'), h('small', {}, `New in ${timeUntilMidnight()}`))),
        h('div.card', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
          h('div.core-orb.standard', { style: { width: '44px', height: '44px' } }),
          h('div', { style: { flex: 1 } }, h('b', {}, 'Standard Core'), h('div.sub', { style: { fontSize: '12.5px' } }, 'Skins, trails, crowns & species fragments')),
          h('button.btn.sm', { onclick: () => openCoreFlow(app, 'standard') }, costLabel(CORES.standard.cost)))))
  );
}

/* ================= SPECIES ================= */
export function Species(app) {
  const s = app.save;
  const statRow = (k, v) => [h('span', {}, k), h('div.pips', {}, ...[1, 2, 3, 4, 5].map((i) => h(`i${i <= v ? '.on' : ''}`)))];
  return screen(
    h('div', {}, h('h2', {}, 'Species'), h('p.sub', {}, 'Each serpent has unique stats, an active ability and a passive. Rare species drop as fragments from Cores.')),
    h('div.grid', {}, ...SPECIES.map((sp) => {
      const own = owns(s, 'species', sp.id), eq = s.equipped.species === sp.id;
      const frag = s.fragments[sp.id] || 0;
      let action;
      if (eq) action = h('button.btn.block', { disabled: true }, '✓ Equipped');
      else if (own) action = h('button.btn.primary.block', { onclick: () => { equip(s, 'species', sp.id); app.commit(); app.audio.play('click'); app.toast(`${sp.name} ready for launch`); app.refresh(); } }, 'Equip');
      else action = h('button.btn.block', { class: sp.cost?.crystals ? 'premium' : '', onclick: async () => {
        if (!canAfford(s, sp.cost)) { app.toast('Not enough currency', 'bad'); app.audio.play('error'); return; }
        if (!(await confirmDialog({ title: `Unlock ${sp.name}?`, text: `This costs ${sp.cost.crystals ? sp.cost.crystals + ' Void Crystals' : fmt(sp.cost.stardust) + ' Stardust'}.`, ok: 'Unlock' }))) return;
        if (P.buySpecies(s, sp.id)) { equip(s, 'species', sp.id); app.commit(); app.audio.play('buy'); app.toast(`🧬 ${sp.name} unlocked!`, 'gold'); app.refresh(); }
      } }, 'Unlock · ', costLabel(sp.cost));
      return h(`div.card.sp-card.rb-${sp.rarity}`, {},
        snakeCanvas(sp.colors[0] === 'rainbow' ? { pattern: 'rainbow', colors: ['#fff', '#fff'] } : { pattern: 'gradient', colors: sp.colors }, 260, 86),
        h('div.row', {}, h(`span.rarity.r-${sp.rarity}`, {}, RARITY[sp.rarity].name), eq ? h('span.equipped-tag', {}, 'EQUIPPED') : !own && sp.fragments ? h('small.sub', {}, `🧩 ${frag}/${sp.fragments}`) : null),
        h('div', {}, h('div.name', {}, sp.name), h('div.origin', {}, `Origin · ${sp.origin}`)),
        h('div.stats', {}, ...statRow('Speed', sp.stats.speed), ...statRow('Control', sp.stats.control), ...statRow('Luck', sp.stats.luck)),
        h('div.ability', {}, h('b', {}, `⚡ ${sp.ability.name}`), h('span', {}, ` · ${sp.ability.desc} (${sp.ability.cd}s)`)),
        h('div.ability', {}, h('b', {}, '◎ Passive'), h('span', {}, ` · ${sp.passive.text}`)),
        !own && sp.fragments ? bar(frag, sp.fragments, 'thin') : null,
        h('div.lore', {}, sp.lore),
        action);
    }))
  );
}

/* ================= LOCKER ================= */
export function Locker(app) {
  const s = app.save, tab = app.ui.lockerTab || 'skin';
  const items = COSMETICS.filter((c) => c.type === tab);
  const owned = items.filter((c) => owns(s, tab, c.id)).length;
  const titleName = COSMETICS.find((c) => c.type === 'title' && c.id === s.equipped.title)?.name;
  return screen(
    h('div.panel.locker-preview', {},
      snakeCanvas(lookFor(s), 360, 192),
      h('div', { style: { minWidth: 0 } }, h('h2', {}, s.profile.name), h('div.sub', {}, titleName),
        h('div.sub', { style: { fontSize: '12.5px', marginTop: '6px' } }, `Trail: ${itemName('trail:' + s.equipped.trail)} · Elimination: ${itemName('fx:' + s.equipped.fx)}`))),
    h('div.seg', {}, ...COSMETIC_TYPES.map((t) => h(`button${t.type === tab ? '.on' : ''}`, { onclick: () => { app.ui.lockerTab = t.type; app.refresh(); } }, t.name))),
    h('div.section-head', {}, h('h3', {}, `${owned}/${items.length} collected`), h('small.sub', {}, 'Cosmetics never affect gameplay.')),
    h('div.grid.sm', {}, ...items.map((c) => {
      const own = owns(s, tab, c.id), on = s.equipped[tab] === c.id, key = `${tab}:${c.id}`;
      return h(`button.card.tile.rb-${c.rarity}${on ? '.on' : ''}${own ? '' : '.locked'}`, {
        'aria-label': `${c.name}${own ? '' : ' (locked)'}`,
        onclick: () => {
          if (!own) { app.toast('Find it in Cores, the Shop or the Pass', 'bad'); return; }
          equip(s, tab, c.id); app.commit(); app.audio.play('click'); app.refresh();
        }
      }, h('div.art', {}, itemArt(key, s, 180, 80), own ? null : h('span.lock-ico', {}, '🔒')),
      h(`span.rarity.r-${c.rarity}`, { style: { alignSelf: 'flex-start' } }, RARITY[c.rarity].name), h('b', {}, c.name), h('small', {}, on ? '✓ Equipped' : own ? 'Tap to equip' : c.desc || 'Locked'));
    }))
  );
}

/* ================= SHOP ================= */
export function Shop(app) {
  const s = app.save, offers = P.shopOffers();
  const packs = [
    { amt: 100, price: '$0.99' }, { amt: 550, price: '$4.99', bonus: '+10%' },
    { amt: 1200, price: '$9.99', bonus: '+20%', tag: 'POPULAR' }, { amt: 2600, price: '$19.99', bonus: '+30%', tag: 'BEST VALUE' }
  ];
  return screen(
    section('Featured today', h('span.timer-pill', {}, 'Resets in ' + timeUntilMidnight()),
      h('div.grid', {}, ...offers.map((o) => {
        const [type, id] = o.key.split(':'), own = owns(s, type, id);
        return h(`div.card.offer.rb-${o.item.rarity}`, {},
          h('div.tile', { style: { padding: 0 } }, h('div.art', { style: { height: '96px' } }, itemArt(o.key, s, 220, 96))),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h(`span.rarity.r-${o.item.rarity}`, {}, RARITY[o.item.rarity].name), h('small.sub', {}, o.item.type === 'fx' ? 'Elimination' : o.item.type[0].toUpperCase() + o.item.type.slice(1))),
          h('b', {}, o.item.name),
          own ? h('button.btn.block', { disabled: true }, '✓ Owned') : h('button.btn.block', { class: o.price.crystals ? 'premium' : '', onclick: async () => {
            if (!canAfford(s, o.price)) { app.toast('Not enough currency', 'bad'); app.audio.play('error'); return; }
            if (o.price.crystals && !(await confirmDialog({ title: `Buy ${o.item.name}?`, text: `Spend ${o.price.crystals} Void Crystals.`, ok: 'Buy' }))) return;
            const r = P.buyOffer(s, o.key);
            if (r.ok) { app.commit(true); app.audio.play('buy'); app.toast(`Purchased ${o.item.name}`, 'gold'); app.refresh(); } else app.toast(r.reason, 'bad');
          } }, costLabel(o.price)));
      }))),
    section('Cosmic Cores', null,
      h('div.grid', { style: { gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' } }, ...Object.values(CORES).map((c) => h('div.card.core-card', {},
        h(`div.core-orb.${c.id}`),
        h('div.meta', {}, h('b', {}, c.name),
          h('small.sub', {}, c.id === 'prime' ? 'Rare or better. 13% Legendary+.' : 'Anything can drop — even Mythic.'),
          h('small.sub', {}, `Pity: ${s.cores[c.pity.key] || 0}/${c.pity.every} to guaranteed ${RARITY[c.pity.minRarity].name}`),
          h('div.actions', {}, h('button.btn.sm', { class: c.id === 'prime' ? 'premium' : 'primary', onclick: () => openCoreFlow(app, c.id) }, 'Open · ', costLabel(c.cost)),
            h('button.btn.sm.ghost', { onclick: () => oddsModal(c.id) }, 'Drop rates'))))))),
    section('Lab upgrades', h('small.sub', {}, 'Permanent. Paid with Stardust only.'),
      h('div.grid', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' } }, ...UPGRADES.map((u) => {
        const lvl = s.upgrades[u.id] || 0, cost = P.upgradeCost(s, u.id);
        return h('div.card.upg', {}, h('div.ico', {}, u.icon),
          h('div.meta', {}, h('b', {}, u.name), h('small', {}, u.desc), h('div.lvl-pips', {}, ...Array.from({ length: u.max }, (_, i) => h(`i${i < lvl ? '.on' : ''}`)))),
          cost ? h('button.btn.sm', { onclick: () => {
            if (P.buyUpgrade(s, u.id)) { app.commit(true); app.audio.play('buy'); app.toast(`${u.name} → level ${lvl + 1}`, 'gold'); app.refresh(); } else { app.toast('Not enough Stardust', 'bad'); app.audio.play('error'); }
          } }, costLabel(cost)) : h('span.equipped-tag', {}, 'MAX'));
      }))),
    section('Void Crystals', h('small.sub', {}, 'Earn free ◆ from missions, the pass, levels & achievements.'),
      h('div.grid.sm', {}, ...packs.map((p) => h('div.card.pack', {},
        p.tag ? h('span.ribbon', {}, p.tag) : null,
        h('div.gem', {}, '◆'), h('div.amt', {}, fmt(p.amt)), p.bonus ? h('div.bonus', {}, p.bonus + ' bonus') : h('div.bonus', { style: { visibility: 'hidden' } }, '·'),
        h('button.btn.sm.block', { onclick: () => modal((close) => [h('h2', {}, 'Store opening soon'), h('p.sub', {}, 'Secure checkout launches with player accounts in v1.1. Until then, every Void Crystal is earnable for free by playing.'), h('button.btn.primary.block', { onclick: () => close() }, 'Got it')]) }, p.price)))))
  );
}

/* ================= PASS ================= */
export function Pass(app) {
  const s = app.save, tier = P.passTier(s), into = s.pass.xp - tier * PASS.tierXp;
  const cell = (track, t) => {
    const reward = (track === 'premium' ? PASS.premium : PASS.free)[t];
    const claimed = (track === 'premium' ? s.pass.claimedPremium : s.pass.claimedFree).includes(t);
    const reachable = t <= tier, lockedPremium = track === 'premium' && !s.pass.premium;
    const can = reachable && !claimed && !lockedPremium;
    const bits = rewardBits(reward);
    return h(`div.reward${track === 'premium' ? '.premium' : ''}${claimed ? '.claimed' : can ? '.claimable' : ''}${lockedPremium ? '.locked' : ''}`, {
      role: can ? 'button' : null, tabindex: can ? 0 : null,
      onclick: can ? () => app.claimPass(track, t) : null
    }, bits.item ? h('div', { style: { width: '90px', height: '50px', display: 'grid', placeItems: 'center', fontSize: '26px' } }, itemArt(bits.item, s, 90, 50)) : h('div.ri', { style: { color: bits.cls === 'crystal' ? 'var(--crystal)' : bits.cls === 'dust' ? 'var(--dust)' : '' } }, bits.icon),
    h('small', { style: { fontWeight: 700 } }, bits.label), can ? h('small', { style: { color: 'var(--accent)', fontWeight: 800 } }, 'CLAIM') : null);
  };
  const claimAll = P.claimablePassCount(s);
  return screen(
    h('div.panel.pass-head', {},
      h('div.row', {}, h('div', {}, h('h3', {}, PASS.name), h('div.tier-big', {}, `Tier ${tier}`, h('span', { style: { fontSize: '16px', color: 'var(--muted)' } }, ` / ${PASS.tiers}`))),
        s.pass.premium ? h('span.rarity.r-mythic', { style: { fontSize: '12px', padding: '6px 10px' } }, '★ PREMIUM ACTIVE')
          : h('button.btn.premium', { onclick: async () => {
            if (!canAfford(s, PASS.premiumCost)) { app.toast(`Premium Pass needs ${PASS.premiumCost.crystals} ◆`, 'bad'); return; }
            if (!(await confirmDialog({ title: 'Unlock Premium Pass?', text: `Spend ${PASS.premiumCost.crystals} Void Crystals. The premium track pays back ${Object.values(PASS.premium).reduce((a, r) => a + (r.crystals || 0), 0)} ◆ plus exclusive cosmetics.`, ok: 'Unlock' }))) return;
            if (P.buyPremiumPass(s)) { app.commit(true); app.audio.play('buy'); app.toast('★ Premium Pass unlocked', 'crystal'); app.refresh(); }
          } }, 'Unlock Premium · ', currency('crystals', PASS.premiumCost.crystals))),
      tier < PASS.tiers ? h('div', {}, bar(into, PASS.tierXp, 'gold'), h('small.sub', {}, `${fmt(into)} / ${fmt(PASS.tierXp)} XP to tier ${tier + 1} · earn Pass XP from every run and mission`)) : h('b', {}, 'Season complete! 🏆'),
      claimAll ? h('button.btn.primary', { style: { alignSelf: 'flex-start' }, onclick: () => app.claimAllPass() }, `Claim all (${claimAll})`) : null),
    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: 'var(--muted)' } }, h('span', {}, 'Top: Free track'), h('span', {}, '·'), h('span', { style: { color: 'var(--epic)' } }, 'Bottom: Premium track')),
    h('div.track', {}, ...Array.from({ length: PASS.tiers }, (_, i) => i + 1).map((t) => h(`div.tier${t <= tier ? '.reached' : ''}`, {}, h('div.num', {}, t), cell('free', t), cell('premium', t))))
  );
}

/* ================= QUESTS ================= */
export function Quests(app) {
  const s = app.save, login = P.loginStatus(s);
  const curDay = login.available ? login.day : s.daily.streak;
  const cycleStart = Math.floor((Math.max(1, curDay) - 1) / 7) * 7;
  const allClaimed = s.missions.list.every((m) => m.claimed);
  return screen(
    section('Daily login', h('small.sub', {}, `Streak ${s.daily.streak} day${s.daily.streak === 1 ? '' : 's'}`),
      h('div.calendar', {}, ...LOGIN_REWARDS.map((r, i) => {
        const d = cycleStart + i + 1, done = d < curDay || (d === curDay && !login.available), today = d === curDay && login.available;
        const b = rewardBits(r);
        return h(`div.day${done ? '.done' : ''}${today ? '.today' : ''}`, { role: today ? 'button' : null, tabindex: today ? 0 : null, onclick: today ? () => app.claimLogin() : null },
          h('small', {}, `Day ${d}`), h('div.di', { style: { color: b.cls === 'crystal' ? 'var(--crystal)' : b.cls === 'dust' ? 'var(--dust)' : '' } }, done ? '✓' : b.icon), h('span', {}, b.label));
      })),
      login.available ? h('button.btn.gold', { onclick: () => app.claimLogin() }, `Claim day ${login.day}`) : h('small.sub', {}, `Next reward in ${timeUntilMidnight()}`)),
    section('Daily missions', h('span.timer-pill', {}, 'Resets in ' + timeUntilMidnight()),
      ...s.missions.list.map((m, i) => {
        const def = MISSION_BY_ID[m.id]; if (!def) return null;
        const done = m.progress >= def.goal;
        return h('div.card.mission', {},
          h('div', { style: { fontSize: '24px' } }, m.claimed ? '✅' : done ? '🎁' : '🎯'),
          h('div.meta', {}, h('b', {}, def.text), bar(m.progress, def.goal, 'thin'),
            h('div.reward-line', {}, h('span', {}, `${fmt(m.progress)}/${fmt(def.goal)}`), currency('stardust', def.reward.stardust), h('span', {}, `+${def.reward.passXp} Pass XP`))),
          m.claimed ? h('span.equipped-tag', {}, 'DONE')
            : done ? h('button.btn.primary.sm', { onclick: () => app.claimMission(i) }, 'Claim')
              : !s.missions.rerolled ? h('button.btn.sm.ghost', { title: 'Swap this mission (once per day)', onclick: () => { if (P.rerollMission(s, i)) { app.commit(); app.toast('Mission swapped'); app.refresh(); } } }, 'Swap') : null);
      }),
      h('div.card', { style: { display: 'flex', alignItems: 'center', gap: '12px', borderColor: allClaimed && !s.missions.bonusClaimed ? 'var(--crystal)' : '' } },
        h('div', { style: { fontSize: '24px' } }, '💎'),
        h('div', { style: { flex: 1 } }, h('b', {}, 'Complete all 3'), h('div.sub', { style: { fontSize: '12.5px' } }, 'Bonus: ', currency('crystals', MISSION_BONUS.crystals), ` + ${MISSION_BONUS.passXp} Pass XP`)),
        s.missions.bonusClaimed ? h('span.equipped-tag', {}, 'DONE') : h('button.btn.premium.sm', { disabled: !allClaimed, onclick: () => app.claimMissionBonus() }, 'Claim'))),
    section('Achievements', h('small.sub', {}, `${Object.keys(s.achievements).length}/${ACHIEVEMENTS.length}`),
      h('div.grid', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' } }, ...ACHIEVEMENTS.map((a) => {
        const done = !!s.achievements[a.id];
        return h(`div.card.ach${done ? '.done' : ''}`, {}, h('div.ai', {}, done ? '🏆' : '🔒'), h('div.meta', {}, h('b', {}, a.name), h('small', {}, a.desc)), currency('crystals', a.reward.crystals));
      })))
  );
}

/* ================= PROFILE ================= */
export function Profile(app) {
  const s = app.save, st = s.stats, lv = levelFromXp(s.profile.xp), set = s.settings;
  const nameInput = h('input.text-input', { value: s.profile.name, maxLength: 16, 'aria-label': 'Pilot name', onchange: (e) => { const v = sanitizeName(e.target.value); s.profile.name = v || 'Pilot'; e.target.value = s.profile.name; app.commit(); app.refreshChrome(); app.toast('Name saved'); } });
  const toggle = (key, label, desc) => h('div.setting', {}, h('div', {}, h('b', {}, label), desc ? h('small', {}, desc) : null),
    h(`button.switch${set[key] ? '.on' : ''}`, { role: 'switch', 'aria-checked': !!set[key], 'aria-label': label, onclick: () => { set[key] = !set[key]; app.commit(); app.applySettings(); app.refresh(); } }));
  const slider = (key, label) => h('div.setting', {}, h('b', {}, label), h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: set[key], 'aria-label': label, oninput: (e) => { set[key] = +e.target.value; app.applySettings(); }, onchange: () => app.commit() }));
  const bests = Object.entries(s.best).sort((a, b) => b[1] - a[1]);
  const labelFor = (k) => { const [m, sec] = k.split('_'); return `${MODES[m]?.name || m}${sec !== 'all' ? ' · ' + (SECTOR_BY_ID[sec]?.name || sec) : ''}`; };
  return screen(
    h('div.panel', { style: { padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' } },
      h('div.lvl-ring', { style: { '--p': (lv.into / lv.need) * 100, width: '64px', height: '64px' } }, h('b', { style: { width: '54px', height: '54px', fontSize: '20px' } }, lv.level)),
      h('div', { style: { flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '6px' } }, h('small.sub', {}, 'Pilot name'), nameInput,
        h('small.sub', {}, `Level ${lv.level} · ${fmt(lv.into)}/${fmt(lv.need)} XP`))),
    section('Career', null, h('div.stat-grid', {}, ...[
      ['Runs', st.runs], ['Best score', st.bestScore], ['Orbs eaten', st.food], ['Best combo', 'x' + Math.min(5, st.bestCombo)], ['Longest', st.longest],
      ['Golden stars', st.golds], ['Power-ups', st.powerups], ['Crystals found', st.crystalsFound], ['Cores opened', st.coresOpened], ['Play time', `${Math.floor(st.playtimeMs / 3600000)}h ${Math.floor((st.playtimeMs % 3600000) / 60000)}m`]
    ].map(([k, v]) => h('div.card.stat', {}, h('small', {}, k), h('b', {}, typeof v === 'number' ? fmt(v) : v))))),
    bests.length ? section('Personal bests', null, h('div.panel', {}, ...bests.map(([k, v]) => h('div.setting', {}, h('span', {}, labelFor(k)), h('b', {}, fmt(v)))))) : null,
    section('Settings', null, h('div.panel', {},
      slider('music', 'Music'), slider('sfx', 'Sound effects'),
      toggle('shake', 'Screen shake', 'Impact feedback on hits and big moments.'),
      toggle('reducedMotion', 'Reduced motion', 'Fewer particles and animations.'),
      toggle('haptics', 'Haptics', 'Vibration on supported phones.'),
      toggle('dpad', 'On-screen D-pad', 'Touch devices: show arrow buttons in addition to swipe.'),
      toggle('showFps', 'Show FPS', 'Performance overlay.'))),
    section('Save data', null, h('div.panel', {},
      h('div.setting', {}, h('div', {}, h('b', {}, 'Backup code'), h('small', {}, 'Copy your progress to another device.')), h('button.btn.sm', { onclick: () => backupModal(app) }, 'Export / Import')),
      h('div.setting', {}, h('div', {}, h('b', {}, 'Reset progress'), h('small', {}, 'Permanently erase everything on this device.')),
        h('button.btn.sm', { style: { color: 'var(--danger)' }, onclick: async () => {
          if (await confirmDialog({ title: 'Erase all progress?', text: 'This cannot be undone. Export a backup first if you might want it back.', ok: 'Erase', danger: true })) app.resetSave(defaultSave());
        } }, 'Reset')))),
    h('p.sub', { style: { textAlign: 'center', fontSize: '12px' } }, `Neon Serpent: Cosmos v${app.version} · Progress is saved on this device.`)
  );
}

function backupModal(app) {
  const code = exportCode(app.save);
  const out = h('textarea.text-input', { readOnly: true, value: code, 'aria-label': 'Backup code', onfocus: (e) => e.target.select() });
  const inp = h('textarea.text-input', { placeholder: 'Paste a backup code to import…', 'aria-label': 'Import code' });
  modal((close) => [
    h('h2', {}, 'Backup & restore'),
    h('small.sub', {}, 'Your backup code'), out,
    h('button.btn.sm', { onclick: async () => { try { await navigator.clipboard.writeText(code); app.toast('Copied to clipboard'); } catch { out.select(); app.toast('Select and copy the code'); } } }, 'Copy code'),
    h('small.sub', {}, 'Import'), inp,
    h('div.actions', {}, h('button.btn', { onclick: () => close() }, 'Close'),
      h('button.btn.primary', { onclick: async () => {
        const r = importCode(inp.value);
        if (!r.ok) { app.toast(r.reason, 'bad'); return; }
        if (!(await confirmDialog({ title: 'Replace current progress?', text: 'Importing overwrites the progress on this device.', ok: 'Import', danger: true }))) return;
        close(); app.resetSave(r.save); app.toast('Progress imported ✓');
      } }, 'Import'))
  ], { wide: true });
}

export const SCREENS = { home: Home, species: Species, locker: Locker, shop: Shop, pass: Pass, quests: Quests, profile: Profile };
