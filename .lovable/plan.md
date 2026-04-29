# Fix AtomicAssets mint number priority

Today, AA cards show the AtomicAssets `template_mint` as the primary mint number because we overwrite the metadata `mint` field when building the asset. The matching SimpleAssets card correctly shows the original metadata mint (e.g. `#45`), but the bridged AA version shows `#1500` instead. This plan flips the priority so the meaningful collector number wins, while keeping the AA mint visible as secondary context.

## Changes

### 1. `src/hooks/useGpkAtomicAssets.ts`
Stop overwriting `mint`/`maxsupply` when assembling `idata`. Inject the AA values under dedicated underscore-prefixed keys so they can't collide with metadata:

```ts
idata: {
  ...templateData,
  ...raw.immutable_data,
  _template_id: raw.template?.template_id || '',
  _atomic_mint: raw.template_mint || '',
  _atomic_supply: raw.template?.issued_supply || '',
}
```

The original metadata `edition`/`mint`/`serial`/`num`/`mint_num` (when present) now survives untouched.

### 2. `src/components/simpleassets/SimpleAssetCard.tsx`
- Keep the existing emerald primary badge (metadata mint, e.g. `#45 / 1500`).
- Add a secondary yellow badge for AA cards only, when `_atomic_mint` is present, formatted `AA #N / supply` using `bg-cheese/15 text-cheese`.
- If no metadata mint exists (e.g. Exotic AA), the AA badge is shown alone so nothing regresses.
- Mint #1 glow ring stays tied to the **metadata mint = 1** only.

### 3. `src/components/simpleassets/SimpleAssetDetailDialog.tsx`
- Add an "Atomic Mint #" row below the existing "Mint #" row when `_atomic_mint` is present.
- Extend the `metaFields` filter to exclude `_atomic_mint`, `_atomic_supply`, `_template_id` so they don't appear as raw metadata cards.

## Result for your example
- SA card: `#45` (unchanged)
- AA card (same character): `#45` emerald **primary**, `AA #1500 / 1500` yellow **secondary** underneath
- AA detail dialog: two labelled rows — `Mint #45 / 1500` and `Atomic Mint #1500 / 1500`
