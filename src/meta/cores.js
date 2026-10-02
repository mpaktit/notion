/**
 * Cosmic Cores (loot boxes) with published odds and pity timers.
 * Odds are shown in the UI before purchase — transparent by design.
 */
import { COSMETICS } from '../data/cosmetics.js';
import { SPECIES } from '../data/species.js';
import { RARITIES } from '../data/rarity.js';
import { spend, grantItem } from './economy.js';

export const CORES = {
  standard: {
    id: 'standard', name: 'Standard Core', cost: { stardust: 600 },
    odds: { common: 0.6, rare: 0.3, epic: 0.085, legendary: 0.014, mythic: 0.001 },
    pity: { every: 15, minRarity: 'epic', key: 'pityStandard' }
  },
  prime: {
    id: 'prime', name: 'Prime Core', cost: { crystals: 60 },
    odds: { common: 0, rare: 0.55, epic: 0.32, legendary: 0.11, mythic: 0.02 },
    pity: { every: 20, minRarity: 'legendary', key: 'pityPrime' }
  }
};

const rank = (r) => RARITIES.indexOf(r);

/** Item pool for a rarity: cosmetics (excluding starters) + species fragments of that rarity. */
export function poolFor(rarity) {
  const items = COSMETICS.filter((c) => c.rarity === rarity && !c.starter).map((c) => `${c.type}:${c.id}`);
  SPECIES.filter((s) => s.rarity === rarity && s.fragments).forEach((s) => items.push(`fragment:${s.id}`, `fragment:${s.id}`));
  return items;
}

export function rollRarity(core, rng, pityCount) {
  if (pityCount + 1 >= core.pity.every) {
    // Guarantee: re-roll within rarities >= minRarity, weighted by original odds.
    const table = Object.fromEntries(Object.entries(core.odds).filter(([r, w]) => rank(r) >= rank(core.pity.minRarity) && w > 0));
    return rng.weighted(table);
  }
  return rng.weighted(Object.fromEntries(Object.entries(core.odds).filter(([, w]) => w > 0)));
}

/**
 * Open a core. If `free` is true the cost is skipped (reward cores).
 * Returns null if unaffordable, else { rarity, key, result, pityTriggered }.
 */
export function openCore(save, coreId, rng, { free = false, minRarity = null } = {}) {
  const core = CORES[coreId];
  if (!core) return null;
  if (!free && !spend(save, core.cost, `Opened ${core.name}`)) return null;
  const pityCount = save.cores[core.pity.key] || 0;
  const pityTriggered = pityCount + 1 >= core.pity.every;
  let rarity = rollRarity(core, rng, pityCount);
  if (minRarity && rank(rarity) < rank(minRarity)) rarity = minRarity;
  save.cores[core.pity.key] = rank(rarity) >= rank(core.pity.minRarity) ? 0 : pityCount + 1;
  const pool = poolFor(rarity);
  const key = rng.pick(pool);
  const result = grantItem(save, key, core.name);
  save.stats.coresOpened++;
  return { rarity, key, result, pityTriggered };
}
