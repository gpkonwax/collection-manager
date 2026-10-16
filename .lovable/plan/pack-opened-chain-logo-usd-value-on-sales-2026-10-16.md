# Pack-opened chain logo + USD value on sales

## 1. Chain logo on the "Pack opened" box
- The box gets the same round SimpleAssets or AtomicAssets logo the other boxes use (top corner).
- Rule: cards originally minted on SimpleAssets (all bridged cards and plain SA cards) show the SA logo; native AtomicAssets cards (packs opened on AtomicAssets, e.g. later series) show the AA logo.
- If the chain can't be determined, no logo is shown rather than guessing.

## 2. USD value in brackets on every sale
- Sale boxes read e.g. `Sold 2,350 WAX ($112.80)`, using the WAX/USD price on the UTC day of the sale.
- Only confirmed sale prices get a USD figure (same rule as today: never asks or payouts).
- Non-WAX sales (rare token sales) get no USD figure unless the CheeseHub record has that token's price for that day.
- If no price exists for that day, the brackets are simply omitted.

### Price source — important finding
The CheeseHub token-price workflow only started recording on **15 Oct 2026** (two days so far), so it cannot price sales from 2020–2026 on its own. Plan:
- **One-time backfill**: build a small bundled daily WAX/USD table (≈2,300 days, ~40 KB) from a free public daily price history (CryptoCompare daily close, CoinGecko as cross-check), covering Jun 2020 → 14 Oct 2026. Bundled with the app so it works offline.
- **Ongoing**: for dates from 15 Oct 2026 onward, read CheeseHub's `token-price-data` branch (`data/days/YYYY-MM-DD.json`, field `waxUsd`), cached per day for the session.
- Bundled table wins for its range; CheeseHub fills newer days.

## Technical details
- `TradeHistorySection.tsx`: pass `chain` to the origin `Milestone` (derived from `isAtomic && !saId` → 'aa', else 'sa'); add `usd` text after price in `EventMilestone` for `kind === 'sale'`.
- New `src/lib/waxUsd.ts`: `waxUsdOn(date)` → bundled `src/data/wax-usd-daily.json` first, then fetch + memoise CheeseHub day file (raw GitHub, 5–8s timeout, failure = no brackets).
- One-off script `scripts/build-wax-usd.mjs` to generate the bundled table; result committed.
- Tests: USD = amount × that day's rate (UTC day boundary), missing day → no USD, non-sale rows never get USD, SA vs AA origin logo rule.
- Record the price-source rule in the components AGENTS.md.
