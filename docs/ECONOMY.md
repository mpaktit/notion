# Economy & Monetisation

Design goal: **spending saves time and buys style, but a free player can earn everything.** Premium species are stronger in specific ways (a shield, a score passive) but skill still decides runs — the Common starter has the highest skill ceiling.

## Currencies
| | ✦ Stardust | ◆ Void Crystals |
|---|---|---|
| Role | Soft / grind currency | Rare / premium currency |
| Earned by | Score, pickups in runs, missions, login days, pass, level-ups | Daily mission bonus, login days 5 & 7, every 5th level, achievements, free pass tiers, rare in-run pickups (max 2/run) |
| Spent on | Rare species, Lab upgrades, Standard Cores, Common/Rare shop items | Epic+ species, Prime Cores, Epic+ shop items, premium pass, revives |
| Can be bought | No | Yes (store UI ready; checkout planned for v1.1) |

### Free Void Crystal income (approximate, engaged player)
| Source | Amount |
|---|---|
| Daily mission bonus (all 3 done) | 10 ◆ / day → 70 / week |
| 7-day login calendar | 30 ◆ / week + a Prime Core |
| Level-ups (every 5th level) | 20 ◆ |
| Achievements (one-off) | 305 ◆ total |
| Free pass track | 90 ◆ / season |
| In-run pickups | a few ◆ / run |

≈ 120–150 ◆ per week of regular play → an Epic species every ~3–4 weeks, the premium pass after ~4–5 weeks.

## Sinks & prices
| Item | Price |
|---|---|
| Rare species | 2 500 – 3 500 ✦ |
| Epic species | 450 ◆ or 10 fragments |
| Legendary species | 1 200 ◆ or 20 fragments |
| Mythic species | 3 000 ◆ or 40 fragments |
| Cosmetics | by rarity: Common/Rare in ✦, Epic+ in ◆ |
| Standard Core | 600 ✦ |
| Prime Core | 60 ◆ |
| Premium pass | 600 ◆ (returns 420 ◆ + 7 Prime Cores + 8 exclusive cosmetics) |
| Revive | 5 ◆ first, 15 ◆ second (max 2 per run) |
| Lab upgrades | Stardust only — power is never sold for crystals directly |

## Cosmic Cores (loot boxes)
Odds are **shown in-game before purchase** (Drop rates button) and enforced by pity timers.

| Rarity | Standard Core | Prime Core |
|---|---|---|
| Common | 60 % | — |
| Rare | 30 % | 55 % |
| Epic | 8.5 % | 32 % |
| Legendary | 1.4 % | 11 % |
| Mythic | 0.1 % | 2 % |
| Pity | Epic+ every 15 | Legendary+ every 20 |

Duplicates are refunded as Stardust (scaled by rarity), so a core is never wasted. Species drop as fragments.

## Real-money packs (planned, v1.1)
| Pack | Price | Bonus |
|---|---|---|
| 100 ◆ | $0.99 | — |
| 550 ◆ | $4.99 | +10 % |
| 1 200 ◆ | $9.99 | +20 % (Popular) |
| 2 600 ◆ | $19.99 | +30 % (Best value) |

### Requirements before turning on payments
1. **Server-authoritative balances.** Today the save is client-side and signed, which deters casual editing but is not cheat-proof. Crystal balances, purchases and core rolls must be done on a server.
2. **Payment provider** (Stripe Checkout for web; Apple/Google billing if wrapped as a native app) with webhook-verified fulfilment and idempotent grants.
3. **Accounts & cloud saves** so purchases survive device changes.
4. **Compliance:** published loot-box odds (done), age-gating / parental controls, regional rules (e.g. Belgium & Netherlands restrict paid loot boxes — offer direct-purchase alternatives), refund policy, VAT handling.
