

## Show Puzzle Piece Binder Inside Puzzle Builder Tab

### What changes

Instead of switching the user away to the Collection Binder tab, the locked state in the Puzzle Builder will include an inline binder grid showing all 18 puzzle pieces in order. Owned pieces display as normal cards; missing pieces show as greyed-out placeholders with AtomicHub buy links.

When the user has all 18 pieces, the puzzle canvas shows as normal (no change).

### File changes

**`src/components/simpleassets/PuzzleBuilder.tsx`**
- In the locked state block (lines 288-311), replace the simple "View in Collection Binder" button with an inline grid of all 18 `PUZZLE_CARD_IDS`
- For each card ID: if the user owns it, render the card back image in full color; if missing, render `MissingPuzzlePiecePlaceholder`
- Add a progress indicator (e.g. "12 / 18 collected")
- Remove the `onSwitchToBinder` prop (no longer needed)

**`src/pages/Index.tsx`**
- Remove `handleSwitchToBinder` callback and `onSwitchToBinder` prop from `<PuzzleBuilder>`
- Remove `series2SubTab` state (the puzzle tab can keep its own internal binder)
- Keep the existing Missing Puzzle Pieces section in the main Collection Binder as-is (it's still useful there)

**`src/components/simpleassets/MissingPuzzlePiecePlaceholder.tsx`**
- No changes needed — reused as-is inside PuzzleBuilder

### How the inline binder works

The locked state renders a 6-column grid of all 18 puzzle piece IDs in order. For each ID:
- **Owned**: Show the card back image (`buildGpkCardBackUrl`) at full brightness with a green checkmark badge
- **Missing**: Render `<MissingPuzzlePiecePlaceholder cardId={id} />` (greyed out, links to AtomicHub)

A progress bar or count ("12 / 18 puzzle pieces collected") sits above the grid with the lock message.

