

## Restore JSON menu in Series 2 Binder view

### Root cause
Series 2 has a custom render branch in `src/pages/Index.tsx` (lines 1937-2018) that wraps the binder/classic view in a `Collection` / `Puzzle Builder` sub-tab. This branch bypasses `renderBinderView()` entirely and renders its own toolbar inline (lines 1946-1959). That custom toolbar contains a placeholder `<div className="flex-1" />` where the JsonMenu and alerts indicator should go — they were never added.

The fix from the previous turn correctly patched `renderBinderView`, but Series 2 never reaches that function in Binder mode.

### Fix
In the Series 2 collection sub-tab toolbar (around line 1958), replace the empty `<div className="flex-1" />` with the same JsonMenu + alerts indicator block used in `renderBinderView`. This keeps Series 2's unique sub-tab layout intact while restoring the JSON button.

### File affected
- **EDIT** `src/pages/Index.tsx` (lines ~1946-1959): replace the empty flex spacer with the alerts indicator span and `<JsonMenu />` (same props as in `renderBinderView`).

No changes to JsonMenu, alerts hook, or other view modes.

