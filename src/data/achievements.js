/** Lifetime achievements. `test(save)` reads lifetime stats. Rewards are rare crystals. */
export const ACHIEVEMENTS = [
  { id: 'first', name: 'First Bite', desc: 'Eat your first orb.', test: (s) => s.stats.food >= 1, reward: { crystals: 5 } },
  { id: 'runs10', name: 'Frequent Flyer', desc: 'Play 10 runs.', test: (s) => s.stats.runs >= 10, reward: { crystals: 10 } },
  { id: 'runs100', name: 'Veteran', desc: 'Play 100 runs.', test: (s) => s.stats.runs >= 100, reward: { crystals: 40 } },
  { id: 'food1k', name: 'Black Hole Appetite', desc: 'Eat 1,000 orbs total.', test: (s) => s.stats.food >= 1000, reward: { crystals: 30 } },
  { id: 'combo5', name: 'Combo Master', desc: 'Reach a x5 combo.', test: (s) => s.stats.bestCombo >= 5, reward: { crystals: 10 } },
  { id: 'len50', name: 'Titanoboa', desc: 'Reach length 50.', test: (s) => s.stats.longest >= 50, reward: { crystals: 25 } },
  { id: 'score2k', name: 'Legend', desc: 'Score 2,000 in one run.', test: (s) => s.stats.bestScore >= 2000, reward: { crystals: 25 } },
  { id: 'score5k', name: 'Myth', desc: 'Score 5,000 in one run.', test: (s) => s.stats.bestScore >= 5000, reward: { crystals: 60 } },
  { id: 'crystal', name: 'Lucky Find', desc: 'Find a Void Crystal mid-run.', test: (s) => s.stats.crystalsFound >= 1, reward: { crystals: 5 } },
  { id: 'species3', name: 'Collector', desc: 'Own 3 species.', test: (s) => s.owned.species.length >= 3, reward: { crystals: 20 } },
  { id: 'horizon', name: 'Point of No Return', desc: 'Unlock Event Horizon.', test: (s) => s.profile.level >= 15, reward: { crystals: 30 } },
  { id: 'daily7', name: 'Dedicated', desc: 'Reach a 7-day login streak.', test: (s) => s.daily.streak >= 7, reward: { crystals: 25 } },
  { id: 'hour', name: 'Time Well Spent', desc: 'Play for 1 hour total.', test: (s) => s.stats.playtimeMs >= 3600000, reward: { crystals: 20 } }
];
