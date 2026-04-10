

## Lock Puzzle Builder Until All 18 Pieces Are Collected

### What changes

**1. Lock the Puzzle Builder tab when pieces are incomplete**
- When the user clicks the "Puzzle Builder" tab and owns fewer than 18 puzzle pieces, show a dialog/overlay instead of the canvas
- The message: "You have X of 18 puzzle pieces. Collect them all to attempt the puzzle!"
- Include a button to switch to the Collection Binder view to see which pieces are missing

**2. Show missing puzzle piece placeholders in Collection Binder**
- When viewing the binder in Series 2 and the user clicks from the puzzle tab (or just generally in binder mode), show placeholder cards for the missing puzzle piece card IDs
- Each placeholder shows the card back image (using `buildGpkCardBackUrl`) with a greyed-out/dimmed style and an AtomicHub market link to buy the missing piece
- Reuse the existing `ExternalLinkWarningDialog` pattern from `MissingCardPlaceholder`

### File changes

**`src/components/simpleassets/PuzzleBuilder.tsx`**
- Add logic at the top of the component: count owned puzzle pieces vs total 18
- If count < 18, render a locked state UI (centered message with piece count, puzzle icon, and a "View in Binder" button) instead of the canvas
- Accept a new optional prop `onSwitchToBinder?: () => void` to let the parent handle tab switching

**`src/pages/Index.tsx`**
- Track the inner Series 2 tab state (`collection` vs `puzzle`) with a controlled state variable
- Pass an `onSwitchToBinder` callback to `PuzzleBuilder` that switches to binder view mode and the collection sub-tab
- In the binder view for Series 2, identify which of the 18 `PUZZLE_CARD_IDS` the user is missing and render placeholder back-image cards for them (in a dedicated "Missing Puzzle Pieces" section or inline)

**`src/components/simpleassets/MissingPuzzlePiecePlaceholder.tsx`** (new file)
- A simpler variant of `MissingCardPlaceholder` specifically for puzzle pieces
- Shows the card back image via `buildGpkCardBackUrl('gpktwoeight', cardId)` in greyscale
- Overlays "Buy on AtomicHub" link pointing to the AtomicHub market filtered by the appropriate template
- Uses `ExternalLinkWarningDialog` for safe external navigation

### Technical notes
- `PUZZLE_CARD_IDS` from `src/lib/puzzlePieces.ts` has all 18 IDs
- The `isPuzzlePiece` and `deduplicateByCardId` helpers already exist in `PuzzleBuilder.tsx` and can be reused/exported
- Card back URLs use `buildGpkCardBackUrl('gpktwoeight', cardid)` — same as the puzzle canvas already does
- For the AtomicHub link on missing pieces, we need the template ID. Since puzzle pieces are SimpleAssets (not AtomicAssets), we can link to the general Series 2 market page or use card ID in the search. If binder templates are available for these IDs, we can use their template IDs directly.

