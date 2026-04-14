

## Remove Puzzle Builder Rating System

### Changes

**`src/components/simpleassets/PuzzleBuilder.tsx`**
- Remove `ratingResult` state (line 131)
- Remove `computeRating` function (lines 149-216)
- Simplify `handleFinish` to just stop the timer without calling `computeRating` (lines 218-221)
- Remove `setRatingResult(null)` from `handleClearJson` (line 307), `scramble` (line 330), and timer toggle (line 373)
- Remove the entire rating result display block (lines 454-479)

**`src/pages/Index.tsx`**
- Update line 1130 to remove the A-F grading reference, keeping only the timer mention. Change to something like: "**Timer Race Mode** — race the clock to assemble the puzzle."

### What stays
- Timer checkbox, timer display, start/stop, elapsed time — all kept intact
- Scramble, Save/Load JSON, rotation — unchanged

