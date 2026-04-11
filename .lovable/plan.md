

## Fix: Allow Lens to Reach Card Edges

### Problem
The `onMouseLeave` fires as soon as the cursor exits the card container, making it impossible to magnify the very edges. The lens disappears before reaching the border of the card.

### Approach
Add generous padding to the `ImageWithLens` container so the mouse-tracking area extends well beyond the visible card image. The cursor position is already clamped to 0–100%, so the lens background will correctly show the edge of the card even when the cursor is in the padding zone. The inner image div stays the same size visually.

### Changes

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`**

1. Add `p-[110px] -m-[110px]` (padding equal to half the lens size) to the outer container div so the hover zone extends ~110px beyond the card on all sides
2. Move the `bg-muted/30 rounded-lg` styling to the inner image div since the outer container is now larger than the visible card
3. Adjust the lens position calculation to be relative to the inner image area (subtract padding from mouse coordinates)

```tsx
// Container gets padding for extended hover zone
<div
  ref={containerRef}
  className={`relative p-[110px] -m-[110px]`}
  onMouseEnter={() => setHover(true)}
  onMouseLeave={() => setHover(false)}
  onMouseMove={handleMouseMove}
  style={{ cursor: hover ? 'crosshair' : 'default' }}
>
  <div className={`relative w-full ${isLandscape ? 'aspect-[4/3]' : 'aspect-[3/4]'} bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center`}>
    <IpfsMedia ... />
  </div>
  {/* Lens positioned relative to outer container */}
</div>
```

4. Update `handleMouseMove` to calculate position relative to the inner image area (offset by padding)

### Result
- Cursor can move 110px beyond the card edge before the lens disappears
- Lens stays visible and functional right up to (and slightly beyond) the card edges
- Parent `overflow-hidden` on the flex wrapper still prevents scrollbar issues

