

## Improve Binder Deal Animation: Frozen Silhouette Placeholders + Slot-Based Refs

### Problem
1. During dealing, the binder shows a generic pulsing dashed box instead of the card's grayscale silhouette — the card appears to land on "nothing" rather than visually replacing a recognizable shape.
2. Only `owned[0]` gets a ref registered, so duplicate/stacked cards from demo packs can't find their target and get skipped or misplaced.

### Changes (all in `src/pages/Index.tsx`)

**1. Replace pulsing placeholder with frozen silhouette**
When a binder slot has an in-flight card, render a static version of `MissingCardPlaceholder`'s visual (the grayscale image with no overlay/animation) instead of the dashed box. This gives the card a recognizable silhouette to "land on top of." The ref for the animation target attaches to this frozen silhouette element.

**2. Register refs for all owned asset IDs in a slot**
Loop through the entire `owned` array and register every asset ID to the same DOM element in `gridCellRefs`. Check if *any* ID in the slot is in-flight or just-landed, not just `owned[0]`. This fixes demo packs where duplicate copies need different IDs to resolve to the same binder cell.

### Technical Detail

In `renderBinderCard` (line ~599):
- Derive `allIds = owned.map(a => a.id)`
- `isAnyInFlight = allIds.some(id => dealingCardIds.has(id) && !dealtIds.has(id))`
- `anyJustLanded = allIds.some(id => dealtIds.has(id))`
- Ref callback registers/unregisters all IDs in `allIds`
- When `isAnyInFlight`, render the template's grayscale image (same as MissingCardPlaceholder but without the "Buy" overlay, hover effects, or pulse animation) with the ref attached
- When `anyJustLanded`, apply the glow class to the rendered card

No changes to `CardDealAnimation.tsx` or `MissingCardPlaceholder.tsx`.

