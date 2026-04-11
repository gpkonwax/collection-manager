

## Fix: Lens Crossover Bug Between Front and Back Cards

### Problem
The magnified clone inside the lens uses hardcoded card widths (400/500px) and reconstructs the layout independently. This doesn't match the actual rendered strip pixel-for-pixel, so when the lens crosses from the front card to the back card, the magnified front image overlaps where the back image should appear.

### Root Cause
The lens renders its own flex layout with `width: cardW * ZOOM` for each card, but the real strip's cards may render at different actual pixel widths (due to flex shrink, container constraints, etc.). The mismatch means the magnified seam doesn't align with the visual seam.

### Fix
Instead of reconstructing the strip layout inside the lens, measure each card image's actual bounding rect relative to the strip, then position each magnified background-image tile at exactly the right spot.

### Changes — `src/components/simpleassets/SimpleAssetDetailDialog.tsx`

1. **Add refs for each card image container** — use a `useRef` array to capture each card's actual DOM element within the strip.

2. **On mouse move, measure actual card positions** — for each card, get its `getBoundingClientRect()` relative to the strip's rect. This gives exact `left`, `top`, `width`, `height` for each card within the strip.

3. **Replace the flex-based magnified clone with absolutely positioned tiles** — inside the lens, render each card as an absolutely positioned `background-image` div using:
   - `left: cardRect.left * ZOOM`  
   - `top: cardRect.top * ZOOM`  
   - `width: cardRect.width * ZOOM`  
   - `height: cardRect.height * ZOOM`  
   
   This guarantees pixel-perfect alignment with the visible strip.

4. **Offset the tile container** so the cursor point is centered in the lens (same `magOffsetX/Y` logic but using strip dimensions from `getBoundingClientRect`).

### Result
- The magnified view is an exact scaled replica of the visible strip
- No overlap or gap at the seam between front and back cards
- Edge magnification still works because the stage padding is unchanged

