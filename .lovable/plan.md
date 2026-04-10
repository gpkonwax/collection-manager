

## Tighten Puzzle Rating System

### Problem
The current rating is far too generous. A fully scrambled mess scores ~73/100 because:
- **Time score** rewards hitting Finish immediately on a scrambled board (you get near-max 40 pts)
- **Placement score** only penalizes overlapping pairs (-2 each), but scrambled pieces often don't overlap much since they're spread across the canvas
- **Rotation score** gives ~7-8 pts just from the 25% of pieces that randomly land at 0°

There's no check for whether pieces are actually in the **correct grid position**.

### Solution — add target-position accuracy

The 18 puzzle pieces form a 6×3 grid. We know the correct order (rows: 55-60, 66-71, 75-80). The rating should measure how close each piece is to its correct target cell.

### Revised scoring (100 pts total)

| Category | Points | How |
|----------|--------|-----|
| **Time** | 0-20 | Same linear scale but halved weight (20 if ≤30s, 0 at 5min) |
| **Rotation** | 0-20 | % of pieces at 0° × 20 |
| **Position accuracy** | 0-40 | For each piece, measure distance from its correct grid cell. Full marks if average distance < 10px, scaling to 0 if average > 200px |
| **Overlap penalty** | 0-20 | Start at 20, lose 3 per overlapping pair |

**Grades**: A (90+), B (80+), C (70+), D (60+), F (<60)

### Target grid
Define a reference grid origin (e.g. top-left of canvas + padding). Each piece's target = `(col * pieceWidth, row * pieceHeight)` based on its card ID position in the sorted PUZZLE_CARD_IDS array.

### File changes
- **Edit**: `src/components/simpleassets/PuzzleBuilder.tsx` — rewrite `computeRating` (~30 lines changed)

