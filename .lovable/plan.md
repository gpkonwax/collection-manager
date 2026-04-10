

## Fix: Empty Slots Not Accepting Drops

### Root Cause
The `savedGridSlots` array prepends and appends `EXTRA_EMPTY_SLOTS` empty slots around the `savedOrder` data. However, `handleDrop` swaps items using the grid `idx` directly against `savedOrder`, which is offset by `EXTRA_EMPTY_SLOTS`. So:

- Top empty slot at grid index 0 tries to swap `savedOrder[0]` (wrong — that's the first real card)
- Bottom empty slots reference indices beyond `savedOrder.length`

The indices from the rendered grid don't match `savedOrder` positions.

### Fix in `src/pages/Index.tsx`

**Option A (simplest):** Stop using a separate `savedGridSlots` array with prepended/appended slots. Instead, store the empty slots directly in `savedOrder` itself so grid indices and `savedOrder` indices always match 1:1.

Changes:
1. **`savedGridSlots` memo (line 391):** Remove the prepend/append of `EXTRA_EMPTY_SLOTS`. Just return `savedOrder` directly (with pending cards appended).
2. **`handleSnapshotToSaved` (line 478):** When copying to saved, wrap the IDs with empty slots on both sides: `[...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY), ...ids, ...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY)]`.
3. **`handleImportLayout` (line 420):** When loading a JSON, similarly pad the imported order with empty slots on both sides.
4. **`handleExportLayout` (line 405):** When exporting, strip leading/trailing `EMPTY` values from `savedOrder` before saving so the JSON stays clean.

This way `savedOrder` always contains the empty slots, `savedGridSlots` is just a view of it, and all drag indices align perfectly.

### Summary of file changes
- **`src/pages/Index.tsx`**: ~4 small edits to `savedGridSlots`, `handleSnapshotToSaved`, `handleImportLayout`, and `handleExportLayout`.

