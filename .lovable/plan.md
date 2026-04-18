

## Make JSON menu visible in Binder view for all categories

### Problem
In Binder view, the JsonMenu button is currently only visible when Series 1 is selected. When switching to Series 2, Food Fight, or any other category, the entire toolbar (including JsonMenu) disappears.

### Root cause
In `renderBinderView` (src/pages/Index.tsx), there's an early return when `binderGrid` is null/empty. The `binderGrid` only populates for categories that have binder templates loaded — Series 1 has them, but other categories may return null at the moment of render (no templates, loading, or unsupported schema), causing the whole toolbar to be skipped.

### Fix
Restructure `renderBinderView` so the toolbar row containing the JsonMenu and alerts indicator always renders, regardless of `binderGrid` state. Only the grid body below shows the empty state message when `binderGrid` is unavailable.

Specifically:
1. Remove the early `return` when `binderGrid` is null.
2. Always render the top toolbar `<div>` containing the JsonMenu.
3. Conditionally hide binder-specific toolbar items (NFT count, select-all checkbox, completion bar) when `binderGrid` is null — but keep JsonMenu + alerts always visible.
4. Below the toolbar, render either the binder sections OR a "Select a specific series / no templates available" message.

### File affected
- **EDIT** `src/pages/Index.tsx` — refactor `renderBinderView` to always render the JsonMenu/alerts toolbar row, with conditional inner content for binder-specific controls and grid body.

No changes to JsonMenu component, price alerts hook, or other view modes.

