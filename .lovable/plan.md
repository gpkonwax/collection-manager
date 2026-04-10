

## Fix Rotation Score Always Showing 0

### Root cause
The `computeRating` function reads `pieces` from its closure. Due to React's render cycle, the `pieces` Map captured when `handleFinish` calls `computeRating` may be stale — still holding the scrambled rotation values rather than the current ones the user has corrected.

Additionally, `puzzleAssets` is recomputed every render (not memoized), which can cause subtle closure staleness in the callback chain.

### Fix

1. **Use a ref to always read the latest pieces state** — add a `piecesRef` that mirrors `pieces`, and read from it in `computeRating` instead of the closure variable.

2. **Memoize `puzzleAssets`** to prevent unnecessary re-creation and stabilize callback dependencies.

### File changes
- **Edit**: `src/components/simpleassets/PuzzleBuilder.tsx`
  - Add `const piecesRef = useRef(pieces)` and sync it: `useEffect(() => { piecesRef.current = pieces; }, [pieces]);`
  - Memoize `puzzleAssets` with `useMemo`
  - In `computeRating`, read from `piecesRef.current` instead of `pieces`
  - Remove `pieces` from `computeRating`'s dependency array (it reads from ref now)

