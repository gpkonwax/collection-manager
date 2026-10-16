# Back up AtomicAssets card history ourselves (and fix AA "Pack opened")

## Goal
Keep our own copy of AtomicAssets history for gpk.topps, the same way we already keep SimpleAssets history. That covers mints and pack openings, transfers, burns and confirmed sales. Card details read our copy first and only ask AtomicHub for activity newer than our last update. A card's opening then never goes missing when AtomicHub is down or doesn't list it. Your Barbecue Billy #972 is an example: it was opened around 10 Apr 2026, but no opening box appears today.

## What gets collected
- **Openings:** every gpk.topps AtomicAssets mint, with its date, the account it was minted to (the opener), its template and its series. Bridge mints are tagged as bridge copies, not pack openings.
- **Transfers and burns** of gpk.topps AtomicAssets cards.
- **Sales:** only confirmed AtomicMarket sales and accepted offers, never listings or payouts, which matches the SimpleAssets rule.
- **Packs:** which pack each card was pulled from, where the chain shows the pack being opened (pack burn and unbox in the same transaction). This drives the pack picture.

## How it runs
- **One-time backfill:** a new job resumes from where it stopped and walks the full AtomicAssets history for gpk.topps from 2021 to today. It saves progress in small steps, so GitHub time limits never lose work. Like the SimpleAssets backfill, an empty reply from the history server counts as a failure and is retried, not treated as "nothing happened".
- **Ongoing updates:** after the backfill finishes, the mint refresh job that already runs 8 times a day also adds new AtomicAssets activity from a saved bookmark. If the history server is down, it warns and keeps the old bookmark.
- **Storage:** a new `aa-history` data branch, split per card like the SimpleAssets history. It also goes into a downloadable `gpk-aa-history.zip`, and the Offline backup panel gets a matching "Card history (AtomicAssets)" download and load card in the current format.

## In the app
- Every AtomicAssets card gets a "Pack opened" box with the AtomicAssets logo, its date and the opener. When the pack is known, the box shows that pack's art with the torn top.
- Where the card's data is read from, in order: a loaded ZIP, then our data branch, then live AtomicHub for anything newer than our last update. Duplicate entries from these sources are removed.
- Bridged cards keep their SimpleAssets opening and history, plus the bridge receipt, as they do now.

## Technical details
- `scripts/lib/aaHistory.mjs` and `scripts/backfill-aa-history.mjs`: Hyperion full-history `get_actions` on `atomicassets` (logmint, logtransfer, logburn) and `atomicmarket` (logsalestart/purchasesale/acceptoffer settlements), filtered on `collection_name=gpk.topps`. Writes by-asset shards, `index.json` with bookmarks and `initialBackfillComplete`, and unique temp filenames so file writes never race (the same fix as `saHistory.mjs`).
- `.github/workflows/aa-history-backfill.yml` (dispatch plus a self-requeue until complete). `mint-manifest.yml` gets an incremental step that is gated on `initialBackfillComplete`.
- Pack attribution comes from unbox/burn actions in the same transaction, using the known AA pack contracts (gpkpoolunbox, gpkpools1111, atomicpacksx). The new `aaPackSymbol()` mapping reuses the pack images already bundled.
- Frontend: `src/lib/aaHistoryStore.ts` (ZIP, then raw GitHub, with checksum checks). `TradeHistorySection` merges it with the live AtomicHub results. The opener comes from the stored mint when provenance is missing.
- Tests: logmint is parsed into an opening, bridge mints are excluded from openings, offers and listings never give a price, the refresh gate, and the Barbecue Billy fixture shows an opening box plus Food Fight art.
- AGENTS.md: one rule describing the AA history store and its update path.
