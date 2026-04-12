
## Fix the card text blur properly

### What I found
The previous tweak is already present in `src/components/simpleassets/SimpleAssetCard.tsx`, so it did not fix the real cause. `CardContent` is flat now, but the whole card still sits inside a `preserve-3d` wrapper and the `<Card>` itself still uses `translateZ(8px)`. Because the title/metadata remain inside that 3D-transformed subtree, the browser keeps rendering the text softly until hover forces a repaint.

### Fix
Refactor `SimpleAssetCard` so only the artwork shell gets the 3D tilt. The text/footer will render outside the 3D subtree as normal 2D content, so it stays sharp all the time.

### Technical details
- Keep `useCardTilt`, but attach it to a dedicated artwork wrapper instead of the entire card
- Remove `transform: translateZ(8px)` from the `<Card>` itself
- Move the glare overlay into the tilted artwork area
- Render `CardContent` with no transform and no `will-change`
- Preserve existing selection, drag/drop, stack count, and hover ring behavior
- If needed, recreate the depth look with flat offset layers/shadows so the card still feels dimensional without blurring text

### Files to change
- `src/components/simpleassets/SimpleAssetCard.tsx` — split the 3D artwork area from the flat text area and remove the full-card 3D transform

### QA
- Verify the title, author, category, and mint text are sharp before hover, during hover, and after mouse leave
- Check cards in Classic, Binder, Saved, and Binder Stack dialog views
- Confirm selection mode, drag/drop, badges, and hover styling still work
- If any browser still shows blur after the split, use the fallback of disabling tilt for `SimpleAssetCard`
