

## Fix Rotation & Overlap Scoring for Incomplete Puzzles

### Problem
The user has 12 of 18 puzzle pieces, all correctly rotated and neatly arranged, but scores very low. Two issues:

1. **Position scoring with missing pieces**: The centroid-based comparison assumes pieces are placed at their correct grid slots (with gaps where missing pieces would go). If the user pushes pieces together to make a neat arrangement without leaving gaps for the 6 missing pieces, every piece's relative offset differs from the ideal, tanking the position score.

2. **Overlap with tight grids**: The 8px inset may still be too small when pieces are nudged close together.

### Solution

**Rotation** — no code change needed (12/12 at 0° = full 20 pts). The low score is coming from position and overlap, not rotation.

**Position scoring — be more forgiving**:
- Increase distance threshold from 400px to 600px
- This gives partial credit even when pieces are arranged without gaps for missing ones

**Overlap — increase tolerance**:
- Increase inset from 8px to 20px so pieces can overlap by up to 20px on each edge without penalty
- Reduce penalty from 3 pts to 1.5 pts per overlapping pair

**Also soften grade thresholds** to be achievable with incomplete puzzles:
- A: 80+, B: 65+, C: 50+, D: 35+, F: below 35

### File changes
- **Edit**: `src/components/simpleassets/PuzzleBuilder.tsx` — adjust constants in `computeRating`:
  - `INSET`: 8 → 20
  - Position threshold: 400 → 600
  - Overlap penalty: 3 → 1.5 per pair
  - Grade thresholds: A 80+, B 65+, C 50+, D 35+

