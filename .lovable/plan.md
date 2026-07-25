## Goal
Enable 3D tilt on the Series 1 landscape back (currently disabled).

## Why it was disabled
The landscape back is rendered by rotating the child image `rotate(90deg) scale(1.33)` inside a 4:3 container. Tilt was skipped defensively, but the rotate/scale is on the inner `<img>` while tilt transforms live on the outer wrapper — they compose fine. The only real issue is perceived axes: because the visible artwork is rotated 90°, a cursor moving left/right feels like it should tilt around the card's long edge, but the hook currently maps it to `rotateY` of the wrapper (which is the artwork's short edge after rotation).

## Fix
1. `src/hooks/useCardTilt.ts` — accept an optional `landscape?: boolean` option. When true, swap the axes and invert one so the tilt matches the visually rotated card:
   - `rotateX = (x - 0.5) * MAX_TILT * 2`
   - `rotateY = (y - 0.5) * MAX_TILT * 2` (inverted vs portrait to keep "push away from cursor" feel)
   - Adjust signs after a quick visual check; the shape of the change is a 90° axis remap.
2. `src/components/simpleassets/SimpleAssetDetailDialog.tsx`:
   - Remove the `!isLandscape` guard: `const tiltActive = mode === 'tilt';`
   - Pass `landscape: isLandscape` into `useCardTilt`.
   - Keep the inner `rotate-90 scale-[1.33]` on the image. Container stays `aspect-[4/3]` for landscape so tilt math uses the visible bounding box.
   - Leave the glare overlay as-is (it lives on the wrapper, so it naturally follows the tilted plane).
3. No changes to lens or draw modes; they already handle landscape via the existing `bgX/bgY` swap and rotated overlay.

## Verification
- Open a Series 1 card detail, flip to back, confirm cursor tilts the landscape back naturally (top edge tips away when cursor is near the top edge of the visible artwork).
- Confirm portrait fronts/backs still tilt identically to before.
- Confirm switching to Magnifier and Draw still works on the landscape back.

## Feasibility
Yes — fully possible. The earlier "conflict" note was conservative; the transforms are on different DOM nodes and compose cleanly.