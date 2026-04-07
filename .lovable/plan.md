

## Add "Select All" checkbox in selection mode

### What changes

When the user enters selection mode (clicks "Select"), a "Select All" checkbox appears next to the cancel button. Checking it selects all visible NFTs on the current page. Unchecking it deselects all.

### Implementation

**`src/pages/Index.tsx`** — 3 changes:

1. **Import `Checkbox`** from `@/components/ui/checkbox`

2. **Add "Select All" checkbox next to the Select/Cancel button in both views** (binder view ~line 758, standard view ~line 872):
   - Only visible when `selectionMode` is true
   - Compute `visibleAssetIds` — the IDs of all owned assets currently rendered on screen
   - `checked` = all visible IDs are in `selectedIds`
   - `onCheckedChange`: if checked, add all visible IDs to `selectedIds`; if unchecked, clear `selectedIds`

3. **Visible asset IDs logic**:
   - **Standard view**: extract asset IDs from `gridSlots.slice(0, visibleCount)` that aren't empty slots, filtered through `assetMap`
   - **Binder view**: extract asset IDs from the visible binder grid slots that have `owned` arrays (use `owned[0].id` for each)

### Files touched
- `src/pages/Index.tsx`

