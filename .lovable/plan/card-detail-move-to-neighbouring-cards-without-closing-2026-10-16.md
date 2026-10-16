# Card detail: move to neighbouring cards without closing

## What you get
- While a card's details are open, rest the mouse near the left, right, top or bottom edge of the window. A see-through round arrow button fades in at the middle of that edge.
- Clicking it swaps the window to the card beside, above or below that card in the grid you opened it from. The window stays open, scrolls back to the top, and Asset History opens again for the new card.
- An arrow only shows when a card is actually there. At the edge of the grid, or when you open a card from somewhere other than the grid (for example the last-pack strip), there's no arrow for that direction.
- Keyboard arrow keys do the same thing. They're ignored while you're typing or drawing, and while the zoom lens is in use.
- The grid quietly scrolls behind the window so the card you're on stays in view. This means rows that weren't drawn yet still load.

## Which card counts as the neighbour
- It's whatever is visually next to the card on screen right now, in Classic, Binder and Saved view. So it follows your filters, sort order, saved layout and window width.
- Empty slots in Saved view and unowned spaces in Binder are skipped. Movement continues to the next real card in that direction.
- If the neighbour is a stack of copies, the window shows the stack's top copy (the lowest mint), not the stack chooser.

## Technical details
- Grid cells already register in `gridCellRefs` (Classic). The same `data-asset-id` marker gets added to Binder and Saved cells. Neighbours are found from the rendered cell rectangles: same row (closest centre-Y band) for left/right, and nearest centre-X in the next row for up/down. This matches the existing approach of reading the rendered grid columns, so wrapping is never guessed.
- `Index.tsx` remembers which grid opened the details (`detailSource`). It passes `onNavigate(dir)` and `canNavigate` to `SimpleAssetDetailDialog`. Opening from non-grid places leaves navigation off.
- Before looking up up/down neighbours, the virtualised grid scrolls the current cell into view (`scrollIntoView({block:'nearest'})`) so the next row is actually drawn.
- Dialog: four absolutely positioned edge hover zones (about 56px wide) inside `DialogContent`, each with a centred translucent round button (`bg-background/50 backdrop-blur`, cheese icon, opacity 0 until the zone is hovered or focused). The zones sit outside the 3D-tilt card shell, so text sharpness is unaffected. A keydown handler covers the arrow keys, with guards for inputs, the canvas and the lens.
- Tests: a pure `findNeighbour(rects, id, dir)` helper with unit tests for same-row left/right, up/down column matching, the grid edge returning nothing, and empty-slot skipping.
