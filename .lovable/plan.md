

## Fix Series 1 sorting — treat all cards as one unified set sorted by cardid

### Problem

Two issues are causing Series 1 cards to appear split/incorrectly ordered:

1. **Categories list uses raw category values** — line 376 builds the category dropdown from `a.category` without normalizing through `SCHEMA_TO_CATEGORY`. So `'five'` (SimpleAssets) and `'series1'` (AtomicAssets) both appear as separate entries.

2. **Stale localStorage layout overrides the default sort** — the grid uses `customOrder` from localStorage (keyed by `series1-all`) which may contain an old saved order that doesn't include the newly-merged `'five'` cards, or has them appended at the end.

The actual combined sort (line 183) correctly sorts all cards by cardid — the problem is that stale saved layouts override it.

### Changes

**`src/pages/Index.tsx`** — 2 fixes:

1. **Normalize categories in the dropdown builder** (line 375-380): Map raw categories through `SCHEMA_TO_CATEGORY` before adding to the set, so `'five'` becomes `'series1'` and doesn't appear separately.

```typescript
const categories = useMemo(() => {
  const fromAssets = new Set(
    assets.map((a) => SCHEMA_TO_CATEGORY[a.category] || a.category)
      .filter((c) => c !== 'packs')
  );
  for (const p of packs) { const cat = PACK_CATEGORY_MAP[p.symbol]; if (cat) fromAssets.add(cat); }
  for (const p of atomicPacks) { const cat = ATOMIC_PACK_CATEGORY_MAP[p.templateId]; if (cat) fromAssets.add(cat); }
  return [...fromAssets].sort();
}, [assets, packs, atomicPacks]);
```

2. **Remove the `five` entry from `CATEGORY_LABELS`** — it was added as a workaround but is no longer needed since `five` will be normalized to `series1` everywhere.

With these two fixes, all Series 1 cards (SimpleAssets + AtomicAssets) will be in one unified `series1` bucket. The filtering at line 386 already normalizes via `SCHEMA_TO_CATEGORY`, so they'll all pass together. The default sort by cardid (line 183) will apply correctly. If there's a stale localStorage layout, it will naturally reconcile via the `loadOrder` logic (line 346-358) which appends new IDs and removes stale ones.

### Files touched
- `src/pages/Index.tsx` (2 small edits)

