# Fix cropped/misfitted classic puzzle pieces

## What's wrong

The classic (geepeekay) puzzle scans are landscape — every piece image is 350x250. The Puzzle Builder renders every piece in a fixed **portrait** 120x168 frame with `object-cover`, because it was built for the NFT Series 2 pieces (portrait card backs rotated 90 degrees).

So a landscape classic scan is squeezed into a portrait box and centre-cropped: the left and right edges of the artwork are cut off — literally half the puzzle piece is missing — and the visible sliver can never line up with its neighbours.

## The fix

Match the piece frame to the artwork's real orientation, and stop cropping.

- Classic puzzles (OS2 2nd/3rd, OS3 A/B, OS4, OS5 D/E): render in a **landscape** 168x120 frame at default rotation 0, so the whole 350x250 scan is shown edge to edge with nothing cut off.
- NFT Series 2 puzzle: unchanged — portrait 120x168 frame, default rotation 90.
- Use a fit that preserves the full image for the classic pieces so no edge is ever clipped.

Also updated to stay consistent:
- Default layout spacing uses the active puzzle's frame size, so landscape pieces don't overlap on load.
- Scramble stays inside the canvas using the active frame size.
- Saved per-puzzle layouts and imported JSON keep working; a saved position/rotation still wins over the default.

## Technical notes

In `src/components/simpleassets/PuzzleBuilder.tsx`:
- Derive `pieceW` / `pieceH` and `defaultRotation` from the active puzzle (extra puzzle = landscape 168x120 / 0, NFT = portrait 120x168 / 90).
- Thread those through `buildDefaultLayout`, `applyImportedState`, `handleClearJson`, `scramble`, and the piece wrapper style in place of the hard-coded 120/168/rotation-90 values.
- Ensure the classic `<img>` shows the full scan rather than a cropped fill.
- No change to `src/lib/extraPuzzles.ts` — the source artwork is correct.
