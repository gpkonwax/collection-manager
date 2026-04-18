

## Consolidate JSON Buttons into a Single "JSON" Dropdown

### Goal
Replace the row of JSON-related buttons (Import JSON(s), Recent, Export Alerts, Export Layout, Save Puzzle, etc.) with **one tidy dropdown** in the binder header. Sub-actions expand inline; "Recent" expands to show the cached list within the same menu rather than a separate button.

### Approach
Single `DropdownMenu` triggered by a button labeled **"JSON"** (file/braces icon). Inside, group related actions with labels and separators:

```
┌─ JSON ▾ ───────────────────────────────┐
│ IMPORT                                 │
│   Import file(s)…                      │
│   Recent imports          ▸  (submenu) │
│ ─────────────                          │
│ EXPORT                                 │
│   Export alerts                        │
│   Export saved layout                  │
│   Export puzzle layout                 │
│ ─────────────                          │
│ ALERTS                                 │
│   Check alerts now (42s)               │
└────────────────────────────────────────┘
```

- **Recent imports** uses `DropdownMenuSub` → opens a side panel listing cached entries (kind badge + filename + remove ×). Click an entry to re-apply; menu closes.
- Disabled items dim automatically (e.g. Export alerts when `alerts.length === 0`, Check Now during cooldown).
- Item count badges shown inline (e.g. "Recent imports (4)", "Export alerts (3)").
- Hidden file input stays in the DOM; "Import file(s)…" item triggers `inputRef.current.click()`.

### Files

**NEW** `src/components/JsonMenu.tsx`
- Single self-contained component. Props: `{ alerts, onCheckNow, checkNowCooldownSec, onExportAlerts, onExportLayout, onExportPuzzle, onImportFiles, onApplyRecent, layoutHasData, puzzleHasData }`.
- Owns the hidden `<input type="file" multiple accept="application/json" />` and the recent-list submenu (reuses `loadRecentJsons` / `removeRecentJson` from `jsonRouter`).
- Replaces `RecentJsonsMenu.tsx` (kept for now but no longer mounted; can be deleted after verification).

**EDIT** `src/pages/Index.tsx`
- Remove the cluster of individual buttons in the binder header (Import JSON(s), `<RecentJsonsMenu>`, Export Alerts, Export Layout, Check Alerts Now, Save/Load Puzzle if currently rendered there).
- Mount `<JsonMenu />` in their place, passing the existing handlers (`applyAlertsRaw`, `applyLayoutData`, `applyPuzzleData`, `usePriceAlerts` exports, etc.).
- Keep all underlying logic untouched — this is a pure UI consolidation.

**EDIT** `src/components/simpleassets/PuzzleBuilder.tsx` (only if its own Save/Load JSON buttons should also move into the unified menu)
- Lift its `handleSaveJson` / `handleLoadJson` to props so `Index.tsx` can wire them into `JsonMenu`. Keep the in-canvas buttons too if they make sense contextually (puzzle layout is most useful while inside Puzzle view) — TBD based on user preference, default: lift them out and rely on the unified menu.

### Behavior preserved
- Multi-file import, shape detection, recent caching, alert cooldown, all toasts — unchanged.
- Tooltip on the trigger button: "Import, export, and recent JSON files".
- Keyboard accessible (Radix dropdown handles arrow keys / Esc / focus return).

### Why this works
- One button instead of 4-6 → header breathes.
- "Recent" no longer steals header space when empty.
- New JSON types in future (per-category layouts, etc.) just add another menu item — no header re-layout needed.

