

## Fix: Magnifying Lens Causing Scrollbar on Modal

### Problem
The lens element is positioned with `absolute` and can extend beyond the right edge of its container. Since the `DialogContent` has `overflow-y: auto`, any horizontal overflow from the lens triggers a scrollbar and causes the content to jump.

### Fix

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`**

Add `overflow: hidden` to the outer container of `ImageWithLens` so the lens circle is clipped when it reaches the edges, preventing it from affecting the modal's scroll:

```tsx
// Line 63-69: Add overflow-hidden to the container div
<div
  ref={containerRef}
  className={`relative overflow-hidden ${isLandscape ? 'aspect-[4/3]' : 'aspect-[3/4]'} bg-muted/30 rounded-lg`}
  ...
>
```

This clips the lens at the image boundary, which is a clean visual behavior — the lens simply gets cut off at the card edge rather than poking out and triggering scrollbars.

