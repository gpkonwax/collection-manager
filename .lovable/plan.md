## Goal
In the card detail dialog, replace the default magnifier-on-hover behavior with the same 3D tilt effect used on the front-page cards. Magnifier and pencil become explicit opt-in modes selected via the existing toolbar.

## Current behavior
`SimpleAssetDetailDialog` renders each image inside `ImageWithLens`, which always applies the magnifier lens on hover. A toolbar (visible only when the card is drawable and has 2 images) lets the user switch between 🔍 magnifier and ✏️ draw. There is no "tilt" mode, and the front-page tilt (`useCardTilt`) is not used here.

## New behavior
Three mutually exclusive modes for the detail view, applied to BOTH front and back images:
1. **Tilt (default)** — cursor over the image applies the 3D tilt + glare (via `useCardTilt`), matching the front page.
2. **Magnifier (🔍)** — current lens behavior, no tilt.
3. **Draw (✏️)** — current drawing behavior with color palette, no tilt, no lens.

The toolbar becomes:
- Always visible (not gated on `isDrawable` + 2 images), because tilt/magnifier apply to every card.
- Three buttons: Tilt (new, default active), Magnifier, Draw.
- The Draw button is only shown when `isDrawable` (keeps existing category gating).
- The color palette row only shows when Draw is active.

## Implementation (single file: `src/components/simpleassets/SimpleAssetDetailDialog.tsx`)

1. Replace the boolean `drawAll` state with `mode: 'tilt' | 'lens' | 'draw'`, defaulting to `'tilt'`. Reset to `'tilt'` on asset change.
2. Extend `ImageWithLens` props to accept `mode` instead of `drawEnabled`:
   - `mode === 'lens'` → render existing magnifier overlay on hover.
   - `mode === 'draw'` → render `DrawCanvas` active (as today).
   - `mode === 'tilt'` → wrap the media container with a `useCardTilt` instance (one per image so front/back tilt independently). Apply `transform-style: preserve-3d`, `perspective`, and mount the tilt `ref` on the inner media shell (keeping the container's aspect box), plus the glare div — mirroring how the front-page `SimpleAssetCard` composes tilt so text/labels above/below stay outside the transform (per the Card Tilt memory).
   - Retain the "wasDrawn" canvas persistence so switching away from Draw doesn't wipe strokes; canvas becomes inert (`pointer-events: none`) in non-draw modes.
3. Toolbar:
   - Render unconditionally when the dialog has an asset.
   - Buttons: Tilt (🎴 or a lucide icon like `Move3d`), Magnifier (🔍), Draw (✏️ — only when `isDrawable`).
   - Highlight the active mode using the existing `bg-cheese/20 text-cheese` styling.
   - Color palette + Clear button only render when `mode === 'draw'` (unchanged logic, just gated on the new mode).
4. Landscape back (Series 1): tilt still applies; the existing `rotate-90 scale-[1.33]` visual stays on the image itself, and the tilt transform is composed on the outer shell so rotation + tilt coexist (verify visually — if the rotated back looks off, keep tilt disabled specifically for the Series 1 landscape back and note it in the toolbar tooltip).

## Out of scope
- No changes to the front-page card, `useCardTilt`, or any other component.
- No new dependencies.
- No layout/spacing changes beyond adding the third toolbar button.

## Verification
- Open a Series 2 card → detail defaults to tilt on both images; hover tilts front and back; clicking 🔍 switches to lens; clicking ✏️ switches to draw with palette.
- Open a Series 1 card → same, with the landscape back tilting correctly (or explicitly disabled if visually broken by the rotate).
- Open a non-drawable category card → toolbar shows Tilt + Magnifier only.
- Switch modes back and forth — no residual lens, no residual tilt transform, drawn strokes persist across mode toggles until Clear.