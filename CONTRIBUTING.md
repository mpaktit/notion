# Contributing

## Setup
```bash
npm install
npm run dev
```

## Workflow
1. One task per branch/PR (`feat/…`, `fix/…`, `docs/…`).
2. Keep game rules in `src/game` and `src/meta` **DOM-free** and covered by tests in `tests/`.
3. Before opening a PR run:
   ```bash
   npm run check          # unit tests + production build
   npm run preview & npm run test:e2e   # optional: full click-through with screenshots
   ```
4. Check the UI at desktop size and at a 390 px-wide phone viewport.
5. If you add a currency source or sink, update `docs/ECONOMY.md`.

## Code style
- Modern ES modules, no framework, no runtime dependencies.
- 2-space indent, LF, UTF-8 (see `.editorconfig`).
- Build DOM only through `h()` from `src/ui/dom.js` — never `innerHTML` with dynamic data.
- Content (species, cosmetics, missions…) lives in `src/data` as plain objects so it can later be served from a backend.

## Adding content
- **Cosmetic:** add an entry to `src/data/cosmetics.js` (id, type, rarity, colours). It automatically appears in the Locker, Shop rotation and Core pools.
- **Species:** add to `src/data/species.js`, implement its ability in `Game.useAbility()` in `src/game/engine.js`, add a test.
- **Sector:** add to `src/data/sectors.js`, then a background + hazard in `src/game/render.js` and `engine.js`.
