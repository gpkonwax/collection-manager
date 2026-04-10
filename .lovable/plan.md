

## Fix Overly Harsh Puzzle Rating

### Problem
The rating swings from too generous (73 for scrambled) to too harsh (17 for nearly complete). Root causes:

1. **Rigid target grid**: Origin is hardcoded to (20, 20). If the user assembles the puzzle anywhere else on the canvas, every piece is "far from target" even if perfectly arranged relative to each other.
2. **Position scaling too steep**: 200px average distance = 0 points. A slight offset kills the score.
3. **Overlap too punitive**: Adjacent touching pieces in a correct grid trigger overlap detection because bounding box checks don't account for pieces meant to be side-by-side.

### Solution

**Position scoring — use relative accuracy instead of absolute position**:
- Find the "centroid" of all placed pieces, then compare each piece's position relative to centroid against the expected relative position from the ideal grid. This way the puzzle can be assembled anywhere on the canvas.
- Increase the distance threshold from 200px to 400px so small offsets don't tank the score.

**Overlap — add tolerance**:
- Shrink bounding boxes by a few pixels (e.g. 8px inset) before overlap detection so adjacent touching pieces don't count as overlapping.

**Revised scoring stays at same weights** (Time 20, Rotation 20, Position 40, Overlap 20) but with fairer calculations.

### File changes
- **Edit**: `src/components/simpleassets/PuzzleBuilder.tsx` — rewrite `computeRating` (~40 lines changed)

### Technical detail

```text
Position scoring approach:
1. Compute ideal relative offsets for each piece from grid center
   idealRelX[i] = (idx % 6) * W - avgIdealX
   idealRelY[i] = floor(idx / 6) * H - avgIdealY
2. Compute actual centroid of placed pieces
3. For each piece, compare (actualPos - centroid) vs (idealRel)
4. Average distance → score with 400px threshold

Overlap inset:
- Check overlap with (x+4, y+4, w-8, h-8) boxes
  so perfectly adjacent pieces don't trigger penalty
```

