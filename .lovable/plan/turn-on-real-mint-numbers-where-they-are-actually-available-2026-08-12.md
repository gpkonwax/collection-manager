# Turn on real mint numbers where they are actually available

## What I checked, live, just now

- Public AtomicAssets API (`wax.api.atomicassets.io`) for `gpk.topps` bridged cards: still **no real mint**. Example asset `1099511631922` returns `template_mint: "1"` (bridging order) and its immutable data holds only `sassets_id` — no mint or serial field. So the public API has **not** exposed true SimpleAssets mints yet.
- AtomicHub's own mints endpoint (`nft-data.api.atomichub.io/v1/simpleassets/mints`) does return the real numbers today: that same asset is **mint 10 of 422**. The app already calls this endpoint in `src/lib/saMintResolver.ts`.
- The result is already being written onto bridged AtomicAssets cards as `idata.mint` / `idata.maxsupply` — but the card ribbon never reads it, so it keeps showing `#--`.

## What changes

1. Bridged AA cards (series1 / series2 / exotic): the ribbon shows the real resolved mint, e.g. `#10`, with a tooltip stating it is the original SimpleAssets mint out of the total. While the lookup is still in flight it stays `#--`, exactly as now.
2. Native AtomicAssets cards: unchanged — they keep showing their true template mint.
3. Native SimpleAssets cards (contract `gpk.topps` via SimpleAssets): today they always show `#--`. The same AtomicHub endpoint accepts SimpleAssets asset ids directly, so resolve their mints too and show them in the ribbon.
4. If the lookup fails or returns nothing, the ribbon keeps the current blank `#--` placeholder — no error, no layout change.

## Technical notes

- `src/components/simpleassets/SimpleAssetCard.tsx`: `realMint` currently reads a non-existent `asset.mintNumber`. Change the resolution order to: explicit `mintNumber` → `idata.mint` (skipping the bridge value for bridged schemas, which is already stored separately under `idata.bridge_mint`) → native AA `bridge_mint`. Update the tooltip wording to name the source and total.
- `src/hooks/useSimpleAssets.ts`: after assets load, call `resolveSaMintsForAssets` with `assetId === sassetsId` for each SA asset and patch `idata.mint` / `idata.maxsupply` in a follow-up state update — the same non-blocking pattern `useGpkAtomicAssets` already uses.
- No change to `saMintResolver.ts` (batching, session cache and fallbacks already in place) and no backend work.
- The existing "Bridge Mint #N" chip under bridged cards stays as-is, so both numbers remain visible.
