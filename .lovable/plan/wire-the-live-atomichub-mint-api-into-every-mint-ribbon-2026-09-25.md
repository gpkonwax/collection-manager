# Wire the live AtomicHub mint API into every mint ribbon

## Status (verified today)

AtomicHub's SimpleAssets mint endpoint is **open and returning real data**:

```text
GET https://nft-data.api.atomichub.io/v1/simpleassets/mints?asset_ids=100000004478015,...
→ {"success":true,"data":[{"asset_id":"100000004478015","mint":356,"total":398,"burned":0},...]}
```

## Root cause of "no mint numbers on the grid"

Two breaks, both confirmed in code:

1. **Bridged AtomicAssets cards (Series 1/2/Exotic):** `useGpkAtomicAssets` already calls `resolveSaMintsForAssets` and writes the real mint into `idata.mint` — but `SimpleAssetCard` never reads it. For bridged AA it only looks at a top-level `asset.mintNumber` field that nothing ever sets, so the ribbon stays `#--` forever.
2. **Plain SimpleAssets cards:** `useSimpleAssets` never fetches mint data at all — the SA table rows don't include it, and the AtomicHub resolver is never called for them. So SA cards only show a mint if the author happened to put one in idata.

## What changes

1. **Card ribbon fix** (`SimpleAssetCard.tsx`): for bridged AA cards, fall back to `idata.mint` (the resolver-upgraded value) when `mintNumber` is absent. Ribbon swaps from `#--` to the true `#<mint>` as soon as the resolver returns.
2. **SimpleAssets mint resolution** (`useSimpleAssets.ts`): after loading SA assets, batch their asset IDs through the existing `resolveSaMintsForAssets` (using each SA asset's own ID as the `sassets_id`) and set `idata.mint` / `idata.maxsupply`. SA cards then show real mints via the existing `getMintInfo` path.
3. **Trades dialog + Trade composer** (`TradesDialog.tsx`, `TradeComposerDialog.tsx`): collect `sassets_id` of bridged cards on screen, run them through the resolver, and swap `#--` for the real mint in the ribbons. `OfferAsset` in `atomicOffers.ts` gains an optional `sassets_id` field carried from immutable_data.
4. **Atomic pack browser** (`AtomicPackBrowserDialog.tsx`): same resolver pass for bridged pack contents.
5. **Tooltip wording**: update "real mint will populate when available" to reflect that mints now resolve automatically.

## Technical notes

- No new dependencies, no backend changes — reuses `src/lib/saMintResolver.ts` (batched, 30-min cache, max 3 concurrent requests).
- Files: `src/components/simpleassets/SimpleAssetCard.tsx`, `src/hooks/useSimpleAssets.ts`, `src/components/TradesDialog.tsx`, `src/components/TradeComposerDialog.tsx`, `src/lib/atomicOffers.ts`, `src/components/simpleassets/AtomicPackBrowserDialog.tsx`.
- Verify with the preview on a wallet holding Series 1 cards in both SA and bridged AA form.
