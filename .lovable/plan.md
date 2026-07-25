## Goal

Make the 3D tilt in the grid card look as sharp and elegant as it does inside the detail dialog — no soft blur on the artwork, and a subtler glare instead of the current bright "light source" spot.

## What's actually different today

Both surfaces use the same `useCardTilt` hook, but the wrappers around it differ in two ways that cause the visual gap:

1. **Image rasterization (blur)**
   - Grid (`IpfsMedia` with `context="card"`) sets on the `<img>`:
     `transform: translateZ(0); backface-visibility: hidden; image-rendering: auto`.
     Combined with the parent `rotateX/rotateY`, this force-promotes the image to its own GPU layer that is then re-sampled while tilted → the slight blur the user sees.
   - Detail (`context="detail"`) does not add those styles, so the image stays sharp under the same rotation.

2. **Glare overlay ("light source" harshness)**
   - Grid glare div in `SimpleAssetCard.tsx` has no `mix-blend-mode` — the white radial gradient from `useCardTilt` paints straight over the art as a bright spot.
   - Detail glare div uses `mixBlendMode: 'overlay'`, so the same gradient reads as a gentle sheen instead of a hotspot.

Both differences are purely presentational; hook logic and tilt math are already identical.

## Changes

Frontend/presentation only.

1. **`src/components/simpleassets/IpfsMedia.tsx`**
   - Stop applying the `translateZ(0) / backfaceVisibility: hidden / imageRendering: auto` style block for `context="card"` on still images. Keep the existing animated-GIF branch untouched (that one genuinely needs layer promotion to avoid flicker). Net effect: still card images render with default rasterization, matching detail view.

2. **`src/components/simpleassets/SimpleAssetCard.tsx`**
   - On the grid glare `<div ref={glareRef}>`, add `mixBlendMode: 'overlay'` (and keep current opacity/transition) so the hook's radial gradient blends softly like it does in the detail dialog.
   - Leave the tilt wrapper, aspect-square media shell, and text area outside the transform exactly as they are (per the "text outside 3D tilt" rule).

3. No changes to `useCardTilt.ts`, no changes to detail dialog, no changes to animated GIF handling, no changes to text/badge layout.

## Verification

- Hover a still card in the grid: artwork stays crisp during tilt, glare reads as a soft sheen rather than a bright dot.
- Hover an animated (GIF) card in the grid: still renders without flicker (GIF branch untouched).
- Open the detail dialog: unchanged.
- Run tsgo to confirm no type regressions.
