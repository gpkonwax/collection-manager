

## Show Mint Numbers on Cards

### Problem
AtomicAssets cards have mint numbers available via the API's `template_mint` field (e.g., mint #42 of a template), but this field isn't captured during fetch. The existing `getMintInfo` function on `SimpleAssetCard` already displays mint info — it just never finds it for AtomicAssets cards because the data isn't stored.

SimpleAssets cards already work if they have `edition`/`mint` in their `idata`.

### Changes

**1. `src/hooks/useGpkAtomicAssets.ts`** — Capture `template_mint`

- Add `template_mint?: { template_mint_num?: string; max_supply?: string }` to the `AtomicAssetRaw` interface (this is what the AtomicAssets API returns).
- When building the `idata` object, inject `mint: raw.template_mint?.template_mint_num` so the existing `getMintInfo` function picks it up. Also inject `maxsupply: raw.template?.max_supply` for the "X / Y" display.

**2. No other changes needed**

The `getMintInfo` function in `SimpleAssetCard` already checks for `mint` in `idata`/`mdata` and formats it as `#X` or `#X / Y` if supply is available. The detail dialog also already checks these same keys. Both will automatically display mint numbers once the data is present.

### Result
Cards will show a mint badge like `#42 / 500` (or `#42` if no max supply) on both the grid card and the detail dialog.

