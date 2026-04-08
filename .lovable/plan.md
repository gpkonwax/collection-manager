

## Fix Series 1 default sorting by cardid

### Root cause

Series 1 SimpleAssets have category `'five'`, but there is no mapping in `SCHEMA_TO_CATEGORY` to group them under `'series1'`. This means:
1. They appear as a separate `'five'` entry in the category dropdown (unlabeled)
2. They don't show up when the user selects the `'series1'` filter
3. The `'series1'` tab only shows AtomicAssets, which may have a stale custom order saved in localStorage

### Fix

**`src/pages/Index.tsx`** — Two changes:

1. **Add `'five'` to `SCHEMA_TO_CATEGORY`** so SimpleAssets Series 1 cards are grouped under `'series1'`:
```typescript
const SCHEMA_TO_CATEGORY: Record<string, string> = {
  exotic: 'series2',
  five: 'series1',
};
```

2. **Add `'five'` to `CATEGORY_LABELS`** as a safety net (in case it still appears separately):
```typescript
five: 'Series 1',
```

This ensures all Series 1 cards (both SimpleAssets `'five'` and AtomicAssets `'series1'`) appear together under the Series 1 tab, sorted by cardid as the combined `assets` sort already handles.

### Files touched
- `src/pages/Index.tsx` (2 small additions)

