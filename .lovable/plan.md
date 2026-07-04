# Fix: Rotate buttons should stay in place, card rotates beside them

## Problem
In `src/components/simpleassets/PuzzleBuilder.tsx`, each piece is a single absolutely-positioned `<div>` that carries `transform: rotate(...)`. The rotate buttons live **inside** that same rotating wrapper. Even though they're counter-rotated (`rotate(-Xdeg)`) to stay visually upright, they still **orbit around the card's center** as the card spins — so they slide to a new screen position after each 90° press.

## Fix
Split the piece into two nested elements:

1. **Outer wrapper** — absolutely positioned at `s.x / s.y`, no rotation. This is the stable anchor.
2. **Inner card** — the 120×168 card visual with `transform: rotate(${s.rotation}deg)` applied here only.
3. **Rotate button row** — moved out of the rotating inner and placed as a child of the outer wrapper, positioned at a fixed offset (e.g. `bottom: -32px; left: 50%; translateX(-50%)`). No counter-rotation needed anymore since its parent never rotates.

The buttons will now sit at the same screen coordinates regardless of card rotation, and the card visually rotates next to them.

## Technical detail

Change lines ~409–465 in `src/components/simpleassets/PuzzleBuilder.tsx`:

```tsx
<div
  key={asset.id}
  className={`absolute select-none group ${isSelected ? 'z-20' : 'z-10'}`}
  style={{ left: s.x, top: s.y, width: 120, height: 168 }}
  onClick={() => setSelectedId(asset.id)}
>
  {/* Rotating card */}
  <div
    className="absolute inset-0 cursor-grab active:cursor-grabbing"
    style={{
      transform: `rotate(${s.rotation}deg)`,
      transformOrigin: 'center center',
    }}
    onPointerDown={(e) => handlePointerDown(asset.id, e)}
  >
    <div className={`w-full h-full rounded-md overflow-hidden border-2 ${isSelected ? 'border-cheese ...' : 'border-border'}`}>
      {/* image + cardid label unchanged */}
    </div>
  </div>

  {/* Fixed-position rotate controls — no counter-rotation */}
  <div
    className={`absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
  >
    <Button ... onClick={... rotate(asset.id, 'ccw') ...}>...</Button>
    <Button ... onClick={... rotate(asset.id, 'cw') ...}>...</Button>
  </div>
</div>
```

Notes:
- Drag handlers (`onPointerDown`) move to the inner rotating element so dragging the card still works; the outer wrapper stays as the layout anchor whose `left/top` the drag updates (unchanged logic).
- Selection click stays on the outer wrapper.
- Because the card can visually overflow the 120×168 anchor box when rotated 90° (its rotated bounding box is 168×120), that's fine — only the visual overflows; the button anchor stays put. If needed we can add `pointer-events-none` guards, but existing button `stopPropagation` already handles clicks.

## Files touched
- `src/components/simpleassets/PuzzleBuilder.tsx` (only)
