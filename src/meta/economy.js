/**
 * Single source of truth for every currency or inventory change.
 * All mutations go through grant()/spend() so balances stay valid and auditable.
 */
import { RARITY } from '../data/rarity.js';
import { COSMETIC_BY_KEY } from '../data/cosmetics.js';
import { SPECIES_BY_ID } from '../data/species.js';

const LEDGER_MAX = 60;
const CURRENCIES = ['stardust', 'crystals'];

function log(save, entry) {
  save.ledger.unshift({ t: Date.now(), ...entry });
  if (save.ledger.length > LEDGER_MAX) save.ledger.length = LEDGER_MAX;
}

export function canAfford(save, cost = {}) {
  return CURRENCIES.every((c) => !cost[c] || save.wallet[c] >= cost[c]);
}

/** Atomically spend a cost. Returns false (and changes nothing) if unaffordable or invalid. */
export function spend(save, cost, reason) {
  if (!cost || typeof cost !== 'object') return false;
  for (const c of CURRENCIES) if (cost[c] != null && (!Number.isInteger(cost[c]) || cost[c] < 0)) return false;
  if (!canAfford(save, cost)) return false;
  for (const c of CURRENCIES) if (cost[c]) { save.wallet[c] -= cost[c]; log(save, { cur: c, amt: -cost[c], reason }); }
  return true;
}

export function owns(save, type, id) {
  return (save.owned[type] || []).includes(id);
}

/** Add an item. Duplicates convert to a Stardust refund. Returns a description of what happened. */
export function grantItem(save, key, reason) {
  const [type, id] = key.split(':');
  if (type === 'species') {
    if (!SPECIES_BY_ID[id]) return { key, invalid: true };
    if (owns(save, 'species', id)) return { key, duplicate: true, ...grantCurrency(save, { stardust: RARITY[SPECIES_BY_ID[id].rarity].refund }, reason + ' (duplicate)') };
    save.owned.species.push(id);
    return { key, isNew: true };
  }
  if (type === 'fragment') {
    const sp = SPECIES_BY_ID[id];
    if (!sp) return { key, invalid: true };
    if (owns(save, 'species', id)) return { key, duplicate: true, ...grantCurrency(save, { stardust: 120 }, reason + ' (fragment)') };
    save.fragments[id] = (save.fragments[id] || 0) + 1;
    let assembled = false;
    if (sp.fragments && save.fragments[id] >= sp.fragments) { save.fragments[id] = 0; save.owned.species.push(id); assembled = true; }
    return { key, fragment: true, count: save.fragments[id], assembled };
  }
  const item = COSMETIC_BY_KEY[key];
  if (!item) return { key, invalid: true };
  if (owns(save, type, id)) {
    const refund = RARITY[item.rarity].refund;
    grantCurrency(save, { stardust: refund }, reason + ' (duplicate)');
    return { key, duplicate: true, refund };
  }
  save.owned[type].push(id);
  return { key, isNew: true };
}

function grantCurrency(save, r, reason) {
  const out = {};
  for (const c of CURRENCIES) {
    const v = Math.floor(r[c] || 0);
    if (v > 0) { save.wallet[c] = Math.min(10_000_000, save.wallet[c] + v); log(save, { cur: c, amt: v, reason }); out[c] = v; }
  }
  return out;
}

/**
 * Grant a reward bundle: { stardust, crystals, xp, passXp, core, item }.
 * Cores are queued in `pendingCores` so the UI can play the opening animation.
 */
export function grant(save, reward, reason) {
  const result = { ...grantCurrency(save, reward, reason) };
  if (reward.xp) { save.profile.xp += Math.floor(reward.xp); result.xp = Math.floor(reward.xp); }
  if (reward.passXp) { save.pass.xp += Math.floor(reward.passXp); result.passXp = Math.floor(reward.passXp); }
  if (reward.core) { result.core = reward.core; }
  if (reward.item) { result.item = grantItem(save, reward.item, reason); }
  return result;
}

export function equip(save, type, id) {
  if (!owns(save, type, id)) return false;
  save.equipped[type] = id;
  return true;
}
