<div align="center">

# 🐍 Neon Serpent: Cosmos

**A premium arcade snake game across five sectors of space.**
Eight alien species · 44 cosmetics · a 30-tier season pass · daily runs · zero dependencies at runtime.

[![CI](https://github.com/mpaktit/notion/actions/workflows/ci.yml/badge.svg)](https://github.com/mpaktit/notion/actions/workflows/ci.yml)
[![Deploy](https://github.com/mpaktit/notion/actions/workflows/pages.yml/badge.svg)](https://github.com/mpaktit/notion/actions/workflows/pages.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-3CF0C5)

**[▶ Play in your browser](https://mpaktit.github.io/notion/)**

</div>

---

## Features

### Gameplay
- **5 sectors** with their own hazards, music and score multiplier — Low Orbit (×1), Red Dunes (rocks & sandstorms, ×1.25), Asteroid Belt (drifting asteroids, ×1.5), Nebula Veil (fog of war, ×1.8), Event Horizon (black-hole gravity, ×2.2). Unlocked by pilot level.
- **5 modes** — Endless, Daily Run (same seed for everyone, 2× Stardust on first clear), Blitz (90 s, bites add time), Classic (no power-ups), Zen (no walls, no death).
- **Combo system**, power-ups (Ghost, Magnet, Slow-mo, Double, Shrink), golden apples, Stardust and Void Crystal pickups.
- **Revive** once or twice per run for Void Crystals.
- Pixel-perfect 60 fps canvas renderer with interpolated movement, particles, screen shake, trails and death FX.

### Species — each with stats, an active ability and a passive
| Species | Rarity | Ability | Passive | Unlock |
|---|---|---|---|---|
| Terran Viper | Common | Overdrive — 3 s of +60 % speed, +50 % score | — | Starter |
| Martian Sandwyrm | Rare | Burrow — pass through hazards & yourself | +10 % Stardust in Red Dunes | 2 500 ✦ |
| Nebula Eel | Rare | Ion Pulse — 7 s magnet | +1 magnet range | 3 500 ✦ |
| Crystal Basilisk | Epic | Prism Shield — absorbs one fatal hit | Starts every run shielded | 450 ◆ / 10 fragments |
| Solar Drake | Epic | Solar Flare — burns hazards within 5 tiles | +10 % score | 450 ◆ / 10 fragments |
| Void Wraith | Legendary | Phase Shift — ghost form that wraps walls | +15 % Stardust | 1 200 ◆ / 20 fragments |
| Chrono Leviathan | Legendary | Time Warp — 6 s of slowed time | Combo window +1 s | 1 200 ◆ / 20 fragments |
| Quasar Hydra | Mythic | Supernova — devours all food at once | +25 % score, +10 % Stardust | 3 000 ◆ / 40 fragments |

### Meta & cosmetics
- **Two currencies** — ✦ Stardust (earned by playing) and ◆ Void Crystals (rare; earned from missions, levels, the pass and achievements, or bought). See [docs/ECONOMY.md](docs/ECONOMY.md).
- **Locker** — 18 skins, 8 trails, 8 crowns, 5 death FX and 5 titles across five rarities (Common → Mythic).
- **Item Shop** with a daily rotation, plus **Cosmic Cores** (loot boxes) with **published odds and pity timers**.
- **Season pass** — 30 tiers, free and premium tracks.
- **Daily missions** (with one free swap), a **7-day login calendar**, **13 achievements**, **Lab upgrades** (permanent, Stardust-only).
- Pilot levels, profile stats, per-mode/sector bests.

### Quality
- Installable **PWA** with offline support.
- Keyboard, swipe and on-screen D-pad controls; haptics on mobile.
- Respects `prefers-reduced-motion`; separate toggles for shake, music, SFX.
- **Signed, versioned saves** with migration, tamper detection and backup/restore codes.
- Strict Content-Security-Policy; all UI built with an XSS-safe DOM helper (no `innerHTML` for user data).

## Controls
| Action | Keyboard | Touch |
|---|---|---|
| Steer | Arrow keys / WASD | Swipe or D-pad |
| Ability | Space / E / Shift | Ability button |
| Pause | Esc / P | Pause button |
| Play | Enter | Play button |

## Getting started

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm test` | Unit tests (Vitest) for the engine, economy, cores, progression and saves |
| `npm run build` | Generates PNG icons, then builds to `dist/` |
| `npm run preview` | Serves the production build on port 4173 |
| `npm run test:e2e` | Playwright smoke test against `preview` — clicks through every screen and saves screenshots to `shots/` (run `npx playwright install chromium` once) |

## Deploying
The `pages.yml` workflow tests, builds and deploys `dist/` to GitHub Pages on every push to `main`.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The build is fully static (`base: './'`), so it can also be dropped on Netlify, Vercel, Cloudflare Pages or itch.io.

## Project structure
```
src/
  core/      rng (seeded), storage (signed saves), audio (WebAudio SFX + procedural music)
  data/      species, sectors & modes, cosmetics, progression, missions, achievements, powers
  game/      engine (pure, DOM-free simulation), renderer, particles
  meta/      economy, cores, progress (missions, pass, login, shop, upgrades)
  ui/        DOM helper, screens, modals, HUD, art
  main.js    app controller: navigation, input, game loop
tests/       Vitest unit tests
scripts/     icon generation, e2e smoke test
docs/        game design, economy, roadmap
```
The engine and meta layers never touch the DOM, so every rule is unit-testable and portable to a server for authoritative validation later.

## Docs
- [Game design](docs/GDD.md)
- [Economy & monetisation](docs/ECONOMY.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)

## Status
**v1.0 — single-player, offline-first.** Purchases of Void Crystals are not wired to a payment provider yet, and progress lives in the browser. Accounts, cloud saves, real payments and global leaderboards need a backend — see the [roadmap](docs/ROADMAP.md).

## License
[MIT](LICENSE)
