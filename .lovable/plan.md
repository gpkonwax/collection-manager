

## Investigate & Fix Series 2 Metadata Inconsistencies

### Problem identified

The `SimpleAsset` interface stores the visual variant (base, prism, etc.) in a field called `quality`, while the actual card side (a/b) lives in `idata.quality`. This naming collision was already addressed for Series 1 but may cause mismatches for Series 2, where:

1. **Binder matching** builds keys as `${cardid}:${side}:${variant}` — if the `idata.quality` field is missing or named differently in SimpleAssets vs AtomicAssets templates, cards won't match their placeholders.
2. **Variant normalization** — Series 2 has more variants with inconsistent naming across protocols (e.g., "Tiger Stripe" vs "tiger stripe", "Collectors" vs "collector"). If SimpleAssets idata uses different casing or field names than AtomicAssets template immutable_data, the normalization may produce different results.

### Plan

**Step 1: Add diagnostic logging (temporary)**
In `useSimpleAssets.ts` and `useGpkAtomicAssets.ts`, add `console.log` for Series 2 assets showing the raw `variant`, `quality`, and `cardid` fields from the metadata before normalization. This will reveal the actual field names and values used by each protocol.

**Step 2: Fix field name resolution**
Based on what the logs reveal, update both hooks to check alternate field names. Likely fixes:
- In `useSimpleAssets.ts`: check for `combined.variant || combined.rarity || combined.type` as fallbacks
- In `useGpkAtomicAssets.ts`: ensure template immutable_data fields are correctly merged and the `variant` field is resolved consistently
- Both: ensure the a/b `quality` side is read from the correct source field

**Step 3: Strengthen normalization**
In `gpkVariant.ts`, add any additional aliases discovered from the logs (e.g., "Tiger_Stripe" → "tiger stripe", "Collectors" → "collector").

**Step 4: Remove diagnostic logging**
Clean up the console.logs after confirming the fix.

### Files to modify
- `src/hooks/useSimpleAssets.ts` — add fallback field checks for variant
- `src/hooks/useGpkAtomicAssets.ts` — same
- `src/lib/gpkVariant.ts` — expand alias map if needed
- `src/pages/Index.tsx` — verify binder matching key construction handles both protocols consistently

