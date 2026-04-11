

## Fix: Lens Should Overflow Card but Not Trigger Modal Scrollbar

### Problem
The previous fix added `overflow-hidden` to the card's container, which clips the lens at the card edge. This means edges of the card become unmagnifiable. The real fix is to let the lens overflow the card freely, but prevent it from causing scrollbars on the modal.

### Approach
1. **Remove `overflow-hidden` from the `ImageWithLens` container** (line 65) — restore the lens's ability to extend past the card edge
2. **Add `overflow-hidden` to the flex wrapper** that holds the card columns (line 135) — this is the parent `div` with `flex flex-col sm:flex-row`. This clips the lens at the content area boundary rather than at the individual card
3. **Also add `overflow-x: hidden`** to the `DialogContent` (line 130) so any remaining edge cases don't trigger a horizontal scrollbar

### Changes

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`**

- Line 65: Remove `overflow-hidden` from the `ImageWithLens` container → `relative ${isLandscape ? ...}`
- Line 130: Add `overflow-x-hidden` to `DialogContent` → `overflow-y-auto overflow-x-hidden`
- Line 135: Add `overflow-hidden` to the images flex wrapper

### Result
- Lens can extend beyond the card edge, so all parts of the card are magnifiable
- Lens gets clipped at the modal content boundary, preventing scrollbar jumps

