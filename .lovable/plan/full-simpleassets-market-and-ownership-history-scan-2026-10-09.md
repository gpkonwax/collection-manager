# Full SimpleAssets market and ownership history scan

## Goal
Read every GPK SimpleAssets market and ownership event from the blockchain once, from GPK's launch to today, and keep it in our own records. Then add new events twice a day. Store everything in detail now, so a later analytics page can answer questions no public service can (old SimpleAssets sales, price history, how long cards are held, who flipped what).

## What gets recorded (every event, every GPK card)
- **Sales**: card, price and token, buyer, seller, market, time, transaction.
- **Listings**: asking price, seller, time listed, and how it ended (sold, cancelled, refunded) plus how long it was listed.
- **Plain transfers and P2P trades**: from, to, note, time.
- **Burns** and **bridge sends** to AtomicAssets (end of the SimpleAssets life).
- **Pack token sales and transfers** (`packs.topps`), so pack prices are covered too.
- Block number and action order on every row, so events in the same second stay in order.

Covered markets: the GPK market (`gpkmarket111`), SimpleMarket, and any other market account the scan finds moving GPK cards. These get added to a known-markets list and reported, not dropped silently.

## How the scan runs
Same approach as the pack-opening backfill:
1. **Check step (first)**: sample a few weeks spread across 2020–2023 to confirm every action format, find where the seller of a GPK market sale is recorded (the matching listing step), and list every market account seen. If a sale can't be matched to its seller, it is kept with seller marked "unknown". It is never thrown away.
2. **Backfill**: a resumable background job reads history in time order from the full-history server. Each run works about 5.5 hours, saves its progress and a bookmark, then starts the next run itself. It keeps going until it reaches today and stops if a run makes no progress. Requests are paced to stay under the server's limits. A failed or empty reply counts as a failure and is retried, never skipped.
3. **Ongoing**: once the backfill is finished, the twice-daily mint job adds new events after the bookmark. This replaces the current forward-only transfer log.
4. **Checks**: weekly totals are compared with the server's reported counts. Gaps get written to a report and refetched.

Estimate: one busy week took about 4 minutes. The whole history should take a few days of chained runs.

## What you'll see afterwards
- In a card's Trading history, SimpleAssets cards show their full sales, listings and transfers back to launch, not just transfers since October 2026.
- The events are included in the records ZIP, so they survive if servers go away.
- A summary file (sales per day, volume, average and lowest price per card and variant) ready for the future analytics page. The page itself isn't part of this plan.

## Technical details
- New `scripts/lib/saMarket.mjs`: pure extractors per source (`simpleassets:transfer|burn|offer`, `simplemarket:*`, `gpkmarket111` memos `Purchased for N WAX` / `Sale cancellation (N)` / refunds, `packs.topps:transfer`). Known-markets list plus a discovery log. Unit tests in `scripts/__tests__/saMarket.test.ts` use real sample actions from `/tmp/sa-market-sample.json` saved as fixtures.
- Store: `manifests/sa-history/events/YYYY-MM.json` (compact rows `[ms, block, seq, kind, ids, from, to, price, token, market, memo, tx]`), `manifests/sa-history/index.json` (bookmarks per source, counts, markets seen, gap report), and `manifests/sa-history/summary.json` (daily and per-card aggregates). Per-asset lookup shards `by-asset/NNN.json` follow the existing mint shard scheme.
- `scripts/backfill-sa-history.mjs --max-minutes 320` plus `.github/workflows/sa-history-backfill.yml`, which chains runs only while there is progress and shares the `gpk-manifests` concurrency group.
- `mint-manifest.yml` calls the incremental mode after the backfill-done flag. `collect-sa-transfers.mjs` is retired, and its existing rows are merged into the new store.
- `build-records-zip.mjs` adds `sa-history/`. In `src/lib/saTransfers.ts` and `TradeHistorySection.tsx`, SimpleAssets sales, listings and transfers are read from the by-asset shards (records ZIP first, then raw GitHub, matching the existing record-file rule). The "from October 2026" note is updated.
- Docs: `scripts/README.md` and an `AGENTS.md` rule (one full-history store, sharded by month and by asset, filled by a resumable backfill and extended twice daily). Delete the throwaway `scripts/sample-sa-market.mjs`.
- Test before building: run the backfill locally over the sampled May 2020 week and check that 7,441 sales come out with buyers, prices, and sellers matched or marked unknown.
