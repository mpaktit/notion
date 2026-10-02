/**
 * Deterministic random utilities. All gameplay randomness flows through
 * an Rng instance so runs (e.g. the Daily Run) are reproducible and testable.
 */

/** cyrb53 string hash -> 53-bit integer. */
export function hashString(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export class Rng {
  constructor(seed = Date.now()) {
    this.state = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0 || 1;
  }
  /** mulberry32 -> float in [0, 1) */
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n) { return Math.floor(this.next() * n); }
  range(a, b) { return a + this.next() * (b - a); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  /** Pick a key from a {key: weight} table. */
  weighted(table) {
    const entries = Object.entries(table);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [k, w] of entries) { if ((r -= w) < 0) return k; }
    return entries[entries.length - 1][0];
  }
}

/** Local calendar day key, e.g. "2026-10-02". */
export function dayKey(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days between two day keys (b - a). */
export function dayDiff(a, b) {
  const pa = Date.UTC(...a.split('-').map((v, i) => (i === 1 ? v - 1 : +v)));
  const pb = Date.UTC(...b.split('-').map((v, i) => (i === 1 ? v - 1 : +v)));
  return Math.round((pb - pa) / 86400000);
}
