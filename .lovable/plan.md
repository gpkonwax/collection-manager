

## Fix Blurry Cards on 3D Tilt Hover

### Problem
When the 3D perspective transform is applied on hover, the browser's sub-pixel rendering causes the card image to appear blurry. This happens because `perspective()` + `rotateX/Y` triggers compositing at non-integer pixel boundaries.

### Fix
Add `will-change: transform` and `backface-visibility: hidden` to force the element onto its own GPU layer with crisp rendering. Also add `translateZ(0)` to the transform to promote the layer properly and prevent sub-pixel blurring.

### Changes — `src/hooks/useCardTilt.ts`

1. **Update the hover transform** on line 21 to include `translateZ(0)`:
   ```
   perspective(800px) rotateX(…) rotateY(…) translateZ(0) scale(1.03)
   ```

2. **On mouse enter (first move)**, set `backfaceVisibility: 'hidden'` on the card element to prevent blurry sub-pixel rendering during 3D transforms.

3. **On mouse leave**, reset `backfaceVisibility` along with the transform.

### Changes — `src/components/simpleassets/SimpleAssetCard.tsx`

4. **Add inline style** `backfaceVisibility: 'hidden'` to the tilt wrapper div (already has `transformStyle: 'preserve-3d'` and `willChange: 'transform'`).

This is a 3-4 line change across two files.

