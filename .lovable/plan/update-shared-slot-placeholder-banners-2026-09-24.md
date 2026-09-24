# Update shared-slot placeholder banners

## What will change

1. Add the supplied WaxEDGE artwork as an app image without altering its proportions or content.
2. Extend placeholder banner data so each vacant shared slot can explicitly choose either the new WaxEDGE artwork or the existing yellow CheeseHub artwork.
3. Assign placeholders in visible slot order:
   - First vacant shared slot: WaxEDGE banner, linking to `https://waxedge.app/`.
   - Second vacant shared slot when both positions have vacancies: existing yellow banner, retaining its current CheeseHub advertising link.
4. Keep paid banner rotation, timing, IPFS loading, and full-slot behavior unchanged.
5. Verify these cases in the preview:
   - One half-rented shared position uses WaxEDGE for its vacant half.
   - Two side-by-side shared positions with vacant halves use WaxEDGE first and yellow second.
   - Rented halves continue rotating normally and both placeholder links pass through the existing external-link warning.

## Technical notes

- Store the uploaded WaxEDGE image through the project asset system and import its pointer into the banner display.
- Replace the single placeholder identity with explicit WaxEDGE/yellow variants, assigned deterministically after active positions are assembled.
- Preserve the existing yellow `cheese-banner-placeholder.png`; do not overwrite or remove it.
- Add focused tests around placeholder ordering if the banner hook is readily testable; otherwise validate the rendered banner sources and destinations through the live preview.

## Not included

- No changes to banner rental rules, contract data, rotation intervals, dimensions, or the offline-app download work.
