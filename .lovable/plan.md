

## Fix Variant Filtering in Saved Collection View

### Problem
The saved view uses `allAssetMap` (built from all unfiltered `assets`) to look up cards. When you select a variant filter (e.g., "Prism" only), the saved view still shows all cards because it never checks the variant filter — it just checks if the asset ID exists in `allAssetMap`.

### Fix
In `renderSavedView`, filter the saved grid slots so that only cards matching the current variant filter are displayed. Cards that don't match the filter will be hidden (their slots treated as empty), preserving the saved order for when the filter is cleared.

### Technical Details — `src/pages/Index.tsx`

1. **Create a filtered asset map for saved view**: Build a set of asset IDs that pass the current variant filter, using the existing `filtered` list (which already respects variant filtering).

2. **Update `renderSavedView`**: When rendering slots, check if the asset passes the variant filter before displaying it. If a slot's asset doesn't match the filter, skip/hide it rather than showing it. The slot order remains unchanged.

3. **Update the card count** in the saved view header to reflect the filtered count, not the total.

This is a small change — roughly 5-10 lines modified in the saved view rendering logic.

