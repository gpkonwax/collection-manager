

## Add 3D Card Depth Effect (Topps-style)

### What It Does
Instead of a flat image that tilts and blurs, the card will look like a physical trading card with visible thickness. When you tilt the card, you see its colored edges -- the top, bottom, left, and right sides of the card become visible, giving it a real 3D "slab" feel. The GPK title/info area at the bottom also pops forward slightly, creating depth separation between the image and the text area.

### How It Works

The technique uses four extra divs positioned behind the card face, each representing one edge of the card. These edge divs are rotated 90 degrees on their respective axes and translated to line up with the card face, creating the illusion of a solid object with about 4-6px of thickness.

```text
  Top edge (rotateX(-90deg) at top)
  ┌──────────────────────┐
  │                      │ ← Left edge (rotateY(90deg))
  │    Card face         │ ← Right edge (rotateY(-90deg))
  │    (the image)       │
  │                      │
  ├──────────────────────┤ ← Info area pushed forward with translateZ
  │  GPK title / info    │
  └──────────────────────┘
  Bottom edge (rotateX(90deg) at bottom)
```

### Files Changed

**1. `src/hooks/useCardTilt.ts`**
- Reduce `scale` from 1.03 to 1.0 (no scaling = no blur from sub-pixel interpolation)
- Increase perspective to 1200px for a gentler, more realistic depth
- Round rotation values to 1 decimal place to reduce re-rasterization jitter
- Remove the `transition` on the wrapper during active hover (instant updates via RAF), re-apply only on mouse leave for smooth snap-back

**2. `src/components/simpleassets/SimpleAssetCard.tsx`**
- Add four "edge" divs inside the tilt wrapper, behind the card face, using `transform-style: preserve-3d`
- Each edge is a narrow strip (4-6px tall/wide) colored to match the card background, rotated 90deg on the appropriate axis, and translated to align with the card's edges
- Add a small `translateZ(2px)` to the CardContent (info section) so the title/metadata appears to float slightly above the card surface
- Remove the permanent `transition: transform` from the wrapper style; instead, `useCardTilt` will apply transition only during mouse-leave reset
- Keep `overflow: hidden` on the Card itself but set `overflow: visible` on the outer 3D wrapper so edges can be seen

**3. `src/components/simpleassets/IpfsMedia.tsx`**
- For `context="card"`, add `image-rendering: auto` and `backface-visibility: hidden` to prevent blur during 3D transforms on all card images (not just GIFs)

### Visual Result
- Cards appear as solid slabs that tilt in 3D space
- Hovering near the top shows the bottom edge; hovering left shows the right edge
- The info text pops forward slightly from the card surface
- The glare overlay still works on top
- No more blur because there is no scaling and transforms update without CSS transition interference
- Drag-and-drop still works (tilt is disabled during drag)

