

## Fix Stale Sort Order When Switching Variant Filter

### Problem
When switching between variant filters (e.g., selecting specific variants then back to "All Variants"), the card sort order appears mixed up. This happens because:

1. The localStorage key for custom drag-and-drop order is `gpk-order-{account}-{category}-{source}` — it does NOT include the variant filter
2. When you drag-reorder cards while viewing a specific variant, that partial order gets saved
3. Switching back to "All" loads that same partial order, appends missing cards unsorted at the end, producing a jumbled result

### Fix

**`src/pages/Index.tsx`** — two changes:

1. **Include `variantFilter` in the storage key** so each variant selection gets its own saved order:
   - Change `getStorageKey` to include a variant key component (sorted, joined variant values)
   - This prevents cross-contamination between variant filter states

2. **When `loadOrder` returns `null` (no saved order), don't set `customOrder` to `null`** — this is already correct (falls back to `filtered` order). But we need to ensure the `useEffect` doesn't re-trigger unnecessarily by stabilizing the `filtered` dependency. Add a stable identity check: only call `setCustomOrder` when the loaded order actually differs from the current one.

### Specific changes

```
// Line 368-369: Add variantFilter to storage key
const getStorageKey = useCallback((cat: string, src: string, variants: string[]) => {
  const vKey = [...variants].sort().join(',');
  return `gpk-order-${accountName}-${cat}-${src}-${vKey}`;
}, [accountName]);
```

Update all call sites of `getStorageKey` (lines 396, 456, 515) to pass `variantFilter`.

Also stabilize the `useEffect` on lines 455-458 to avoid unnecessary re-runs by comparing the new order to the current one before calling `setCustomOrder`.

