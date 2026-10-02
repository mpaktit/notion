/**
 * Meta-progression: run rewards, levels, missions, daily login, battle pass,
 * achievements, shop rotation, Lab upgrades and species purchases.
 * Pure functions over the save object — fully unit-testable.
 */
import { Rng, dayKey, dayDiff } from '../core/rng.js';
import { MISSION_POOL, MISSION_BY_ID, MISSION_BONUS } from '../data/missions.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { PASS, LOGIN_REWARDS, levelFromXp, levelReward, UPGRADE_BY_ID } from '../data/progression.js';
import { SECTORS, SECTOR_BY_ID } from '../data/sectors.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { COSMETICS, PRICE } from '../data/cosmetics.js';
import { grant, spend, owns } from './economy.js';

/* ---------------- levels ---------------- */
/** Recompute level from XP, granting each newly reached level's reward. */
export function syncLevel(save) {
  const { level } = levelFromXp(save.profile.xp);
  const gained = [];
  while (save.profile.level < level) {
    save.profile.level++;
    const r = levelReward(save.profile.level);
    grant(save, r, `Reached level ${save.profile.level}`);
    gained.push({ level: save.profile.level, reward: r });
  }
  return gained;
}
export const sectorUnlocked = (save, id) => save.profile.level >= (SECTOR_BY_ID[id]?.level ?? 999);
export const unlockedSectors = (save) => SECTORS.filter((s) => sectorUnlocked(save, s.id));

/* ---------------- missions ---------------- */
export function ensureMissions(save, today = dayKey()) {
  if (save.missions.day === today && save.missions.list.length === 3) return false;
  const rng = new Rng('missions:' + today);
  const picks = rng.shuffle(MISSION_POOL).slice(0, 3);
  save.missions = { day: today, list: picks.map((m) => ({ id: m.id, progress: 0, claimed: false })), rerolled: false, bonusClaimed: false };
  return true;
}
export function rerollMission(save, index, rng = new Rng()) {
  if (save.missions.rerolled) return false;
  const m = save.missions.list[index];
  if (!m || m.claimed) return false;
  const used = new Set(save.missions.list.map((x) => x.id));
  const options = MISSION_POOL.filter((p) => !used.has(p.id));
  if (!options.length) return false;
  save.missions.list[index] = { id: rng.pick(options).id, progress: 0, claimed: false };
  save.missions.rerolled = true;
  return true;
}
export function applyMissionProgress(save, summary) {
  for (const m of save.missions.list) {
    const def = MISSION_BY_ID[m.id];
    if (!def || m.claimed) continue;
    const v = summary[def.stat] || 0;
    m.progress = Math.min(def.goal, def.kind === 'sum' ? m.progress + v : Math.max(m.progress, v));
  }
}
export function claimMission(save, index) {
  const m = save.missions.list[index];
  const def = m && MISSION_BY_ID[m.id];
  if (!def || m.claimed || m.progress < def.goal) return null;
  m.claimed = true;
  return grant(save, def.reward, `Mission: ${def.text}`);
}
export function claimMissionBonus(save) {
  if (save.missions.bonusClaimed || !save.missions.list.every((m) => m.claimed)) return null;
  save.missions.bonusClaimed = true;
  return grant(save, MISSION_BONUS, 'All daily missions');
}

/* ---------------- daily login ---------------- */
export function loginStatus(save, today = dayKey()) {
  if (save.daily.lastClaim === today) return { available: false, day: save.daily.streak };
  const gap = save.daily.lastClaim ? dayDiff(save.daily.lastClaim, today) : 99;
  const nextStreak = gap === 1 ? save.daily.streak + 1 : 1;
  return { available: true, day: nextStreak, reward: LOGIN_REWARDS[(nextStreak - 1) % 7] };
}
export function claimLogin(save, today = dayKey()) {
  const st = loginStatus(save, today);
  if (!st.available) return null;
  save.daily.streak = st.day;
  save.daily.lastClaim = today;
  return { day: st.day, reward: st.reward, result: grant(save, st.reward, `Daily login day ${st.day}`) };
}

/* ---------------- battle pass ---------------- */
export const passTier = (save) => Math.min(PASS.tiers, Math.floor(save.pass.xp / PASS.tierXp));
export function claimPass(save, track, tier) {
  const list = track === 'premium' ? save.pass.claimedPremium : save.pass.claimedFree;
  if (track === 'premium' && !save.pass.premium) return null;
  if (tier < 1 || tier > passTier(save) || list.includes(tier)) return null;
  const reward = (track === 'premium' ? PASS.premium : PASS.free)[tier];
  list.push(tier);
  return { reward, result: grant(save, reward, `Pass tier ${tier} (${track})`) };
}
export function buyPremiumPass(save) {
  if (save.pass.premium) return false;
  if (!spend(save, PASS.premiumCost, 'Premium Pass')) return false;
  save.pass.premium = true;
  return true;
}
export function claimablePassCount(save) {
  const t = passTier(save);
  let n = 0;
  for (let i = 1; i <= t; i++) {
    if (!save.pass.claimedFree.includes(i)) n++;
    if (save.pass.premium && !save.pass.claimedPremium.includes(i)) n++;
  }
  return n;
}

/* ---------------- achievements ---------------- */
export function checkAchievements(save) {
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!save.achievements[a.id] && a.test(save)) {
      save.achievements[a.id] = true;
      grant(save, a.reward, `Achievement: ${a.name}`);
      unlocked.push(a);
    }
  }
  return unlocked;
}

/* ---------------- run rewards ---------------- */
/**
 * Convert a finished run into rewards and update all trackers.
 * `summary` comes from Game.summary(). `ctx.speciesDef` is the species used.
 */
export function processRun(save, summary, today = dayKey()) {
  const sector = SECTOR_BY_ID[summary.sector] || SECTOR_BY_ID.orbit;
  const sp = SPECIES_BY_ID[summary.species] || SPECIES_BY_ID.terran;
  const modeMult = summary.mode === 'classic' ? 1.15 : summary.mode === 'zen' ? 0.5 : 1;
  const upgradeMult = 1 + (save.upgrades.yield || 0) * UPGRADE_BY_ID.yield.per;
  const passiveMult = 1 + (sp.passive.stardustMult || 0) + (sp.passive.sectorBonus?.[sector.id] || 0);
  let dailyMult = 1, dailyFirst = false;
  if (summary.mode === 'daily' && !(save.dailyRun.day === today && save.dailyRun.cleared)) {
    dailyMult = 2; dailyFirst = true; save.dailyRun = { day: today, cleared: true };
  }
  const base = Math.floor(summary.score / 6);
  const stardust = Math.floor(base * sector.mult * modeMult * upgradeMult * passiveMult * dailyMult) + summary.stardustPicked;
  const xp = Math.floor(40 + summary.score / 4 + summary.food * 3 + summary.timeSec);
  const passXp = Math.floor(60 + summary.score / 3 + summary.food * 4);

  const before = { level: save.profile.level, tier: passTier(save) };
  grant(save, { stardust, crystals: summary.crystalsPicked, xp, passXp }, `Run: ${summary.mode}/${sector.id}`);

  const st = save.stats;
  st.runs++; st.food += summary.food; st.golds += summary.golds; st.powerups += summary.powerups;
  st.abilities += summary.abilities; st.playtimeMs += summary.timeMs; st.crystalsFound += summary.crystalsPicked;
  st.bestCombo = Math.max(st.bestCombo, summary.maxCombo); st.longest = Math.max(st.longest, summary.length);
  st.bestScore = Math.max(st.bestScore, summary.score);

  const bestKey = `${summary.mode}_${summary.mode === 'endless' ? sector.id : 'all'}`;
  const prevBest = save.best[bestKey] || 0;
  const newBest = summary.score > prevBest;
  if (newBest) save.best[bestKey] = summary.score;

  applyMissionProgress(save, { ...summary, runs: 1 });
  const levels = syncLevel(save);
  const achievements = checkAchievements(save);
  return {
    stardust, crystals: summary.crystalsPicked, xp, passXp, newBest, prevBest, bestKey, dailyFirst,
    levels, achievements, tiersGained: passTier(save) - before.tier
  };
}
export const bestKeyFor = (mode, sector) => `${mode}_${mode === 'endless' ? sector : 'all'}`;

/* ---------------- revive ---------------- */
export const reviveCost = (n) => ({ crystals: n === 0 ? 5 : 15 });

/* ---------------- shop ---------------- */
/** Four featured cosmetics that rotate daily (same for every player on a given day). */
export function shopOffers(today = dayKey()) {
  const rng = new Rng('shop:' + today);
  const byR = (r) => COSMETICS.filter((c) => c.rarity === r && !c.starter);
  const picks = [rng.pick(byR('common')), rng.pick(byR('rare')), rng.pick(byR('epic')), rng.pick(byR(rng.chance(0.25) ? 'mythic' : 'legendary'))];
  return picks.map((c) => ({ key: `${c.type}:${c.id}`, item: c, price: PRICE[c.rarity] }));
}
export function buyOffer(save, key, today = dayKey()) {
  const offer = shopOffers(today).find((o) => o.key === key);
  if (!offer) return { ok: false, reason: 'Offer expired.' };
  const [type, id] = key.split(':');
  if (owns(save, type, id)) return { ok: false, reason: 'Already owned.' };
  if (!spend(save, offer.price, `Shop: ${offer.item.name}`)) return { ok: false, reason: 'Not enough currency.' };
  save.owned[type].push(id);
  return { ok: true };
}

/* ---------------- lab & species ---------------- */
export function upgradeCost(save, id) {
  const u = UPGRADE_BY_ID[id];
  const lvl = save.upgrades[id] || 0;
  return u && lvl < u.max ? { stardust: u.cost[lvl] } : null;
}
export function buyUpgrade(save, id) {
  const cost = upgradeCost(save, id);
  if (!cost || !spend(save, cost, `Lab: ${UPGRADE_BY_ID[id].name}`)) return false;
  save.upgrades[id] = (save.upgrades[id] || 0) + 1;
  return true;
}
export function buySpecies(save, id) {
  const sp = SPECIES_BY_ID[id];
  if (!sp || !sp.cost || owns(save, 'species', id)) return false;
  if (!spend(save, sp.cost, `Species: ${sp.name}`)) return false;
  save.owned.species.push(id);
  return true;
}
