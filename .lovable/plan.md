# Fix AtomicAssets card histories: pack opened box + pack art

## What's wrong (checked on your Barbecue Billy #972, asset 1099984984103)
- The chain shows it was minted from a Food Fight pack around 10 Apr 2026, then sent guydgnjzgage -> bum.gpk on 9 Oct 2026. That one transfer is its only movement, so the rest of the history isn't lost; the opening just never gets drawn.
- The "Pack opened" box only appears when our pack-opening records know who opened the card. Those records only cover SimpleAssets openings. Cards opened straight onto AtomicAssets (Food Fight, GameStonk, Crash Gordon and so on) have no entry there, so they get no opening box and no pack picture.

## Changes
1. **Opening box for every AtomicAssets card**
   - Look up the card's creation on the chain to get the date and the account it was created for (the opener).
   - If that lookup fails, use the AtomicAssets creation time plus the sender of the earliest transfer. If neither is known, leave the box out. We never guess.
   - The box shows the opening date, "Pulled by <account>" and the AtomicAssets logo.
2. **Pack art for AtomicAssets packs**
   - Match each AtomicAssets series to its pack: Food Fight, GameStonk, Crash Gordon, and any other that has a bundled pack picture.
   - Show that pack with the same torn top at the same 64px size. Series without a matching picture show the box with no image.
3. **Cards bridged from SimpleAssets** keep their current SimpleAssets opening details. Nothing changes for them.

## Technical details
- New `src/lib/aaOrigin.ts`: `fetchAaMint(assetId)` runs a full-history Hyperion query `atomicassets:logmint` on `act.data.asset_id`, returns `{time, owner, minter}` and caches it per asset. An empty reply counts as unknown.
- New `aaPackSymbol(collection, schema/series)` mapping in `gpkPackMeta.ts`. It reuses the existing pack image keys and returns undefined when there is no match.
- `SimpleAssetDetailDialog`: for native AA cards (not bridged), pass `opener` and `packSymbol` from these sources when provenance is missing.
- Tests: native AA with a mint record shows the opening box and Food Fight pack art. A failed lookup with no transfers shows no box. Bridged cards still use SA provenance.
- Verify live on asset 1099984984103 using the public API.
