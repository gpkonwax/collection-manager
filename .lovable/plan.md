

## Add 3D Tilt Hover Effect to Cards (Main Views Only)

### What it does
Cards in the collection grid tilt in 3D following the cursor on hover, replicating the effect from topps.wdny.io. The detail dialog is excluded — it keeps its existing magnification lens.

### Changes

**1. New file: `src/hooks/useCardTilt.ts`** (~40 lines)
- Returns a ref + `onMouseMove` / `onMouseLeave` handlers
- Calculates `rotateX`/`rotateY` from cursor position relative to card center (max ~15°)
- Applies `transform: perspective(800px) rotateX() rotateY() scale(1.03)` via direct DOM manipulation (no re-renders)
- Smooth CSS transition back to flat on mouse leave
- Accepts a `disabled` flag to skip during drag operations

**2. Edit: `src/components/simpleassets/SimpleAssetCard.tsx`**
- Import and use `useCardTilt({ disabled: isDragging })`
- Attach ref and mouse handlers to the outer card wrapper
- Add `transform-style: preserve-3d`, `will-change: transform`, and `transition: transform 0.15s ease` styles
- Add a subtle glare overlay div (absolute, pointer-events-none, gradient that shifts with cursor)

**3. No changes to `SimpleAssetDetailDialog.tsx`** — the detail dialog keeps the magnification lens as-is.

### File changes
- **New**: `src/hooks/useCardTilt.ts`
- **Edit**: `src/components/simpleassets/SimpleAssetCard.tsx`

