

## Fix: Allow magnifying lens to overflow card edges

### Problem
The container div has `overflow-hidden`, which clips the lens when hovering near the card edges. The lens circle gets cut off, making edge areas unzoomable.

### Fix

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`**:

1. Remove `overflow-hidden` from the container div (line 65) — move it to a wrapper around `IpfsMedia` only so the image itself stays clipped but the lens can overflow.

2. Wrap the container in an outer div or change the structure so:
   - The image stays clipped within its rounded container
   - The lens (absolute positioned) is allowed to overflow outside the container bounds

Concrete change: Split line 65's container into two layers:
- Outer div: `relative` + mouse handlers + aspect ratio — **no** `overflow-hidden`
- Inner div wrapping `IpfsMedia`: `overflow-hidden rounded-lg` to clip the image

```tsx
<div
  ref={containerRef}
  className={`relative ${isLandscape ? 'aspect-[4/3]' : 'aspect-[3/4]'} bg-muted/30 rounded-lg`}
  onMouseEnter={() => setHover(true)}
  onMouseLeave={() => setHover(false)}
  onMouseMove={handleMouseMove}
  style={{ cursor: hover ? 'crosshair' : 'default' }}
>
  <div className="w-full h-full overflow-hidden rounded-lg flex items-center justify-center">
    <IpfsMedia ... />
  </div>
  {hover && resolvedUrl && ( /* lens div unchanged */ )}
</div>
```

This lets the lens circle extend beyond the card boundary while the card image itself remains neatly clipped.

### Files touched
- `src/components/simpleassets/SimpleAssetDetailDialog.tsx` — restructure container to allow lens overflow

