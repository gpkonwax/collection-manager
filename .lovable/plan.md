

## Fix multi-file layout import race

### Root cause
When importing N layout JSONs at once, `applyLayoutData` is called N times in the same tick. Each call:
1. Computes a new `pendingImportRef` and overwrites the previous one (only the **last** survives).
2. Calls `setCategoryFilter(targetCategory)` — React batches these, so only the **last** category wins.
3. Calls `setViewMode('saved')`.

Result with [Series 1, Series 2, Tiger King] selected:
- `pendingImportRef` ends up holding **Tiger King's** order keyed to `savedLayoutKey` for Tiger King.
- `categoryFilter` becomes Tiger King.
- Restore effect runs once, applies Tiger King pending → Tiger King looks fine.
- Series 1 & Series 2 imports are **silently lost** from the ref, but their persist effect never fires for them either, so localStorage for those categories is untouched (or worse: the persist effect for the active category writes Tiger King's order under whatever key was active when state settled).

The user reports Series 2 "loaded correctly" — likely coincidence of ordering — and Series 1's order ended up briefly written under Tiger King's key, hence "Series 1 imported into Tiger King".

### Fix

**EDIT** `src/pages/Index.tsx`

1. **Change `pendingImportRef` from a single slot to a Map** keyed by `savedLayoutKey`:
   ```ts
   const pendingImportsRef = useRef<Map<string, { order: string[]; name: string; puzzle?: PuzzlePieceMap }>>(new Map());
   ```
   Each `applyLayoutData` call writes its own entry — no overwrites.

2. **Persist directly to localStorage for non-active categories.** When a layout's target category ≠ current `categoryFilter`, also write `savedOrder` JSON straight into `localStorage` under that category's key immediately, so it survives even if the restore effect for that key never runs in this session. The Map entry is the in-memory fallback for whichever category becomes active.

3. **Restore effect**: when it fires for `savedLayoutKey`, check `pendingImportsRef.current.get(savedLayoutKey)`. If present, apply and `delete()` that entry (don't clear the whole map).

4. **Pick which category to switch to**: when multiple layouts are imported in one batch, switch to the **first** layout's category (most predictable), not the last. Track this with a "category already chosen this batch" guard — but since `applyLayoutData` doesn't know about batches, simpler: only call `setCategoryFilter` if `categoryFilter` is still the original value at call time (skip switch on later calls in the same tick by checking against a ref that records "we already queued a switch this tick").

   Cleaner alternative: **batch-aware router**. Add `applyLayoutDataBatch(layouts: DetectedLayout['parsed'][])` that:
   - Writes every non-active layout straight to its localStorage key.
   - Picks the first layout's category as the switch target, queues only that one in `pendingImportsRef`, calls `setCategoryFilter` once.
   - Returns a summary `{ applied: n, switchedTo: category }`.

   Update `JsonMenu` / route handler to collect all `layout` results from the batch and call `applyLayoutDataBatch` once instead of `applyLayoutData` per file.

5. **Toast** updates: "Imported 3 layouts (Series 1, Series 2, Tiger King) — switched to Series 1. Others saved and ready when you switch categories."

### Why this works
- Map prevents the single-ref overwrite race entirely.
- Direct localStorage writes for non-active categories mean their data is durable even without state churn.
- Switching to the first imported category (deterministic) matches user intent better than "whichever was processed last".
- Single `setCategoryFilter` call avoids React batching collapsing multiple switches.

### Files
- **EDIT** `src/pages/Index.tsx` — convert `pendingImportRef` → Map, add `applyLayoutDataBatch`, persist non-active layouts to localStorage immediately.
- **EDIT** `src/lib/jsonRouter.ts` — `routeOne` stays; add a thin batch grouping in the caller (or new `routeMany` helper that returns grouped results so `Index.tsx` can call `applyLayoutDataBatch` with the full layout list).
- **EDIT** `src/components/JsonMenu.tsx` — call site for `onImportFiles` already passes the full `FileList`; ensure the handler in `Index.tsx` groups layouts and calls the batch variant.

No changes to export logic, puzzle, or alerts paths.

