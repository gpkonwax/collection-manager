# Fix piece orientation in the classic puzzles

## What's wrong

The classic (geepeekay) puzzle artwork is already landscape — every scan is 350x250 wide. The Puzzle Builder was built for the NFT Series 2 pieces, which are portrait card backs that must be rotated 90 degrees to lie down. That portrait-first behaviour is applied to every puzzle:

- each piece starts at rotation 90
- each piece sits in a fixed 120x168 portrait frame with `object-cover`

For the classic puzzles this both stands the artwork on its end and crops the landscape scan into a portrait box, so pieces can never line up.

## The fix

Make the piece frame and default rotation depend on the puzzle's native artwork orientation.

- Classic puzzles (OS2 2nd/3rd, OS3 A/B, OS4, OS5 D/E): landscape frame 168x120, default rotation 0, so pieces load already lying down and fitted edge to edge.
- NFT Series 2 puzzle: unchanged — portrait 120x168 frame, default rotation 90.

Also updated to match:
- The default grid spacing when laying pieces out uses the frame size for the active puzzle, so landscape pieces don't overlap.
- Scramble keeps offering all four rotations (still a puzzle), but stays inside the canvas using the active frame size.
- Saved per-puzzle layouts and imported JSON keep working; a saved rotation always wins over the default.

## Technical notes

In `src/components/simpleassets/PuzzleBuilder.tsx`:
- Add an orientation-derived `pieceW` / `pieceH` and `defaultRotation` from the active puzzle (extra puzzle = landscape, NFT = portrait).
- Thread those through `buildDefaultLayout`, `applyImportedState`, `handleClearJson`, `scramble`, and the piece render style instead of the current hard-coded 120/168/rotation 90 values.
- No change to `src/lib/extraPuzzles.ts` URLs — the artwork itself is correct.
