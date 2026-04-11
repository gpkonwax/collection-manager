
## Fix: Turn the card-detail magnifier into one shared lens for the whole image strip

Your suggested behavior is the right fix: the lens should stop being per-image and become one free-floating lens across the full gallery area.

### What is wrong now
- `ImageWithLens` is stateful per card, so hover ends at each individual image boundary.
- The current padding trick is also per image, so right/bottom edges still get cut off.
- When front/back sit side by side, the neighboring card can take over the lens near the seam.

### Implementation plan

**File:** `src/components/simpleassets/SimpleAssetDetailDialog.tsx`

1. **Move lens state up to the shared image area**
   - Replace per-card hover/lens logic with one parent-level magnifier stage.
   - Keep one hover state, one cursor position, and one lens element.

2. **Make the stage span both images plus the gap**
   - Wrap the full front/back image strip in a single relative container.
   - Remove per-card hover ownership and per-card clipping.
   - Move the current `PAD` behavior from each card to this shared container.

3. **Allow edge magnification in every direction**
   - Give the stage extra invisible hover room on the left/right/top.
   - Keep real bottom padding so the lens can travel below the cards without colliding with the metadata section.
   - This lets the lens be mostly or fully clipped before it disappears, so the outer edges and bottom edges stay magnifiable.

4. **Render the lens from the whole stage, not a single card**
   - Inside the circular lens, render a magnified clone of the entire image strip: front card, gap, and back card.
   - Position that clone from stage-relative cursor coordinates.
   - Result: the lens can float over the space between images and still show the correct enlarged content instead of switching cards.

5. **Preserve existing card-specific rendering**
   - Keep the same portrait/landscape rules.
   - Preserve the rotated Series 1 back-image behavior inside both the visible strip and the magnified clone.
   - Reuse the same face-rendering structure so the normal view and magnified view stay visually identical.

6. **Keep scrollbars controlled at the modal boundary**
   - Keep `DialogContent` horizontal overflow hidden.
   - Remove any image-level clipping that cuts the lens off too early.
   - Let the shared stage be the only interaction boundary.

### Technical shape

```text
DialogContent
  Header
  Shared magnifier stage
    visible strip: [front]  gap  [back]
    one free-floating circular lens over the whole strip
  Metadata / raw JSON
```

### Expected result
- You can magnify to the far right, far left, and bottom edges.
- The lens can pass across the gap between front and back.
- No more front/back crossover takeover near the seam.
- The lens only disappears after leaving the larger shared stage, not when crossing an individual card edge.
