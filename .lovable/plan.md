

## Fix: Show cardid + quality (a/b side), not variant, on card

### Problem

The `SimpleAsset.quality` field is currently mapped from `combined.variant` (e.g. "base", "prism"), not from the actual `quality` metadata field which holds the a/b side. So the badge shows "16base" instead of "16a".

### Changes

**1. `src/hooks/useSimpleAssets.ts`** — Add a `side` field to `SimpleAsset` for the raw a/b quality:

- Add `side: string;` to the `SimpleAsset` interface
- In the mapping (line 100), add: `side: String(combined.quality ?? '').toLowerCase(),`

**2. `src/hooks/useGpkAtomicAssets.ts`** — Same change for atomic assets:

- Add `side: String(combined.quality ?? '').toLowerCase(),` to the parsed object (around line 85)

**3. `src/components/simpleassets/SimpleAssetCard.tsx`** — Move badge next to name, use `side` instead of `quality`:

- Move the cardid badge from the bottom metadata row up next to the card name
- Use `asset.side` instead of `asset.quality`

```tsx
<div className="flex items-center gap-1.5">
  <p className="text-sm font-semibold text-foreground truncate">{asset.name}</p>
  {asset.cardid && (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese shrink-0">
      {asset.cardid}{asset.side || ''}
    </span>
  )}
</div>
```

- Remove the old cardid badge from the category/source row

**4. `src/components/simpleassets/SimpleAssetCard.tsx`** — Update memo comparison to include `side`:

- Add `prev.asset.side === next.asset.side` to the memo check

### Files touched
- `src/hooks/useSimpleAssets.ts`
- `src/hooks/useGpkAtomicAssets.ts`
- `src/components/simpleassets/SimpleAssetCard.tsx`

