# Security Policy

## Reporting a vulnerability
Please **do not open a public issue**. Use GitHub's private
[security advisory form](https://github.com/mpaktit/notion/security/advisories/new). Expect a reply within 72 hours.

## What is in scope
- XSS or script injection (e.g. through pilot names, imported backup codes or save data)
- Content-Security-Policy bypasses
- Service-worker cache poisoning
- Anything that could affect other players once online features ship

## Current security model (v1.0)
- **No server, no accounts, no personal data.** Everything is stored in `localStorage` on the player's device.
- **Strict CSP** (`default-src 'self'`, no inline scripts, no third-party origins).
- **No `innerHTML` with dynamic data.** All UI is built with `src/ui/dom.js`, which only sets text nodes and whitelisted attributes. Pilot names are sanitised and length-limited.
- **Saves** are versioned, schema-sanitised on load, and signed. A failed signature caps currencies rather than trusting them. Imported backup codes go through the same sanitiser.

### Known limitation
A purely client-side game cannot be cheat-proof — the signing key ships with the client. This only affects a player's own local progress. Before real-money purchases or leaderboards go live, currency balances, purchases and scores **must** move to a server that is the source of truth (see [docs/ROADMAP.md](docs/ROADMAP.md)).
