

## Increase zoom level and fix landscape lens for back images

### Changes

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`**:

1. **Increase zoom**: Change `ZOOM` from `2.5` to `5` (500% background-size) for a much closer inspection.

2. **Fix landscape lens**: The lens currently shows a circular crop of the raw (portrait) image with swapped coordinates — but the source image is portrait while the display is rotated 90°. For landscape back images, the lens needs to show the image rotated too. This can be done by rendering the lens background with a CSS `transform: rotate(90deg)` on an inner element, or more practically by using a larger lens background approach:

   - When `isLandscape` is true, apply `backgroundSize` that accounts for the 4:3 aspect ratio of the lens area vs the 3:4 source image, and keep the coordinate swap logic.
   - Additionally, add a CSS `transform: rotate(90deg)` on the lens div's background layer using a pseudo-element or a nested div inside the lens, so the zoomed portion appears in landscape orientation matching the displayed card.

   Simplest approach: wrap the lens background in an inner div that is rotated 90° and scaled, mirroring what the base image does:

   ```typescript
   // For landscape lens, use an inner rotated div for the background
   {isLandscape ? (
     <div className="absolute pointer-events-none rounded-full border-2 border-cheese/50 shadow-lg z-50 overflow-hidden"
       style={{ width: LENS_SIZE, height: LENS_SIZE, left: ..., top: ... }}>
       <div style={{
         width: '100%', height: '100%',
         backgroundImage: `url(${resolvedUrl})`,
         backgroundSize: `${ZOOM * 100}%`,
         backgroundPosition: `${bgX}% ${bgY}%`,
         transform: 'rotate(90deg) scale(1.33)',
       }} />
     </div>
   ) : (
     // existing lens div for portrait
   )}
   ```

### Summary of edits
- Line 33: `ZOOM = 2.5` → `ZOOM = 5`
- Lines 75-89: Split lens rendering into landscape (rotated inner div) and portrait (current) variants

### Files touched
- `src/components/simpleassets/SimpleAssetDetailDialog.tsx`

