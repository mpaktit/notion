/** Visual representations of items, rewards and species for UI cards. */
import { h, fmt } from './dom.js';
import { drawPreview } from '../game/render.js';
import { COSMETIC_BY_KEY, cosmetic } from '../data/cosmetics.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { CORES } from '../meta/cores.js';

const TRAIL_ICON = { none: '—', sparks: '✨', bubbles: '🫧', stardust: '🌟', flame: '🔥', glitch: '📺', comet: '☄️', rainbow: '🌈' };
const FX_ICON = { standard: '💥', pixel: '👾', confetti: '🎉', supernova: '🌞', blackhole: '🕳️' };
const TYPE_NAME = { skin: 'Skin', trail: 'Trail', crown: 'Crown', fx: 'Elimination', title: 'Title', species: 'Species', fragment: 'Species Fragment' };

export function snakeCanvas(opts, w = 160, h = 90) {
  const cv = h_canvas(w, h);
  drawPreview(cv, opts, w, h);
  return cv;
}
function h_canvas(w, hh) { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; }

/** Skin options merged with species colors for "Signature" skins. */
export function lookFor(save, overrides = {}) {
  const sp = SPECIES_BY_ID[overrides.species || save.equipped.species];
  const skin = cosmetic('skin', overrides.skin || save.equipped.skin);
  const crown = overrides.crown || save.equipped.crown;
  if (!skin || skin.pattern === 'species') {
    return sp.colors[0] === 'rainbow' ? { pattern: 'rainbow', colors: ['#FF5C7A', '#3CF0C5'], crown } : { pattern: 'gradient', colors: sp.colors, crown };
  }
  return { pattern: skin.pattern, colors: skin.colors, crown };
}

/** Art element for an item key like "skin:galaxy" / "fragment:drake" / "species:wraith". */
export function itemArt(key, save, w = 160, hh = 90) {
  const [type, id] = key.split(':');
  if (type === 'skin') return snakeCanvas(lookFor(save, { skin: id, crown: 'none' }), w, hh);
  if (type === 'crown') return snakeCanvas({ ...lookFor(save, { crown: id }) }, w, hh);
  if (type === 'species' || type === 'fragment') {
    const sp = SPECIES_BY_ID[id];
    const cv = snakeCanvas(sp.colors[0] === 'rainbow' ? { pattern: 'rainbow', colors: ['#fff', '#fff'] } : { pattern: 'gradient', colors: sp.colors }, w, hh);
    return type === 'fragment' ? h('div', { style: { position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center' } }, cv, h('span', { style: { position: 'absolute', bottom: '4px', right: '6px', fontSize: '18px' } }, '🧩')) : cv;
  }
  if (type === 'trail') {
    const t = cosmetic('trail', id);
    return h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '30px' } }, TRAIL_ICON[id] || '✨',
      ...(t?.colors || []).slice(0, 2).map((c) => h('i', { style: { width: '10px', height: '10px', borderRadius: '50%', background: c === 'rainbow' ? 'conic-gradient(#FF5C7A,#FFC93C,#3CF0C5,#5EC8FF,#B49CFF,#FF5C7A)' : c, boxShadow: `0 0 10px ${c === 'rainbow' ? '#fff' : c}` } })));
  }
  if (type === 'fx') return h('span', {}, FX_ICON[id] || '💥');
  if (type === 'title') return h('span', { style: { fontSize: '14px', fontWeight: '800', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' } }, COSMETIC_BY_KEY[key]?.name || id);
  return h('span', {}, '❔');
}
export function itemName(key) {
  const [type, id] = key.split(':');
  if (type === 'species') return SPECIES_BY_ID[id]?.name || id;
  if (type === 'fragment') return `${SPECIES_BY_ID[id]?.name || id} Fragment`;
  return COSMETIC_BY_KEY[key]?.name || id;
}
export function itemRarity(key) {
  const [type, id] = key.split(':');
  if (type === 'species' || type === 'fragment') return SPECIES_BY_ID[id]?.rarity || 'common';
  return COSMETIC_BY_KEY[key]?.rarity || 'common';
}
export const typeName = (key) => TYPE_NAME[key.split(':')[0]] || 'Item';

/** Compact icon + label for a reward bundle. */
export function rewardBits(r) {
  if (!r) return { icon: '·', label: '' };
  if (r.item) return { icon: null, label: itemName(r.item), item: r.item };
  if (r.core) return { icon: r.core === 'prime' ? '🔮' : '🧿', label: CORES[r.core].name + (r.crystals ? ` + ${r.crystals}◆` : '') };
  if (r.crystals) return { icon: '◆', label: `${fmt(r.crystals)}`, cls: 'crystal' };
  if (r.stardust) return { icon: '✨', label: `${fmt(r.stardust)}`, cls: 'dust' };
  return { icon: '·', label: '' };
}
