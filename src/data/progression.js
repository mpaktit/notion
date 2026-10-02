/** Lab upgrades (soft-currency meta progression). Kept small so skill always matters most. */
export const UPGRADES = [
  { id: 'duration', name: 'Power Cells', desc: '+10% power-up duration per level.', icon: '🔋', max: 5, per: 0.1, cost: [600, 1200, 2400, 4200, 7000] },
  { id: 'yield', name: 'Dust Collector', desc: '+6% Stardust per level.', icon: '✨', max: 5, per: 0.06, cost: [800, 1600, 3000, 5000, 8000] },
  { id: 'combo', name: 'Reflex Chip', desc: '+250ms combo window per level.', icon: '⚡', max: 5, per: 250, cost: [700, 1400, 2600, 4400, 7200] },
  { id: 'luck', name: 'Lucky Charm', desc: '+3% power-up drop chance per level.', icon: '🍀', max: 5, per: 0.03, cost: [900, 1800, 3200, 5200, 8500] },
  { id: 'cooldown', name: 'Ability Coolant', desc: '-6% ability cooldown per level.', icon: '❄️', max: 5, per: 0.06, cost: [1000, 2000, 3600, 5800, 9000] }
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

/** Player level curve. */
export const xpForLevel = (level) => 400 + 150 * (level - 1);
export function levelFromXp(xp) {
  let level = 1, rest = xp;
  while (rest >= xpForLevel(level) && level < 200) { rest -= xpForLevel(level); level++; }
  return { level, into: rest, need: xpForLevel(level) };
}
/** Reward granted when reaching a new level. */
export const levelReward = (level) => (level % 5 === 0 ? { stardust: 300, crystals: 20 } : { stardust: 120 });

/** Battle pass — Season 1: Event Horizon. 30 tiers, 1000 pass XP each. */
export const PASS = {
  season: 1, name: 'Season 1 · Event Horizon', tierXp: 1000, tiers: 30, premiumCost: { crystals: 600 },
  free: {}, premium: {}
};
// Free track: steady soft currency, cores and a few cosmetics.
// Premium (600◆) returns 420◆ + 7 Prime Cores (~840◆ of value) + 8 exclusive cosmetics.
const F = PASS.free, P = PASS.premium;
for (let t = 1; t <= 30; t++) {
  F[t] = t % 5 === 0 ? { crystals: 15 } : t % 3 === 0 ? { core: 'standard' } : { stardust: 150 + t * 10 };
  P[t] = t % 4 === 0 ? { crystals: 60 } : t % 3 === 0 ? { core: 'prime' } : { stardust: 300 + t * 15 };
}
Object.assign(F, { 2: { item: 'trail:sparks' }, 8: { item: 'crown:antenna' }, 14: { item: 'skin:mint' }, 22: { item: 'title:hunter' }, 30: { item: 'skin:coral' } });
Object.assign(P, { 1: { item: 'skin:bee' }, 7: { item: 'trail:flame' }, 11: { item: 'crown:visor' }, 17: { item: 'skin:circuit' }, 23: { item: 'fx:supernova' }, 26: { item: 'trail:comet' }, 29: { item: 'title:eventhorizon' }, 30: { item: 'skin:singularity' } });

/** 7-day login streak calendar. */
export const LOGIN_REWARDS = [
  { stardust: 100 }, { stardust: 150 }, { core: 'standard' }, { stardust: 250 },
  { crystals: 5 }, { stardust: 400 }, { crystals: 25, core: 'prime' }
];
