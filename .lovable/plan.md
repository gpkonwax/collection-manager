

## Unify Drawing Experience for Series 2 to Match Series 1

### What changes

Currently Series 1 has a unified toggle (magnifier/pen) with a shared color palette and clear button below the images. Series 2 still uses per-image pen toggles with per-image color palettes. This plan makes Series 2 work identically.

### Changes in `src/components/simpleassets/SimpleAssetDetailDialog.tsx`

1. **Use `drawAll` for all drawable categories** — remove the separate `drawMode` (per-image) state entirely. Both Series 1 and Series 2 use the single `drawAll` boolean.

2. **Remove per-image pen toggle** — delete the `{isDrawable && !isSeries1 && ...}` block that renders per-image Pen/Search buttons above each image label (lines 308-318).

3. **Extend unified toggle to all drawable categories** — change the condition on line 341 from `isSeries1 && isDrawable && images.length > 1` to just `isDrawable && images.length > 1`. This shows the magnifier/pen toggle + color palette + clear button below the images for both Series 1 and Series 2.

4. **Pass unified color and canvas register to all drawable images** — remove the `isSeries1` guards on `drawColor`, `showPalette`, `onColorChange`, and `canvasRegister` props (lines 326-335). All drawable categories now use `unifiedColor` and register their canvases for the unified clear button.

5. **Hide per-image palette** — set `showPalette={false}` for all images since the palette is now always below the container.

6. **Clean up** — remove the `drawMode` state variable and its reset in useEffect since `drawAll` covers everything. The `isDrawing` variable simplifies to just `drawAll` for all drawable categories.

### What stays the same
- Series 2 images are portrait (not landscape) — no layout changes
- Magnifier lens behavior unchanged
- Drawing persistence when toggling modes
- Eraser clears all canvases
- Non-drawable categories unaffected

