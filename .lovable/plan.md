

## Fix Rotation Scoring — Correct Target is 90°

### Problem
The back images for puzzle pieces are oriented sideways by default. One clockwise rotation (90°) makes them look correct. But the scoring checks `rotation === 0`, so every correctly-oriented piece fails the check.

### Fix
Single change in `src/components/simpleassets/PuzzleBuilder.tsx`:

- In `computeRating`, change the rotation check from `=== 0` to `=== 90`
- Also update `buildDefaultLayout` to start pieces at `rotation: 90` so they look correct out of the box (before scrambling)

### File changes
**`src/components/simpleassets/PuzzleBuilder.tsx`**:
1. `buildDefaultLayout`: change initial rotation from `0` to `90`
2. `applyImportedState`: change fallback rotation from `0` to `90`
3. `computeRating`: change `rotation === 0` check to `rotation === 90`

