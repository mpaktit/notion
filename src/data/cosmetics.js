/**
 * Cosmetic catalog. Cosmetics never change gameplay — they are pure expression.
 * type: skin | trail | crown | fx | title
 */
const C = (type, id, name, rarity, extra = {}) => ({ type, id, name, rarity, ...extra });

export const COSMETICS = [
  // Skins — pattern + colors drive the renderer.
  C('skin', 'neon', 'Signature', 'common', { pattern: 'species', colors: ['#3CF0C5', '#2A7BFF'], starter: true, desc: 'Your species colors.' }),
  C('skin', 'mint', 'Mint Rush', 'common', { pattern: 'gradient', colors: ['#B8FFDF', '#2FBF8F'] }),
  C('skin', 'coral', 'Coral Reef', 'common', { pattern: 'gradient', colors: ['#FF9A8B', '#FF5C7A'] }),
  C('skin', 'slate', 'Stealth', 'common', { pattern: 'gradient', colors: ['#C9D1DD', '#4A5568'] }),
  C('skin', 'lime', 'Acid Lime', 'common', { pattern: 'gradient', colors: ['#E4FF5C', '#5BCB2C'] }),
  C('skin', 'sunset', 'Sunset Strip', 'rare', { pattern: 'gradient', colors: ['#FFB547', '#FF4F8B'] }),
  C('skin', 'bee', 'Hornet', 'rare', { pattern: 'stripes', colors: ['#FFD23F', '#1A1A1A'] }),
  C('skin', 'candy', 'Candy Cane', 'rare', { pattern: 'stripes', colors: ['#FFFFFF', '#FF3B5C'] }),
  C('skin', 'ice', 'Glacier', 'rare', { pattern: 'scales', colors: ['#E8FBFF', '#5EC8FF'] }),
  C('skin', 'aurora', 'Aurora', 'epic', { pattern: 'pulse', colors: ['#B49CFF', '#3CF0C5'] }),
  C('skin', 'dragon', 'Dragon Scale', 'epic', { pattern: 'scales', colors: ['#5BFF8A', '#0B6B3A'] }),
  C('skin', 'circuit', 'Circuit Board', 'epic', { pattern: 'circuit', colors: ['#39FF88', '#0A2A1A'] }),
  C('skin', 'plasma', 'Plasma Core', 'epic', { pattern: 'pulse', colors: ['#FF5CF0', '#5C6BFF'] }),
  C('skin', 'galaxy', 'Galaxy', 'legendary', { pattern: 'galaxy', colors: ['#2B1E5C', '#0A0620'] }),
  C('skin', 'inferno', 'Inferno', 'legendary', { pattern: 'fire', colors: ['#FFE45C', '#FF3B3B'] }),
  C('skin', 'gold', '24K Gold', 'legendary', { pattern: 'metal', colors: ['#FFF1A8', '#C8901E'] }),
  C('skin', 'prism', 'Prism', 'mythic', { pattern: 'rainbow', colors: ['#FF5C7A', '#3CF0C5'] }),
  C('skin', 'singularity', 'Singularity', 'mythic', { pattern: 'void', colors: ['#000000', '#FFFFFF'] }),

  // Trails — particles emitted behind the tail.
  C('trail', 'none', 'No Trail', 'common', { starter: true }),
  C('trail', 'sparks', 'Sparks', 'common', { colors: ['#FFFFFF', '#FFE45C'] }),
  C('trail', 'bubbles', 'Bubbles', 'rare', { colors: ['#5EC8FF', '#B8F1FF'] }),
  C('trail', 'stardust', 'Stardust', 'rare', { colors: ['#FFC93C', '#FFF3B0'] }),
  C('trail', 'flame', 'Afterburner', 'epic', { colors: ['#FF5A1F', '#FFE45C'] }),
  C('trail', 'glitch', 'Glitch', 'epic', { colors: ['#FF2BD6', '#2BFFF0'] }),
  C('trail', 'comet', 'Comet Tail', 'legendary', { colors: ['#FFFFFF', '#7FD4FF'] }),
  C('trail', 'rainbow', 'Rainbow Road', 'mythic', { colors: ['rainbow'] }),

  // Crowns — head accessories.
  C('crown', 'none', 'Bare Head', 'common', { starter: true }),
  C('crown', 'antenna', 'Antenna', 'common'),
  C('crown', 'halo', 'Halo', 'rare'),
  C('crown', 'horns', 'Demon Horns', 'rare'),
  C('crown', 'visor', 'Pilot Visor', 'epic'),
  C('crown', 'tophat', 'Top Hat', 'epic'),
  C('crown', 'crown', 'Royal Crown', 'legendary'),
  C('crown', 'starcrown', 'Crown of Stars', 'mythic'),

  // Elimination effects.
  C('fx', 'standard', 'Shatter', 'common', { starter: true }),
  C('fx', 'pixel', 'Pixelate', 'rare'),
  C('fx', 'confetti', 'Confetti', 'epic'),
  C('fx', 'supernova', 'Supernova', 'legendary'),
  C('fx', 'blackhole', 'Collapse', 'mythic'),

  // Titles — shown under the pilot name.
  C('title', 'rookie', 'Rookie Pilot', 'common', { starter: true }),
  C('title', 'hunter', 'Star Hunter', 'rare'),
  C('title', 'combo', 'Combo Lord', 'epic'),
  C('title', 'voidwalker', 'Voidwalker', 'legendary'),
  C('title', 'eventhorizon', 'Event Horizon', 'mythic')
];

export const COSMETIC_BY_KEY = Object.fromEntries(COSMETICS.map((c) => [`${c.type}:${c.id}`, c]));
export const cosmetic = (type, id) => COSMETIC_BY_KEY[`${type}:${id}`];
export const COSMETIC_TYPES = [
  { type: 'skin', name: 'Skins' }, { type: 'trail', name: 'Trails' }, { type: 'crown', name: 'Crowns' },
  { type: 'fx', name: 'Eliminations' }, { type: 'title', name: 'Titles' }
];

/** Shop prices by rarity. Common/rare use soft currency, epic+ use crystals. */
export const PRICE = {
  common: { stardust: 400 }, rare: { stardust: 1200 }, epic: { crystals: 180 },
  legendary: { crystals: 450 }, mythic: { crystals: 900 }
};
