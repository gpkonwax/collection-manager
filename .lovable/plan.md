

## Show Mint Number on Atomic Pack Browser

### Problem
The pack browser dialog shows `#1`, `#2`, etc. based on array index. AtomicAssets have a real mint number (`template_mint` field from the API) that users see on AtomicHub.

### Changes

**`src/hooks/useGpkAtomicPacks.ts`**
1. Add `template_mint` to `AtomicAssetRaw` interface
2. Add `mints: number[]` to the `AtomicPack` interface (parallel array to `assetIds`)
3. When building the result, extract `template_mint` from each raw asset and store in the `mints` array

**`src/components/simpleassets/AtomicPackBrowserDialog.tsx`**
1. Access `pack.mints` alongside `pack.assetIds`
2. Track `localMints` state alongside `localAssetIds`, keeping them in sync when packs are opened
3. Replace the current `#{globalIdx + 1}` label with `Mint #{mint}` using the real mint number
4. Sort packs by mint number for consistent display

### Technical detail
The AtomicAssets API response includes `template_mint` as a string on each asset object (e.g. `"template_mint": "1523"`). We parse it to a number and pair it with its `asset_id`.

