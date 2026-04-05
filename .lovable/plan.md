

## Fix Series 2: Slow Front Loading + Remove Back Rotation + Shrink Modal

### Problem
1. **Front images load too slowly** — The card-context timeout starts at 12s per gateway, and with 5 gateways that's potentially 60s before finding a working one. Pinata (gateway 0) may be consistently slow for these assets.
2. **Back images are rotated** — The back image has a 90° rotation applied that was never requested for series 2 cards. They should display vertically like the front.
3. **Modal is too wide** — At 1200px it's oversized now that both images will be portrait orientation.

### Changes

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`**
- Remove the entire `if (i === 1)` rotation block (lines 68-90). Render back images identically to front images: same 400px-wide, 3:4 aspect portrait container.
- Shrink modal from `sm:max-w-[1200px]` to `sm:max-w-[900px]` since both images are now portrait side-by-side.

**`src/lib/ipfsGateways.ts`**
- Reduce `card` timeout from 12000ms to 6000ms so dead gateways are skipped faster.
- Reduce `max` from 12000ms to 8000ms.

### Result
- Both front and back display as vertical portraits side-by-side in a narrower modal.
- Dead gateways are abandoned twice as fast, so images load sooner.

