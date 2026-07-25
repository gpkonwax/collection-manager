
## Root cause

In `src/pages/Index.tsx` (lines 887–896), the "Newest" comparator returns the wrong sign:

```ts
arr.sort((a, b) => {
  const aId = BigInt(a.id);
  const bId = BigInt(b.id);
  return bId > aId ? 1 : bId < aId ? -1 : 0;   // ← inverted
});
```

A comparator that returns `+1` when `b > a` places `a` before `b`, which produces **ascending** order (oldest first). That's why "Newest" appears to do nothing / show oldest cards first. The other sort modes (`name`, `variant`) use the standard `x - y` pattern and are unaffected.

Note: asset IDs are unique per contract, not globally comparable across SimpleAssets and AtomicAssets, but within each contract a higher numeric ID = newer mint. That's the intended behaviour of this sort and doesn't need to change.

## Fix

Flip the sign in the Newest comparator so bigger IDs come first:

```ts
if (sortMode === 'newest') {
  arr.sort((a, b) => {
    try {
      const aId = BigInt(a.id);
      const bId = BigInt(b.id);
      return bId > aId ? -1 : bId < aId ? 1 : 0;   // descending
    } catch {
      return b.id.localeCompare(a.id);              // already descending — keep
    }
  });
  return arr;
}
```

The `localeCompare` fallback is already descending (`b.id.localeCompare(a.id)`) and stays as-is.

## Files touched
- `src/pages/Index.tsx` — 4 characters changed inside the `sortMode === 'newest'` block.

No other logic, filters, view modes, or state paths are affected.
