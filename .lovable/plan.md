
## Current behavior

`Recover Stuck Cards` calls `fetchPendingNfts(owner)` in `src/components/simpleassets/PackRevealDialog.tsx` (lines 109-130). It paginates `gpk.topps / pendingnft.a` via `get_table_rows` in ascending PK order:

- `PAGE_SIZE = 500`
- `MAX_PAGES = 20`
- Hard ceiling: **10,000 rows** per scan
- On network error mid-loop it silently returns whatever it already collected
- No signal to the caller (or user) when the cap is hit — `recheckUnclaimed` and `reconstructLatestPackOpen` just see a truncated list

So it can handle a few thousand rows, but an account with heavy stale `done=0` buildup past 10k rows will have the newest unboxings hidden (same class of bug the pagination originally fixed, just at a higher threshold). Because rows are fetched ascending by PK, the *newest* pack is the one that gets cut off — exactly the one users want to recover.

## Goal

Make Recover Stuck Cards reliably find stuck cards for accounts with many thousands of pendingnft rows, and be transparent when a scan is incomplete.

## Plan

1. **Raise + guard the scan ceiling** in `fetchPendingNfts`
   - Bump `MAX_PAGES` to `200` (100k row ceiling) — still bounded to prevent runaway loops.
   - Keep `PAGE_SIZE = 500` (WAX RPC sweet spot; larger pages frequently time out).
   - Add a per-page retry (1 retry with a short backoff) so a single flaky RPC call doesn't silently truncate the result.

2. **Return truncation metadata instead of a bare array**
   - Change the return shape to `{ rows, truncated, pagesFetched, lastError }`.
   - Update the three callers in `src/pages/Index.tsx` (`recheckUnclaimed`, `reconstructLatestPackOpen`, the pack-open follow-up at line 627) and the one in `PackRevealDialog.tsx` (line 191) to read `.rows`.
   - Keep a thin backward-compatible export if needed so `GpkPackCard.tsx` (which does its own paginated fetch) is untouched.

3. **Prefer newest rows first when scanning for "stuck"**
   - Recover Stuck Cards only needs `done=0` rows to act, and users care about the most recent pack. Add an optional `descending` mode to `fetchPendingNfts` that walks the table via `upper_bound` / `reverse: true` so the newest pack is guaranteed to appear even if the account has >100k rows.
   - `recheckUnclaimed` and `reconstructLatestPackOpen` switch to descending scan with an early-exit once we have enough rows to cover the latest `unboxingid` (all rows sharing the max `unboxingid`, plus any `done=0`).

4. **Surface truncation to the user**
   - When `truncated === true` after clicking Recover Stuck Cards, show a toast: "Scanned N rows — collection is very large. Retry if cards are still missing." No silent partial results.

5. **Verification**
   - Unit-level: mock `fetchTableRows` returning `more:true` for >20 pages and confirm the loop now continues, exits at MAX_PAGES with `truncated:true`, and that a mid-loop rejection retries once.
   - Manual: with an account known to have a large pendingnft table, confirm the button locates stuck cards from the most recent unboxing and the toast appears only when the cap is actually hit.
   - No changes to on-chain calls, contracts, or claim logic — only the read/scan path.

## Files touched

- `src/components/simpleassets/PackRevealDialog.tsx` — `fetchPendingNfts` signature + descending mode + retry
- `src/pages/Index.tsx` — three call sites (`recheckUnclaimed`, `reconstructLatestPackOpen`, post-open follow-up), plus truncation toast in the Recover Stuck Cards handler

No UI restyle, no business-logic changes to claiming, no changes to `GpkPackCard.tsx`'s own paginator.
