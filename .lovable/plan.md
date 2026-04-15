

## Unify Pen/Magnifier Toggle for Series 1 Detail View

### What changes

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`**:

1. **Change `drawMode` from per-image (`number | null`) to a boolean** — when enabled, both front and back enter draw mode simultaneously (same as magnifier which already applies to whichever image you hover)

2. **Remove per-image pen icon from the label row** — for Series 1 (`isSeries1`), no pen/search toggle appears above the Front or Back labels

3. **Add a unified toggle below the images container** — only for Series 1, render a small row with Search and Pen icons side by side below the landscape back image area. The active mode gets a highlighted style (e.g. `bg-cheese/20 text-cheese` vs muted). Clicking toggles between magnifier and draw mode for all images at once.

4. **For Series 2** — keep the existing per-image pen toggle as-is (Series 2 is not affected by this change since `isSeries1` is false)

### Layout sketch
```text
  [Front label]         [Back label]
  ┌──────────┐    ┌──────────────────┐
  │  front   │    │   back (landscape)│
  │  image   │    │                  │
  └──────────┘    └──────────────────┘
                  [ 🔍  |  ✏️ ]  ← unified toggle, below back
```

### Implementation detail

- `drawMode` becomes `boolean` state (default `false`)
- In the `images.map` loop for Series 1: pass `drawEnabled={drawMode}` to both images, remove the per-image toggle button
- After the images flex container, if `isSeries1 && isDrawable && images.length > 1`, render the toggle row:
  - Two icon buttons (Search, Pen) with the active one highlighted
  - Centered, positioned right after the images div
- For non-Series-1 drawable categories, keep the existing per-image toggle unchanged

