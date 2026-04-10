

## Three-Tab Layout: Classic, Collector Binder, Saved Collection

### Overview
Replace the current 2-tab toggle (Classic View / Collector Binder) with 3 distinct tabs, each with a clear purpose:

1. **Classic** -- Read-only grid of your cards in default sort order. No drag-and-drop, no reordering, no save/load. Just your cards as they are.
2. **Collector Binder** -- Existing binder view, unchanged. Shows template grid with owned/missing placeholders.
3. **Saved** -- A dedicated tab for loading a JSON layout file and viewing cards in that saved arrangement. Save Layout button exports from here. Load Layout imports into here.

This eliminates all the ordering persistence bugs by separating concerns: Classic never stores order, Binder never stores order, and Saved is purely driven by the loaded JSON.

### Changes to `src/pages/Index.tsx`

**1. New state for the 3-tab view**
- Replace `binderView` boolean with a `viewMode` state: `'classic' | 'binder' | 'saved'`
- Add `savedOrder` state (`string[] | null`) that only gets populated when a user loads a JSON file
- Remove `customOrder`, `sessionOrders`, `dragSourceIdx`, `dragOverIdx`, and all drag-and-drop handlers from the main flow -- they are no longer needed since Classic is read-only and Saved is JSON-driven

**2. Tab bar always shows 3 tabs** (not just when a category is selected)
- Classic View (default)
- Collector Binder (only enabled when a specific category is selected, since it needs templates)
- Saved Collection

**3. Classic tab rendering**
- Shows `filtered` cards in their natural sort order (the existing `filtered` useMemo)
- No `draggable` prop, no drag handlers
- Selection mode still works for transfers
- No Save/Load buttons in the header

**4. Collector Binder tab**
- Unchanged from current binder view behavior
- No drag-and-drop (already the case)

**5. Saved tab rendering**
- Shows a "Load Layout" button prominently if no layout is loaded
- When a JSON is loaded, renders cards in the saved order using `savedOrder`
- "Save Layout" button exports the current `savedOrder` (and any edits)
- Drag-and-drop IS enabled here so users can rearrange their saved layout before re-exporting
- Empty slots rendered as before

**6. Header bar changes**
- Move Save/Load Layout buttons out of the sticky header
- Save Layout appears only in the Saved tab
- Load Layout appears in the Saved tab (or as a prompt when no layout is loaded)

**7. Cleanup**
- Remove `sessionOrders` ref, `getStorageKey`, `loadOrder`, and all localStorage order persistence logic
- Remove the `useEffect` that auto-saves `customOrder` to localStorage
- The Saved tab handles its own state independently -- load from JSON, allow reorder, export to JSON

### Technical detail

```text
viewMode state: 'classic' | 'binder' | 'saved'

Classic tab:
  cards = filtered (natural sort)
  draggable = false
  no order persistence

Binder tab:
  cards = binderGrid (template-based)
  draggable = false
  unchanged behavior

Saved tab:
  cards = savedOrder (from loaded JSON)
  draggable = true (drag to reorder)
  Save Layout = export savedOrder to JSON
  Load Layout = import JSON into savedOrder
```

This completely separates the saved/custom ordering concern from the live collection view, eliminating the stale-order bugs entirely.

