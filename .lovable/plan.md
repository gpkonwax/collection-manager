

## Stack duplicate cards in Binder View

### What changes

In binder view, when you own multiple copies of the same card (same template), they will appear as a single stacked card with a badge showing the count (e.g. "x3"). Clicking a stacked card opens an intermediate popup showing all individual cards in that stack. Clicking a specific card from there opens the full detail dialog.

### Implementation

**1. New component: `BinderStackDialog.tsx`**
- A small dialog/popover that receives an array of `SimpleAsset[]` and displays them in a grid
- Each card is a `SimpleAssetCard` that, when clicked, calls the existing `setSelectedAsset` to open the detail dialog
- Shows the template name as a header

**2. Modify `SimpleAssetCard` — add optional `stackCount` prop**
- When `stackCount > 1`, render a badge in the top-right corner showing "x{count}"
- Add a subtle visual stacking effect (offset shadow/border to hint at depth)

**3. Update binder grid rendering in `Index.tsx` (lines 766-788)**
- Currently renders `owned[0]` and ignores duplicates
- Change the click handler: if `owned.length > 1`, open the new `BinderStackDialog` instead of going straight to detail
- If `owned.length === 1`, keep current behavior (direct to detail)
- Pass `stackCount={owned.length}` to `SimpleAssetCard`

**4. State additions in `Index.tsx`**
- `stackedAssets: SimpleAsset[] | null` — the array shown in the stack dialog
- `stackDialogOpen: boolean`
- When user selects a card from the stack dialog, set `selectedAsset` and close the stack dialog

### Files touched
- `src/components/simpleassets/BinderStackDialog.tsx` (new)
- `src/components/simpleassets/SimpleAssetCard.tsx` (add `stackCount` prop + badge)
- `src/pages/Index.tsx` (state + click logic in binder grid)

