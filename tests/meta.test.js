import { describe, it, expect } from 'vitest';
import { defaultSave, serialize, deserialize, sanitize, exportCode, importCode } from '../src/core/storage.js';
import { spend, grant, grantItem, equip } from '../src/meta/economy.js';
import { openCore, CORES, poolFor } from '../src/meta/cores.js';
import { processRun, ensureMissions, claimMission, claimLogin, loginStatus, claimPass, buyPremiumPass, passTier, shopOffers, buyOffer, buyUpgrade, syncLevel } from '../src/meta/progress.js';
import { Rng, dayKey } from '../src/core/rng.js';
import { RARITIES } from '../src/data/rarity.js';

const summary = (o = {}) => ({ mode: 'endless', sector: 'orbit', species: 'terran', score: 600, food: 30, golds: 1, powerups: 2, abilities: 1, maxCombo: 4, length: 20, timeMs: 60000, timeSec: 60, level: 6, crystalsPicked: 0, stardustPicked: 24, reason: 'x', ...o });

describe('save system', () => {
  it('round-trips and detects tampering', () => {
    const s = defaultSave(); s.wallet.stardust = 1234;
    const r = deserialize(serialize(s));
    expect(r.tampered).toBe(false);
    expect(r.save.wallet.stardust).toBe(1234);
    const env = JSON.parse(serialize(s)); env.data.wallet.crystals = 999999;
    const t = deserialize(JSON.stringify(env));
    expect(t.tampered).toBe(true);
    expect(t.save.wallet.crystals).toBeLessThanOrEqual(50);
  });
  it('sanitizes garbage input without throwing', () => {
    const s = sanitize({ wallet: { stardust: 'lots', crystals: NaN }, profile: 5, owned: { skin: 'x' }, best: { '<script>': 5, ok: 10 } });
    expect(s.wallet.stardust).toBe(300);
    expect(s.profile.name).toBe('Pilot');
    expect(Array.isArray(s.owned.skin)).toBe(true);
    expect(s.best).toEqual({ ok: 10 });
    expect(deserialize('not json').ok).toBe(false);
  });
  it('export/import codes work and reject edits', () => {
    const s = defaultSave(); s.profile.xp = 777;
    const code = exportCode(s);
    expect(importCode(code).save.profile.xp).toBe(777);
    expect(importCode('garbage').ok).toBe(false);
  });
});

describe('economy', () => {
  it('spend is atomic and never goes negative', () => {
    const s = defaultSave();
    expect(spend(s, { stardust: 100, crystals: 999 }, 't')).toBe(false);
    expect(s.wallet.stardust).toBe(300);
    expect(spend(s, { stardust: -5 }, 't')).toBe(false);
    expect(spend(s, { stardust: 1.5 }, 't')).toBe(false);
    expect(spend(s, { stardust: 100 }, 't')).toBe(true);
    expect(s.wallet.stardust).toBe(200);
  });
  it('duplicates refund stardust', () => {
    const s = defaultSave();
    expect(grantItem(s, 'skin:sunset', 't').isNew).toBe(true);
    const before = s.wallet.stardust;
    expect(grantItem(s, 'skin:sunset', 't').duplicate).toBe(true);
    expect(s.wallet.stardust).toBe(before + 150);
  });
  it('fragments assemble a species', () => {
    const s = defaultSave();
    for (let i = 0; i < 10; i++) grantItem(s, 'fragment:drake', 't');
    expect(s.owned.species).toContain('drake');
  });
  it('cannot equip unowned items', () => {
    const s = defaultSave();
    expect(equip(s, 'skin', 'prism')).toBe(false);
    expect(equip(s, 'skin', 'neon')).toBe(true);
  });
});

describe('cores', () => {
  it('odds sum to 1 and every rarity has a pool', () => {
    for (const c of Object.values(CORES)) expect(Object.values(c.odds).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    for (const r of RARITIES) expect(poolFor(r).length).toBeGreaterThan(0);
  });
  it('prime core pity guarantees legendary+ within 20', () => {
    const s = defaultSave(); s.wallet.crystals = 60 * 200;
    const rng = new Rng(1);
    let since = 0, maxGap = 0;
    for (let i = 0; i < 200; i++) {
      const r = openCore(s, 'prime', rng);
      since++;
      if (r.rarity === 'legendary' || r.rarity === 'mythic') { maxGap = Math.max(maxGap, since); since = 0; }
    }
    expect(maxGap).toBeLessThanOrEqual(20);
  });
  it('fails when unaffordable', () => {
    const s = defaultSave(); s.wallet.crystals = 0;
    expect(openCore(s, 'prime', new Rng(1))).toBeNull();
  });
});

describe('progression', () => {
  it('processRun grants rewards and updates stats', () => {
    const s = defaultSave();
    const r = processRun(s, summary());
    expect(r.stardust).toBeGreaterThan(100);
    expect(s.stats.runs).toBe(1);
    expect(r.newBest).toBe(true);
    expect(s.best.endless_orbit).toBe(600);
  });
  it('daily run doubles stardust only once per day', () => {
    const s = defaultSave();
    const a = processRun(s, summary({ mode: 'daily' }), '2026-10-02');
    const b = processRun(s, summary({ mode: 'daily' }), '2026-10-02');
    expect(a.dailyFirst).toBe(true); expect(b.dailyFirst).toBe(false);
    expect(a.stardust).toBeGreaterThan(b.stardust);
  });
  it('levels up and grants level rewards', () => {
    const s = defaultSave(); s.profile.xp = 5000;
    const gained = syncLevel(s);
    expect(gained.length).toBeGreaterThan(3);
    expect(s.profile.level).toBe(gained.at(-1).level);
  });
  it('missions are deterministic per day and claimable', () => {
    const a = defaultSave(), b = defaultSave();
    ensureMissions(a, '2026-10-02'); ensureMissions(b, '2026-10-02');
    expect(a.missions.list.map((m) => m.id)).toEqual(b.missions.list.map((m) => m.id));
    expect(claimMission(a, 0)).toBeNull();
    a.missions.list[0].progress = 9999;
    expect(claimMission(a, 0)).not.toBeNull();
    expect(claimMission(a, 0)).toBeNull();
  });
  it('login streak continues on consecutive days and resets on gaps', () => {
    const s = defaultSave();
    claimLogin(s, '2026-10-01'); claimLogin(s, '2026-10-02');
    expect(s.daily.streak).toBe(2);
    expect(loginStatus(s, '2026-10-02').available).toBe(false);
    claimLogin(s, '2026-10-05');
    expect(s.daily.streak).toBe(1);
  });
  it('battle pass claims require tier and premium', () => {
    const s = defaultSave(); s.pass.xp = 3500;
    expect(passTier(s)).toBe(3);
    expect(claimPass(s, 'free', 4)).toBeNull();
    expect(claimPass(s, 'free', 1)).not.toBeNull();
    expect(claimPass(s, 'free', 1)).toBeNull();
    expect(claimPass(s, 'premium', 1)).toBeNull();
    s.wallet.crystals = 600; expect(buyPremiumPass(s)).toBe(true);
    expect(claimPass(s, 'premium', 1)).not.toBeNull();
  });
  it('shop rotates daily and blocks double purchase', () => {
    expect(shopOffers('2026-10-02')).toHaveLength(4);
    const s = defaultSave(); s.wallet.stardust = 99999; s.wallet.crystals = 9999;
    const o = shopOffers(dayKey())[0];
    expect(buyOffer(s, o.key).ok).toBe(true);
    expect(buyOffer(s, o.key).ok).toBe(false);
  });
  it('lab upgrades cost stardust and cap at max', () => {
    const s = defaultSave(); s.wallet.stardust = 1e6;
    for (let i = 0; i < 7; i++) buyUpgrade(s, 'yield');
    expect(s.upgrades.yield).toBe(5);
  });
  it('grant handles mixed bundles', () => {
    const s = defaultSave();
    const r = grant(s, { stardust: 10, crystals: 2, xp: 5, passXp: 7, item: 'trail:sparks' }, 't');
    expect(r.item.isNew).toBe(true);
    expect(s.pass.xp).toBe(7);
  });
});
