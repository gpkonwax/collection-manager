

Agreed — keeping JSONs separate is the right call. Trying to bundle them would get messy as the user may also accumulate per-category/per-collection saved-layout JSONs, and a one-size bundle would force everything into one file when granularity is the whole point.

## Plan: Streamline the existing per-file load flow instead

Keep all current JSON exports/imports separate and unchanged. Reduce the friction of loading multiple files by adding a **single multi-file picker** plus **remembered last-used files** — no bundling, no auto-apply of stale data.

### 1. Multi-file import (one click, many files)
- **EDIT** `src/pages/Index.tsx` (binder header) — change the existing Import buttons (alerts, saved layout, puzzle) into one **"Import JSON(s)"** button that opens a file picker with `multiple` enabled.
- **NEW** `src/lib/jsonRouter.ts` — inspects each selected file and routes by shape:
  - `version + alerts[]` → `usePriceAlerts.importJson`
  - saved-layout shape → existing saved-layout loader
  - puzzle shape (card-id → `{x,y,rotation}`) → existing puzzle loader
  - unknown → skipped with a per-file toast
- After processing, one summary toast: "Imported 3 files — 5 alerts, 12 saved cards, puzzle layout."
- Keeps the per-feature Export buttons untouched (users still get clean, separate downloads).

### 2. "Recent files" quick-load (optional convenience)
- Browsers can't auto-read files from disk for security reasons, so true auto-load isn't possible without re-bundling. As the closest substitute:
- **EDIT** `src/pages/Index.tsx` — after each successful import, store the file's **name + parsed contents** in `localStorage` under `gpk:recent-jsons` (cap: last 8, FIFO).
- Add a small **"Recent" dropdown** next to the Import button listing those entries; clicking one re-applies the cached contents instantly (one click, no file dialog).
- Each entry shows: filename, type badge (Alerts / Saved / Puzzle), and a remove (×) button.
- Note in the dropdown: "Cached locally — re-import the file if you've edited it elsewhere."

### Files
- **NEW** `src/lib/jsonRouter.ts` — shape detection + dispatch.
- **NEW** `src/components/RecentJsonsMenu.tsx` — dropdown for cached recents.
- **EDIT** `src/pages/Index.tsx` — replace 3 Import buttons with one multi-file Import + Recent dropdown; wire to existing hook setters.

### Why this works for the per-category future
- Multi-file picker scales to N saved-layout files without UI changes.
- Recent list naturally surfaces the user's actual working set.
- No bundle format means new JSON types (per-category, per-collection) just need a new branch in `jsonRouter.ts` — no migration headaches.

### Caveats
- Recent-file cache stores parsed JSON, not a file handle, so edits made outside the app aren't picked up automatically — user must re-pick the file. (The File System Access API could fix this but isn't supported in Safari/Firefox; not worth the cross-browser cost.)

