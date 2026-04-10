

## Filter demo pack cards by matching series

### Problem
When doing a demo pack open, the sample cards are pulled from the entire collection (`assets`), so a Series 1 demo pack might show Series 2 cards and vice versa.

### Solution
Filter `collectionAssets` by the pack's series before passing to `GpkPackCard`. Use `PACK_CATEGORY_MAP` to determine which series a pack belongs to, then filter assets using `SCHEMA_TO_CATEGORY` to match.

### Changes

**`src/pages/Index.tsx`** (around line 689):

Instead of passing `collectionAssets={assets}`, filter assets to only those matching the pack's series:

```tsx
collectionAssets={assets.filter(a => {
  const assetCat = SCHEMA_TO_CATEGORY[a.category] || a.category;
  return assetCat === PACK_CATEGORY_MAP[pack.symbol];
})}
```

### Files touched
- `src/pages/Index.tsx` (one line change)

