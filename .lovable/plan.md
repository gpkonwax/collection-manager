# AtomicHub mint API is live — show real mints everywhere

## Status (verified today)

AtomicHub's SimpleAssets mint endpoint is **open and returning real data**:

```text
GET https://nft-data.api.atomichub.io/v1/simpleassets/mints?asset_ids=100000004478015,...
→ {"success":true,"data":[{"asset_id":"100000004478015","mint":356,"total":398,"burned":0},...]}
```

The homepage collection already uses it: `useGpkAtomicAssets` calls `resolveSaMintsForAssets` and upgrades bridged cards from the bridge-order mint to the true original SimpleAssets mint. So on the main grid, real mint numbers should already be populating.

## What's still showing placeholders

Three spots still hardcode `#--` for bridged cards because they never call the resolver:

1. **Trades dialog** (`TradesDialog.tsx`) — offer thumbnails show `#--` for bridged GPK schemas.
2. **Trade composer** (`TradeComposerDialog.tsx`) — card selectors show `#--` for bridged schemas.
3. **Atomic pack browser** (`AtomicPackBrowserDialog.tsx`) — pack contents show `#--` until resolved.

## What changes

- In the Trades dialog and Trade composer, collect the `sassets_id` values of any bridged cards on screen and run them through the existing `resolveSaMintsForAssets` (batched, cached 30 min, max 3 concurrent requests — no extra load). When the real mint arrives, the ribbon swaps from `#--` to the true `#<mint>`, exactly like the homepage.
- In the Atomic pack browser, do the same for bridged pack contents.
- Update the placeholder tooltip wording ("real mint will populate when available") to reflect that mints now resolve automatically.

## Technical notes

- No new dependencies, no backend changes — reuses `src/lib/saMintResolver.ts` as-is.
- Files touched: `src/components/TradesDialog.tsx`, `src/components/TradeComposerDialog.tsx`, `src/components/simpleassets/AtomicPackBrowserDialog.tsx`, tooltip string in `src/components/simpleassets/SimpleAssetCard.tsx`.
- `OfferAsset` in `src/lib/atomicOffers.ts` may need the asset's `sassets_id` carried through from immutable_data so the resolver can join it — a small additive field, no breaking change.
