# Catch freshly opened SimpleAssets cards in the twice-daily mint refresh

## Goal
Cards minted from SimpleAssets packs (Series 1, Series 2, Tiger King) get their mint numbers within ~12 hours, without waiting for the monthly holders scan or a bridge.

## How it works
Each claimed card logs a `simpleassets::createlog` action with `author: gpk.topps`, the new asset id and the owner. The app already reads this action for pack history. The mint script will:

1. Ask WAX history nodes (Hyperion, same endpoint list the app uses) for `simpleassets:createlog` actions involving `gpk.topps`, starting after a saved timestamp bookmark (`saCreateCursor` in `mints/index.json`).
2. Page forward until caught up. Keep only rows where `author = gpk.topps`, and collect their `assetid`.
3. Add those ids to the lookup list. The existing incremental filter means only ids not already in the backup get sent to AtomicHub.
4. Append new ids to `manifests/gpk-sa-asset-ids.txt`, so the list keeps growing between monthly scans. The workflow commits it with the mint shards.
5. Save the bookmark only after a full successful page-through. If history nodes are down: print a warning, keep the old bookmark, and carry on. The run never exits with code 1 because of this.

First run (no bookmark yet): start from the backup's `generatedAt` minus 2 days as a safety overlap. Repeats are harmless because ids are de-duplicated.

## Edge cases
- Cards claimed but not yet in AtomicHub's index: no mint is returned, so they stay out of the backup and get retried on the next tick. This already works today.
- Hyperion page limits: use `limit=1000` with `after=` / `sort=asc`, and stop after 50 pages per run. Any leftover gets picked up on the next tick.
- Burned or transferred cards don't matter. A mint number never changes.

## Verification
- Run locally with `--incremental`. Confirm it finds recent createlog ids, finds 0 new ones on a repeat run, and saves the bookmark.
- Simulate a history outage with a bad endpoint list. Confirm the run warns and still exits 0.
- Add a small unit test for the createlog filter and id extraction (only author `gpk.topps`, numeric ids).

## Technical details
- Files: `scripts/build-mint-manifest.mjs` (new `readRecentSaMints(cursor)`, merge into `all`, persist `saCreateCursor`, append to the id file), `.github/workflows/mint-manifest.yml` (`git add manifests/gpk-sa-asset-ids.txt` too), `scripts/README.md` note, and an `AGENTS.md` rule.
- Endpoint: `/v2/history/get_actions?filter=simpleassets:createlog&act.author=gpk.topps&after=<iso>&sort=asc&limit=1000`. Fall back to the unfiltered `filter` plus a client-side author check if a node rejects the `act.author` parameter.
