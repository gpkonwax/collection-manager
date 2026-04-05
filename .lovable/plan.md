

## Widen NFT Detail Modal + Rotate Back Image

### Changes (single file: `SimpleAssetDetailDialog.tsx`)

1. **Widen the modal**: Change `sm:max-w-[900px]` → `sm:max-w-[1200px]` on the `DialogContent`.

2. **Rotate the back image 90° clockwise**: Apply `transform: rotate(90deg)` to the back image container (index 1 only). The card face images themselves stay the exact same size — only the back image gets rotated so its left long edge becomes the top.

   The back image container keeps `aspect-[3/4]` and the image inside gets `style={{ transform: 'rotate(90deg)' }}` so the rendered card face dimensions are unchanged.

### No other files touched. No changes to card face sizing, grid cards, or any other component.

