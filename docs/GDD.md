# Game Design Document — Neon Serpent: Cosmos

## Pitch
Classic snake, rebuilt as a premium space arcade game: short, juicy runs, a reason to come back every day, and a collection worth showing off.

## Pillars
1. **Instant to learn, deep to master** — one-touch steering; combos, abilities and sector hazards add depth.
2. **Every run pays** — Stardust, XP, pass XP and mission progress on every death.
3. **Collect and express** — species change *how* you play; cosmetics change how you *look*.
4. **Fair premium** — odds are public, pity is guaranteed, everything is earnable.

## Core loop
Play run (1–5 min) → earn ✦ / XP / pass XP / mission progress → claim rewards → unlock species, cosmetics, sectors → play again.

## Run rules
- 24×24 grid, tick rate rises with length and sector.
- **Orbs** +10 × combo × multipliers. **Golden apples** worth 5×. Eating within the combo window raises the combo multiplier (capped at ×5).
- **Power-ups:** Ghost (pass through everything), Magnet, Slow-mo, Double points, Shrink.
- **Ability** per species on a cooldown (Space/E/ability button).
- **Death:** wall, self or hazard. Up to 2 revives per run for ◆.

## Sectors
| Sector | Unlock | Hazard | Multiplier |
|---|---|---|---|
| Low Orbit | Lv 1 | none | ×1.0 |
| Red Dunes | Lv 3 | rock fields + sandstorm gusts | ×1.25 |
| Asteroid Belt | Lv 6 | drifting asteroids | ×1.5 |
| Nebula Veil | Lv 10 | fog — limited vision radius | ×1.8 |
| Event Horizon | Lv 15 | black hole that pulls the snake | ×2.2 |

## Modes
Endless · Daily Run (global seed, first clear 2× ✦) · Blitz (90 s) · Classic (pure) · Zen (no death).

## Meta systems
Pilot levels · Species (8) · Locker (44 cosmetics, 5 slots) · Item Shop (daily rotation) · Cosmic Cores · Season pass (30 tiers) · Daily missions (3 + bonus, 1 swap) · 7-day login · Achievements (13) · Lab upgrades (5 × 5 levels) · Profile & stats.

## UX principles
- Game is playable within 10 seconds of first load (onboarding → welcome core → play).
- Every reward is animated (count-ups, core reveal, toasts) and has a sound.
- Notifications dots on nav tabs when something is claimable.
- Mobile-first layout; works with keyboard, swipe or D-pad; respects reduced motion.
