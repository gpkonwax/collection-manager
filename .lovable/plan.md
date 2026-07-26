## Goal
Make the bright-mode background less saturated and less flat, so it no longer overwhelms the cards and text.

## Current state
- Bright theme is defined in `src/index.css` under `.bright`.
- `--background` is currently `50 100% 60%` — a fully saturated, flat yellow that fills the viewport.
- `BackgroundDecorations.tsx` adds faint grid lines and blurred orbs, but they are too subtle to break up the solid yellow field.

## Proposed changes

### 1. Desaturate and lighten the base yellow
Update `--background` in the `.bright` block from `50 100% 60%` to something like `50 70% 88%` — a soft cream-yellow that still reads as the bright skin but is much easier on the eyes.

### 2. Add a subtle radial gradient overlay
Instead of a single flat background color, introduce a very soft radial gradient that is slightly lighter in the center and gently darker toward the edges. This removes the "same all the way" look while keeping the yellow identity.

Implementation approach:
- Add a new CSS variable `--background-gradient` in `.bright`.
- Apply it via a `bg-background-gradient` class on the main app wrapper, or use a `::before` pseudo-element on `body` so it sits behind `BackgroundDecorations`.
- Keep `--background` as the fallback solid color for components that need it.

### 3. Strengthen the decorative layer so it registers against the lighter background
With a paler background, the existing pink grid and orbs can be slightly more visible without becoming garish:
- Raise grid opacity from `opacity-[0.015]` to `opacity-[0.04]` in bright mode only.
- Slightly increase orb opacity in bright mode (e.g. from `/15` and `/10` to `/25` and `/20`).

### 4. Optional: very subtle paper/noise texture
Add a tiny `background-image` noise SVG or CSS gradient dither on a fixed overlay at ~3% opacity. This gives the yellow a tactile, printed feel like vintage trading-card packaging. This is optional and can be skipped if the gradient alone is enough.

## Files to touch
- `src/index.css` — new `.bright` background tokens and gradient utility.
- `src/App.tsx` or `src/pages/Index.tsx` — apply the gradient class to the top-level wrapper.
- `src/components/BackgroundDecorations.tsx` — bright-mode opacity tweaks for grid/orbs.

## Verification
- Toggle to bright mode and confirm the landing page background is a soft cream-yellow with gentle depth, not a flat saturated yellow.
- Confirm dark mode is unchanged.
- Confirm cards and text remain readable and the pink/blue accents still pop.