/**
 * Playable serpent species. Stats are 1-5 and shown in the UI.
 * speed: base tick speed. control: input buffer + forgiveness. luck: drop chances.
 * Passives are small, readable, multiplicative bonuses.
 */
export const SPECIES = [
  {
    id: 'terran', name: 'Terran Viper', rarity: 'common', origin: 'Earth',
    lore: 'Born in the neon grids of old Earth. Reliable, quick, fearless.',
    colors: ['#3CF0C5', '#2A7BFF'], stats: { speed: 3, control: 3, luck: 2 },
    ability: { id: 'dash', name: 'Overdrive', desc: '3s of +60% speed and +50% score.', cd: 15 },
    passive: { text: 'No passive. Pure skill.' },
    cost: null
  },
  {
    id: 'sandwyrm', name: 'Martian Sandwyrm', rarity: 'rare', origin: 'Mars',
    lore: 'Tunnels through red dunes as if they were air.',
    colors: ['#FF9F5A', '#C2413A'], stats: { speed: 2, control: 4, luck: 3 },
    ability: { id: 'burrow', name: 'Burrow', desc: '3.5s pass through hazards and yourself.', cd: 18 },
    passive: { text: '+10% Stardust in Red Dunes.', sectorBonus: { dunes: 0.1 } },
    cost: { stardust: 2500 }
  },
  {
    id: 'eel', name: 'Nebula Eel', rarity: 'rare', origin: 'Orion Nebula',
    lore: 'Its charged skin drags stardust out of the void.',
    colors: ['#5EC8FF', '#7B6CFF'], stats: { speed: 3, control: 3, luck: 4 },
    ability: { id: 'pulse', name: 'Ion Pulse', desc: '7s magnet that pulls food and pickups.', cd: 20 },
    passive: { text: '+1 magnet range.', magnetRange: 1 },
    cost: { stardust: 3500 }
  },
  {
    id: 'basilisk', name: 'Crystal Basilisk', rarity: 'epic', origin: 'Kepler-22b',
    lore: 'Armored in living quartz. One hit only makes it angry.',
    colors: ['#E0F7FF', '#7FD4FF'], stats: { speed: 2, control: 4, luck: 3 },
    ability: { id: 'shield', name: 'Prism Shield', desc: 'Absorbs one fatal hit for 12s.', cd: 25 },
    passive: { text: 'Starts every run with a shield.', startShield: true },
    cost: { crystals: 450 }, fragments: 10
  },
  {
    id: 'drake', name: 'Solar Drake', rarity: 'epic', origin: 'The Sun',
    lore: 'A coil of living plasma. Hazards melt in its wake.',
    colors: ['#FFE45C', '#FF5A1F'], stats: { speed: 4, control: 2, luck: 3 },
    ability: { id: 'flare', name: 'Solar Flare', desc: 'Burns every hazard within 5 tiles.', cd: 22 },
    passive: { text: '+10% score.', scoreMult: 0.1 },
    cost: { crystals: 450 }, fragments: 10
  },
  {
    id: 'wraith', name: 'Void Wraith', rarity: 'legendary', origin: 'The Void',
    lore: 'Half here, half elsewhere. Walls are a suggestion.',
    colors: ['#B49CFF', '#2B1E5C'], stats: { speed: 4, control: 4, luck: 4 },
    ability: { id: 'phase', name: 'Phase Shift', desc: '4.5s ghost form that also wraps walls.', cd: 20 },
    passive: { text: '+15% Stardust everywhere.', stardustMult: 0.15 },
    cost: { crystals: 1200 }, fragments: 20
  },
  {
    id: 'leviathan', name: 'Chrono Leviathan', rarity: 'legendary', origin: 'Event Horizon',
    lore: 'It remembers the future. Time bends around it.',
    colors: ['#3CF0C5', '#FFC93C'], stats: { speed: 3, control: 5, luck: 4 },
    ability: { id: 'warp', name: 'Time Warp', desc: '6s of slowed time.', cd: 22 },
    passive: { text: 'Combo window +1s.', comboWindow: 1000 },
    cost: { crystals: 1200 }, fragments: 20
  },
  {
    id: 'hydra', name: 'Quasar Hydra', rarity: 'mythic', origin: 'Quasar 3C 273',
    lore: 'The brightest thing in the universe. It eats galaxies for breakfast.',
    colors: ['rainbow', 'rainbow'], stats: { speed: 5, control: 4, luck: 5 },
    ability: { id: 'nova', name: 'Supernova', desc: 'Devours all food on the board at once.', cd: 30 },
    passive: { text: '+25% score, +10% Stardust.', scoreMult: 0.25, stardustMult: 0.1 },
    cost: { crystals: 3000 }, fragments: 40
  }
];
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
