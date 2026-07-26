## Goal
Eliminate the dark vertical bars that appear on either side of portrait card artwork in the grid, which currently tilt along with the card on hover.

## Root cause
In `src/components/simpleassets/SimpleAssetCard.tsx`, the artwork container is a fixed `aspect-square` box painted with `bg-muted/30`. GPK card art is portrait and rendered with `object-contain`, so the muted fill shows through as two opaque vertical bars flanking the image. Because that box is inside the tilt transform, the bars rotate with the card and read as shadow strips on hover.

## Change
Single-file, presentation-only edit:

- `src/components/simpleassets/SimpleAssetCard.tsx`
  - On the `aspect-square` artwork wrapper inside the tilt element, remove the `bg-muted/30` class so the wrapper is transparent.
  - Portrait images then sit directly against the card body (`bg-card`), giving a uniform surface with no visible left/right bars.

## Preserved behavior
- Square grid cell / layout sizing unchanged (still `aspect-square`).
- 3D tilt, glare overlay, and hover ring unchanged.
- `object-contain` retained — no image cropping.
- Animated-GIF paint-containment styles retained.
- Landscape artwork (e.g. Series 1 backs) unaffected since it already fills the width.
- Detail dialog untouched.

## Verification
- Visually confirm in the preview that portrait cards no longer show the two darker vertical strips on hover, and that landscape cards look identical to before.
