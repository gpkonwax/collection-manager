

## Rotate Series 1 back image to landscape

The container is already landscape (`aspect-[4/3]`, 500px wide), but the actual back image is portrait and needs to be rotated 90° clockwise to display correctly in landscape orientation.

### Change

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`** — Add a CSS rotation to the `IpfsMedia` component when rendering a Series 1 back image:

- When `isLandscape` is true, wrap the media in a container with `rotate-90` (or `-rotate-90`) and use `object-contain` to ensure it fits within the landscape aspect container
- The image itself gets `transform: rotate(90deg)` plus appropriate sizing so it fills the landscape container after rotation

Specifically, change the `className` on the `IpfsMedia` from `"w-full h-full"` to include rotation when `isLandscape`:
```tsx
className={`w-full h-full object-contain ${isLandscape ? 'rotate-90' : ''}`}
```

If `rotate-90` alone doesn't scale correctly (since rotating a portrait image makes it overflow), we may need to also adjust the image dimensions so the rotated portrait fills the landscape box. This can be done by setting the image width/height to swap dimensions via a wrapping div with `origin-center`.

### Files touched
- `src/components/simpleassets/SimpleAssetDetailDialog.tsx` (1 line change on the IpfsMedia className)

