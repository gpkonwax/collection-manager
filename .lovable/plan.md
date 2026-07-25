## Goal

- **Native AA sets** (everything except `series1`, `series2`, `exotic`): the `template_mint` value that currently populates `bridge_mint` is actually the real on-chain mint number. Use it to fill the top `#` ribbon and hide the "Bridge Mint" pill entirely for these cards.
- **Bridged sets** (`series1`, `series2`, `exotic`): keep current behavior — the pill still reads `Bridge Mint #…`, and the top ribbon stays as `--` until real SA mints get plumbed.

## Change (single file: `src/components/simpleassets/SimpleAssetCard.tsx`)

1. Add a small helper near the top of the component:
   ```ts
   const BRIDGED_SCHEMAS = new Set(['series1', 'series2', 'exotic']);
   const isBridgedAA = isAtomic && BRIDGED_SCHEMAS.has(String(asset.category || '').toLowerCase());
   ```
2. Update `realMintDisplay` logic so it prefers, in order:
   - `asset.mintNumber` (future real-mint field, unchanged),
   - `asset.idata?.bridge_mint` **only when** `isAtomic && !isBridgedAA` (native AA — this value is the true template mint),
   - otherwise `--`.
3. Update the pill row condition (line 220) and the inner pill (lines 225–233) so `Bridge Mint #…` only renders when `isAtomic && isBridgedAA && asset.idata?.bridge_mint`. Native AA cards will no longer show the pill; their mint sits in the top ribbon instead.

## Notes

- Bridged schema names confirmed from `src/pages/Index.tsx` `CATEGORY_LABELS` and `src/hooks/useCollectionCompletion.ts`: `series1`, `series2`, `exotic`.
- `asset.category` on AA assets is set to `schema_name` in `src/hooks/useGpkAtomicAssets.ts`, so it's the correct field to branch on.
- No changes to hooks, data fetching, or SA cards. SA `mintInfo` pill (green, non-atomic path) is untouched.
