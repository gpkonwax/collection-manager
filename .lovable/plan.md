

## Add Draw/Annotate Mode to NFT Detail Dialog (Series 1 & 2 Only)

### Overview
Add a toggleable pen/draw mode to the NFT detail view for Series 1 and Series 2 cards. Users can scribble names on awards, doodle on cards, etc. All drawings are temporary and cleared when the dialog closes.

### How It Works
- A pen icon button appears next to each card image label (Front/Back) — only for Series 1 (`five`, `series1`) and Series 2 (`series2`) categories
- Clicking the pen toggles between **magnifier mode** (default) and **draw mode**
- In draw mode: the magnifying lens is disabled; instead, an HTML `<canvas>` overlay covers the card image and captures mouse/touch input for freehand drawing
- Strokes render in a visible color (e.g. yellow/cheese) with a thin brush
- When the dialog closes (or the asset changes), all canvas state is discarded — no persistence

### Technical Approach

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`**:

1. **New state**: `drawMode` — tracks which image index (if any) is in draw mode, or `null` for magnifier mode on all
2. **Series check**: `const isDrawableCategory = isSeries1 || asset.category === 'series2'`
3. **Toggle button**: Small `Pen`/`Search` (lucide-react) icon button next to each image label, only shown when `isDrawableCategory` is true
4. **Modify `ImageWithLens`**: Accept a new `drawEnabled` boolean prop
   - When `drawEnabled` is true: disable hover/lens behavior, overlay a transparent `<canvas>` element matching the container dimensions
   - The canvas uses `pointerdown`/`pointermove`/`pointerup` events for drawing
   - Use a `useRef` for the canvas, get 2D context, draw with `lineTo`/`stroke`
   - Canvas has `position: absolute; inset: 0` over the image
5. **Cleanup**: The `useEffect` that resets `showRawJson` on asset change also resets `drawMode` to `null`, which unmounts canvases and clears all drawings
6. **Color picker** (optional simple touch): a small row of 4-5 color dots (yellow, white, red, blue, black) below the pen toggle so users can pick stroke color

### What Stays
- Magnifier lens behavior unchanged when not in draw mode
- All existing metadata, layout, landscape rotation logic untouched
- No data saved anywhere — purely ephemeral fun feature

