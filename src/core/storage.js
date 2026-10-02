/**
 * Versioned, integrity-checked save system.
 *
 * Security note: everything client-side can be modified by a determined user.
 * The signature deters casual tampering (editing localStorage by hand) and the
 * sanitizer guarantees the game never loads malformed or out-of-range data.
 * Real anti-cheat requires server-authoritative saves (see docs/ROADMAP.md).
 */
import { hashString, dayKey } from './rng.js';

export const SAVE_VERSION = 1;
const KEY = 'neon-serpent-cosmos';
const SALT = 'ns-cosmos::v1::orbit';
const MAX_CURRENCY = 10_000_000;

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    profile: { name: 'Pilot', xp: 0, level: 1, onboarded: false },
    wallet: { stardust: 300, crystals: 30 },
    owned: { species: ['terran'], skin: ['neon'], trail: ['none'], crown: ['none'], fx: ['standard'], title: ['rookie'] },
    equipped: { species: 'terran', skin: 'neon', trail: 'none', crown: 'none', fx: 'standard', title: 'rookie' },
    fragments: {},
    upgrades: { duration: 0, yield: 0, combo: 0, luck: 0, cooldown: 0 },
    best: {},
    stats: { runs: 0, food: 0, golds: 0, powerups: 0, abilities: 0, playtimeMs: 0, bestCombo: 0, longest: 0, bestScore: 0, crystalsFound: 0, coresOpened: 0 },
    pass: { season: 1, xp: 0, premium: false, claimedFree: [], claimedPremium: [] },
    missions: { day: '', list: [], rerolled: false, bonusClaimed: false },
    daily: { lastClaim: '', streak: 0 },
    dailyRun: { day: '', cleared: false },
    cores: { pityPrime: 0, pityStandard: 0 },
    achievements: {},
    shop: { day: '', bought: [] },
    settings: { music: 0.5, sfx: 0.8, shake: true, reducedMotion: false, haptics: true, showFps: false, dpad: false, lastMode: 'endless', lastSector: 'orbit' },
    ledger: []
  };
}

/** FNV-1a-style signature over canonical JSON. */
export function sign(data) {
  return hashString(SALT + JSON.stringify(data)).toString(36);
}

/** Deep-sanitize `raw` against the shape of `template`. Unknown keys are dropped, wrong types replaced. */
export function sanitize(raw, template = defaultSave()) {
  if (Array.isArray(template)) {
    if (!Array.isArray(raw)) return template;
    // Arrays hold primitives (ids) or small objects; cap length to keep saves bounded.
    return raw.slice(0, 500).filter((v) => ['string', 'number', 'boolean'].includes(typeof v) || (v && typeof v === 'object'));
  }
  if (template && typeof template === 'object') {
    const out = {};
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    // Open maps (best scores, fragments, achievements) accept any safe key.
    const isOpenMap = Object.keys(template).length === 0;
    const keys = isOpenMap ? Object.keys(src).filter((k) => /^[a-z0-9_:-]{1,40}$/i.test(k)).slice(0, 300) : Object.keys(template);
    for (const k of keys) {
      if (isOpenMap) {
        const v = src[k];
        if (typeof v === 'number' && Number.isFinite(v)) out[k] = clampNum(v);
        else if (typeof v === 'boolean') out[k] = v;
      } else out[k] = sanitize(src[k], template[k]);
    }
    return out;
  }
  if (typeof template === 'number') return typeof raw === 'number' && Number.isFinite(raw) ? clampNum(raw) : template;
  if (typeof template === 'string') return typeof raw === 'string' ? raw.slice(0, 64) : template;
  if (typeof template === 'boolean') return typeof raw === 'boolean' ? raw : template;
  return template;
}
const clampNum = (v) => Math.max(-1, Math.min(MAX_CURRENCY * 100, v));

/** Ensure economic invariants (non-negative integer balances, starters owned, equipped is owned). */
export function enforceInvariants(save) {
  for (const k of ['stardust', 'crystals']) save.wallet[k] = Math.max(0, Math.min(MAX_CURRENCY, Math.floor(save.wallet[k] || 0)));
  const d = defaultSave();
  for (const type of Object.keys(d.owned)) {
    const set = new Set(save.owned[type].filter((x) => typeof x === 'string'));
    d.owned[type].forEach((id) => set.add(id));
    save.owned[type] = [...set];
    if (!set.has(save.equipped[type])) save.equipped[type] = d.equipped[type];
  }
  save.version = SAVE_VERSION;
  return save;
}

export function serialize(save) {
  return JSON.stringify({ v: SAVE_VERSION, data: save, sig: sign(save) });
}

/** Returns { ok, save, tampered }. Never throws. */
export function deserialize(str) {
  try {
    const parsed = JSON.parse(str);
    if (!parsed || typeof parsed !== 'object' || !parsed.data) return { ok: false, save: defaultSave(), reason: 'empty' };
    const tampered = sign(parsed.data) !== parsed.sig;
    const migrated = migrate(parsed.data, parsed.v);
    const save = enforceInvariants(sanitize(migrated));
    if (tampered) {
      // Keep progress but strip currency gained by editing; the honest path is unaffected.
      save.wallet.stardust = Math.min(save.wallet.stardust, 5000);
      save.wallet.crystals = Math.min(save.wallet.crystals, 50);
    }
    return { ok: true, save, tampered };
  } catch {
    return { ok: false, save: defaultSave(), reason: 'corrupt' };
  }
}

/** Forward migrations between save versions. */
export function migrate(data, fromVersion = SAVE_VERSION) {
  let d = data;
  // v1 is the first public format. Future: if (fromVersion < 2) d = v1to2(d);
  void fromVersion;
  return d;
}

const memory = {};
export const backend = {
  read() { try { return localStorage.getItem(KEY) ?? memory[KEY] ?? null; } catch { return memory[KEY] ?? null; } },
  write(v) { memory[KEY] = v; try { localStorage.setItem(KEY, v); } catch { /* private mode / sandboxed iframe */ } },
  clear() { delete memory[KEY]; try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
};

export function loadSave() {
  const raw = backend.read();
  if (!raw) return { save: defaultSave(), fresh: true, tampered: false };
  const r = deserialize(raw);
  return { save: r.save, fresh: !r.ok, tampered: !!r.tampered };
}
let writeTimer = null;
export function persist(save, immediate = false) {
  const run = () => backend.write(serialize(save));
  clearTimeout(writeTimer);
  if (immediate) run(); else writeTimer = setTimeout(run, 250);
}

/** Portable backup code (base64 of the signed envelope). */
export function exportCode(save) {
  const bytes = new TextEncoder().encode(serialize(save));
  let bin = ''; bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
export function importCode(code) {
  try {
    const bin = atob(String(code).trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const r = deserialize(new TextDecoder().decode(bytes));
    if (!r.ok) return { ok: false, reason: 'That code is not a valid save.' };
    if (r.tampered) return { ok: false, reason: 'That code was modified and cannot be imported.' };
    return { ok: true, save: r.save };
  } catch {
    return { ok: false, reason: 'That code is not a valid save.' };
  }
}
export { dayKey };
