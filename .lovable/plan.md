

## Fix per-series saved-layout JSON imports

### Root cause
`applyLayoutData` (`src/pages/Index.tsx:650`) ignores the `category` field embedded in exported layout JSONs. It only sets the order and switches to Saved view, leaving `categoryFilter` unchanged.

Result: a Series 1 export imported while the user is on Tiger King fills `savedOrder` with Series 1 asset IDs, but the grid filters to Tiger King — every slot resolves as "Missing" (red squares). When the user then switches to the correct category, the restore effect (`useEffect` on `savedLayoutKey`) re-reads localStorage for the new category and overwrites the just-imported state — so Tiger King reads "No Saved Layout".

### Fix

**EDIT** `src/pages/Index.tsx`

1. In `applyLayoutData`, switch the active category **before** writing layout state, so the restore effect runs first and the persist effect writes under the correct key:

   ```ts
   const targetCategory = typeof data.category === 'string' && data.category.trim()
     ? data.category.trim()
     : null;

   // Validate against known categories; fall back to current if unknown.
   const isKnown = targetCategory && (
     targetCategory === 'all' || targetCategory in CATEGORY_LABELS
   );
   if (isKnown && targetCategory !== categoryFilter) {
     setCategoryFilter(targetCategory);
   }
   ```

2. Because the restore effect (`useEffect([savedLayoutKey])`) runs **after** render and would clobber the freshly imported `savedOrder`, defer the layout writes until after the category change has propagated. Use a small "pending import" ref:

   ```ts
   const pendingImportRef = useRef<{ key: string; order: string[]; name: string; puzzle?: PuzzlePieceMap } | null>(null);
   ```

   - In `applyLayoutData`: compute the new `savedLayoutKey` for the target category, store `{key, order, name, puzzle}` in `pendingImportRef`, and set the category. Don't call `setSavedOrder` directly here.
   - Modify the restore effect: when it runs, if `pendingImportRef.current?.key === savedLayoutKey`, apply that pending import (setSavedOrder, setLoadedLayoutName, setImportedPuzzle) instead of reading localStorage, then clear the ref. This guarantees the import survives the category switch.
   - If category didn't actually change, apply immediately (no pending dance needed).

3. Always call `setViewMode('saved')` after queuing/applying.

4. Add `categoryFilter` to `applyLayoutData`'s dependency array.

### Why this works
- The `category` field already lives in every exported layout (`handleExportLayout` line 589 writes it).
- Switching category first means the user lands on the correct binder/saved view automatically — no more red "Missing" squares from category mismatch.
- Routing the import through the restore-effect via `pendingImportRef` prevents the known race where `useEffect([savedLayoutKey])` overwrites freshly imported state.
- Persist effect then writes the imported layout to the correct per-category localStorage key, so future visits restore it normally.

### Edge cases
- Layout JSON with no `category` field (legacy / hand-written): skip the switch, apply to current category as today.
- Layout JSON with an unknown category string: skip the switch, show a toast: `"Layout's category '<x>' is unknown — applied to current view"`.
- Recent-imports re-apply path uses the same `applyLayoutData`, so it's fixed in both flows.

### Files
- **EDIT** `src/pages/Index.tsx` — `applyLayoutData`, restore `useEffect`, add `pendingImportRef`.

No other files need to change. Router, JsonMenu, and exporter logic remain untouched.

