

## Add Exotic Pack Support + Fix GPKMEGA

### Confirmed unbox types
- **EXOFIVE**: `exotic5` — 5 cards
- **EXOMEGA**: `exotic25` — 25 cards
- **GPKMEGA**: `thirty` — 30 cards (currently missing from `UNBOX_TYPE_MAP`, so button is disabled)

### Changes

**1. `src/hooks/useGpkPacks.ts`**
- Add `EXOFIVE: 'Exotic Series 1 Pack'` and `EXOMEGA: 'Exotic Mega Pack'` to `GPK_LABELS`
- Add both to `ALWAYS_VISIBLE`

**2. `src/components/simpleassets/GpkPackCard.tsx`**
- Add to `UNBOX_TYPE_MAP`: `EXOFIVE: 'exotic5'`, `EXOMEGA: 'exotic25'`, `GPKMEGA: 'thirty'`
- Add to `EXPECTED_CARDS`: `EXOFIVE: 5`, `EXOMEGA: 25`, `GPKMEGA: 30`

**3. `src/pages/Index.tsx`**
- Change `SCHEMA_TO_CATEGORY`: map `exotic` to `'exotic'` instead of `'series2'`
- Add to `PACK_CATEGORY_MAP`: `EXOFIVE: 'exotic'`, `EXOMEGA: 'exotic'`
- `CATEGORY_LABELS` already has `exotic: 'Tiger King'` — works as-is

### Result
- Exotic packs appear in "Open Packs" and can be opened
- "Tiger King" category selectable in dropdown filter
- GPKMEGA "Open Pack" button becomes functional

