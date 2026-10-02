/**
 * Daily mission pool. `stat` reads from a run summary; `sum` missions accumulate
 * across runs, `best` missions require a single run to reach the goal.
 */
export const MISSION_POOL = [
  { id: 'food40', text: 'Eat 40 orbs', stat: 'food', goal: 40, kind: 'sum', reward: { stardust: 250, passXp: 400 } },
  { id: 'food100', text: 'Eat 100 orbs', stat: 'food', goal: 100, kind: 'sum', reward: { stardust: 500, passXp: 700 } },
  { id: 'runs3', text: 'Play 3 runs', stat: 'runs', goal: 3, kind: 'sum', reward: { stardust: 200, passXp: 300 } },
  { id: 'combo5', text: 'Hit a x5 combo', stat: 'maxCombo', goal: 5, kind: 'best', reward: { stardust: 300, passXp: 500 } },
  { id: 'score600', text: 'Score 600 in one run', stat: 'score', goal: 600, kind: 'best', reward: { stardust: 350, passXp: 500 } },
  { id: 'score1500', text: 'Score 1,500 in one run', stat: 'score', goal: 1500, kind: 'best', reward: { stardust: 600, passXp: 800 } },
  { id: 'powers5', text: 'Collect 5 power-ups', stat: 'powerups', goal: 5, kind: 'sum', reward: { stardust: 250, passXp: 400 } },
  { id: 'ability6', text: 'Use your ability 6 times', stat: 'abilities', goal: 6, kind: 'sum', reward: { stardust: 250, passXp: 400 } },
  { id: 'gold3', text: 'Grab 3 golden stars', stat: 'golds', goal: 3, kind: 'sum', reward: { stardust: 300, passXp: 450 } },
  { id: 'len30', text: 'Grow to length 30', stat: 'length', goal: 30, kind: 'best', reward: { stardust: 350, passXp: 500 } },
  { id: 'survive120', text: 'Survive 2 minutes in one run', stat: 'timeSec', goal: 120, kind: 'best', reward: { stardust: 300, passXp: 450 } },
  { id: 'lvl6', text: 'Reach sector level 6', stat: 'level', goal: 6, kind: 'best', reward: { stardust: 350, passXp: 500 } }
];
export const MISSION_BY_ID = Object.fromEntries(MISSION_POOL.map((m) => [m.id, m]));
export const MISSION_BONUS = { crystals: 10, passXp: 500 };
