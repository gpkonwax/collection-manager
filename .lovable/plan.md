

## Fix Series 1 "All Variants" ordering — simple approach matching Series 2

### Root cause

Series 2 sorts correctly because its localStorage saved order was always built with all its cards together. Series 1 has a **stale saved layout** in localStorage (key `gpk-order-{account}-series1-all`) that was created before `five` schema cards were merged into `series1`.

When `loadOrder` runs, it finds this old saved order, keeps the IDs it recognizes, then **appends** the newly-merged `five` cards at the end (line 358). That's why Series 1 looks split — the AtomicAssets cards appear first (from the old saved order) and the SimpleAssets `five` cards are tacked on at the bottom.

The underlying sort logic (line 183) is identical for Series 1 and Series 2 — sort by `cardid`, then variant rank. It works fine. The problem is purely the stale localStorage overriding it.

### Fix

**`src/pages/Index.tsx`** — 1 small change:

Add a one-time migration that clears stale Series 1 saved layouts. On component mount, if the user has a saved order for `series1`, delete it so the correct default `cardid` sort takes over.

```typescript
// After accountName is set, clear legacy series1 layouts once
useEffect(() => {
  if (!accountName) return;
  const migrationKey = `gpk-s1-migrated-${accountName}`;
  if (localStorage.getItem(migrationKey)) return;
  // Remove stale series1 layouts that predate the five->series1 merge
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(`gpk-order-${accountName}-series1-`)) {
      localStorage.removeItem(key);
    }
  }
  localStorage.setItem(migrationKey, '1');
}, [accountName]);
```

This runs once per account. After clearing, `loadOrder` returns `null`, `customOrder` is `null`, and `gridSlots` falls back to `filtered.map(a => a.id)` — which uses the correct `cardid` sort from the `assets` memo. Future drag-and-drop reordering will save a fresh, correct layout.

### Why this is the right fix

- Series 2 works because it never had a stale layout problem
- The sort comparator is already correct and identical for both series
- No new comparators, no key changes, no complex refactoring needed
- One-time cleanup, then everything works the same way Series 2 does

### Files touched
- `src/pages/Index.tsx` (add one `useEffect`)

