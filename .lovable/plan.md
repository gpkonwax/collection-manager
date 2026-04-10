

## Add hover magnifying lens to card images in NFT detail view

### What it does

When the cursor moves over a card image (front or back), a floating magnifier lens appears nearby showing a zoomed-in portion of the image based on cursor position. Moving the cursor pans the zoomed view. When the cursor leaves the image, the lens disappears instantly. No clicking required.

### Technical approach

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`** — all changes in this file:

1. **Add a reusable `ImageWithLens` sub-component** inside the file that:
   - Tracks mouse position relative to the image container via `onMouseMove`
   - Shows/hides the lens on `onMouseEnter` / `onMouseLeave`
   - Renders the original `IpfsMedia` as the base image
   - Renders a floating lens div (e.g. 200x200px circle with `rounded-full`) positioned near the cursor
   - The lens uses `background-image` with the same IPFS URL, scaled up (e.g. 2.5x zoom), with `background-position` calculated from cursor coordinates
   - Sets `cursor: none` on the image while hovering (the lens replaces the cursor visually)

2. **Replace the current image `<div>` wrapper** (lines 79-83) with `<ImageWithLens>`, passing `imgUrl`, `isLandscape`, label, and the rotation class.

3. **Lens positioning logic:**
   - `mouseX/mouseY` as percentage of container width/height
   - `background-position: ${mouseX}% ${mouseY}%`
   - `background-size: ${zoomFactor * 100}%` (e.g. 250%)
   - Lens positioned offset from cursor so it doesn't obstruct the view
   - For landscape (rotated) backs, the lens will use the raw un-rotated image URL with adjusted coordinates

4. **Styling:** The lens gets a `border-2 border-cheese/50 shadow-lg` glow and `pointer-events-none` so it doesn't interfere with mouse tracking.

### Implementation sketch

```typescript
function ImageWithLens({ url, alt, isLandscape, className }: { ... }) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const ZOOM = 2.5;
  const LENS_SIZE = 180;

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x, y });
  };

  return (
    <div ref={containerRef} className="relative"
         onMouseEnter={() => setHover(true)}
         onMouseLeave={() => setHover(false)}
         onMouseMove={handleMouseMove}
         style={{ cursor: hover ? 'crosshair' : 'default' }}>
      <IpfsMedia url={url} alt={alt} className={className} context="detail" showSkeleton />
      {hover && (
        <div className="absolute pointer-events-none rounded-full border-2 border-cheese/50 shadow-lg z-50"
             style={{
               width: LENS_SIZE, height: LENS_SIZE,
               left: `calc(${pos.x}% - ${LENS_SIZE/2}px)`,
               top: `calc(${pos.y}% - ${LENS_SIZE/2}px)`,
               backgroundImage: `url(${resolvedUrl})`,
               backgroundSize: `${ZOOM * 100}%`,
               backgroundPosition: `${pos.x}% ${pos.y}%`,
               backgroundRepeat: 'no-repeat',
             }}
        />
      )}
    </div>
  );
}
```

The lens needs the resolved image URL (not IPFS hash). We'll use the `useIpfsMedia` hook inside `ImageWithLens` to get the resolved HTTP URL for the `background-image`.

### Files touched
- `src/components/simpleassets/SimpleAssetDetailDialog.tsx` (add `ImageWithLens` component, update image rendering)

