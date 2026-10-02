/** Space sectors (worlds). Each has its own hazards, look, music key and reward multiplier. */
export const SECTORS = [
  { id: 'orbit', name: 'Low Orbit', tagline: 'Clean lanes. Learn the fundamentals.', level: 1, mult: 1.0,
    hazard: 'none', palette: { bg: '#070B16', glow: '#3CF0C5', planet: ['#2A7BFF', '#0B2A66'] }, music: 0 },
  { id: 'dunes', name: 'Red Dunes', tagline: 'Rock fields and sandstorms on Mars.', level: 3, mult: 1.25,
    hazard: 'rocks', palette: { bg: '#140806', glow: '#FF8A4C', planet: ['#E0603A', '#5A1A0E'] }, music: 1 },
  { id: 'belt', name: 'Asteroid Belt', tagline: 'Drifting asteroids cross your path.', level: 6, mult: 1.5,
    hazard: 'asteroids', palette: { bg: '#0A0A10', glow: '#C8C2B4', planet: ['#9A8F7E', '#2A2620'] }, music: 2 },
  { id: 'nebula', name: 'Nebula Veil', tagline: 'Thick gas. You only see what is near.', level: 10, mult: 1.8,
    hazard: 'fog', palette: { bg: '#0E0618', glow: '#C77DFF', planet: ['#FF4F8B', '#3A0E5A'] }, music: 3 },
  { id: 'horizon', name: 'Event Horizon', tagline: 'A black hole pulls everything in.', level: 15, mult: 2.2,
    hazard: 'blackhole', palette: { bg: '#040308', glow: '#FFC93C', planet: ['#000000', '#000000'] }, music: 4 }
];
export const SECTOR_BY_ID = Object.fromEntries(SECTORS.map((s) => [s.id, s]));

export const MODES = {
  endless: { id: 'endless', name: 'Endless', desc: 'Survive the sector. Speed and hazards grow.', powers: true, hazards: true, wrap: false },
  daily:   { id: 'daily',   name: 'Daily Run', desc: 'Same seed for everyone today. 2x Stardust on first clear.', powers: true, hazards: true, wrap: false },
  blitz:   { id: 'blitz',   name: 'Blitz', desc: '90 seconds. Each bite adds time. Max score.', powers: true, hazards: false, wrap: false, timeLimit: 90000 },
  classic: { id: 'classic', name: 'Classic', desc: 'The original. No power-ups. No mercy.', powers: false, hazards: false, wrap: false },
  zen:     { id: 'zen',     name: 'Zen', desc: 'No walls, no death. Just flow.', powers: true, hazards: false, wrap: true, immortal: true }
};
