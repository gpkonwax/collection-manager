

## Add Snap-to-Grid to Puzzle Builder

Replace free-form dragging with snap-to-grid positioning so pieces lock into a grid when dropped.

### Changes to `src/components/simpleassets/PuzzleBuilder.tsx`

- Define a grid cell size (e.g. 130×180px to fit the 120×168 cards with 10px gap)
- On pointer up (drop), snap the piece's `x`/`y` to the nearest grid cell: `Math.round(x / cellW) * cellW`
- During drag, show the piece at the raw cursor position for smooth feel; snap only on release
- Initialize pieces in grid-aligned positions (already roughly doing this)
- Optionally render faint grid lines on the canvas background using a CSS repeating linear-gradient or SVG pattern for visual guidance

### No other files changed

