/** In-run pickups. Duration in ms (before the Power Cells upgrade). */
export const POWERS = {
  ghost:  { name: 'Ghost',   icon: '👻', color: '#B9A7FF', dur: 6000,  desc: 'Pass through walls, hazards and yourself.' },
  magnet: { name: 'Magnet',  icon: '🧲', color: '#FF6B8A', dur: 8000,  desc: 'Pulls nearby orbs to you.' },
  slow:   { name: 'Slow-mo', icon: '⏳', color: '#5EC8FF', dur: 6000,  desc: 'Slows time down.' },
  double: { name: 'Double',  icon: '✖2', color: '#FFC93C', dur: 10000, desc: 'Double points.' },
  shrink: { name: 'Shrink',  icon: '✂️', color: '#FFB547', dur: 0,     desc: 'Cuts 4 tail segments.' }
};
export const POWER_IDS = Object.keys(POWERS);
/** Timed effects shown in the HUD (includes ability-only effects). */
export const EFFECT_META = {
  ...POWERS,
  dash:   { name: 'Overdrive', icon: '🚀', color: '#3CF0C5' },
  phase:  { name: 'Phase',     icon: '🌀', color: '#B49CFF' },
  warp:   { name: 'Time Warp', icon: '⌛', color: '#FFC93C' },
  invuln: { name: 'Shielded',  icon: '✨', color: '#FFFFFF' }
};
