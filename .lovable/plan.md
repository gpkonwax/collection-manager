# Retro (1985 Scan) View for Series 1 & 2

Add a toggle that re-grades your Series 1 and Series 2 cards so they look like the aged, scanned originals on geepeekay.com — warmer, less saturated, softer contrast, with a faint print texture. Nothing about the artwork or the data changes; it is purely a visual skin over the existing images.

## What the user sees

- A new **Retro** toggle in the collection toolbar, sitting alongside the existing Sort and Variant controls.
- When on, every Series 1 and Series 2 card in the **grid** and in the **card detail dialog** (front, back, tilt, lens and draw modes) renders with the retro grade.
- Series 3+, Exotic, Crash Gordon, Food Fight, packs and puzzle pieces are unaffected — they stay exactly as they are.
- **Pack opening (reveal + deal animation) is completely untouched**, as requested.
- The toggle remembers its state between sessions, and works in both Dark and Bright skins.

## The look

Applied as a layered CSS grade over the existing artwork:

- Slight desaturation and a warm/yellow shift, mimicking aged cardstock ink.
- Reduced highlight brightness and softened contrast so the bright modern digital scans lose their "glow".
- A very subtle sepia lift plus a low-opacity grain/paper texture overlay for the printed feel.
- A barely-perceptible edge vignette so pieces read as a physical card rather than a flat digital image.

Values will be tuned against the geepeekay OS1 scans side by side, and exposed as CSS variables so they can be nudged later without touching components.

## Technical notes

- **State**: new `useRetroMode` hook (same shape as `useTheme`) storing `gpk-retro` in `localStorage`, returning `{ retro, toggleRetro }`. Wired in `src/pages/Index.tsx` and passed down.
- **Eligibility**: a small helper (`isRetroEligible(asset)`) returns true when the asset category resolves to `series1` or `series2` — covering both SimpleAssets categories and the bridged AtomicAssets schema names, reusing the existing category constants in `src/lib/gpkCategories.ts`.
- **Styling**: a single `.retro-grade` class defined in `src/index.css` using `filter: saturate() sepia() contrast() brightness()` plus a `::after` grain/vignette pseudo-element. Colour values come from new semantic tokens, no hardcoded utility colours.
- **Application points**:
  - `SimpleAssetCard.tsx` — class applied to the media shell only (outside the tilt transform's text layer), so metadata and mint ribbons keep their normal colours and stay sharp.
  - `SimpleAssetDetailDialog.tsx` — same class on the media shell used by all view modes, so the grade follows the card into tilt, lens zoom and draw.
  - Both receive a `retro?: boolean` prop from `Index.tsx`; no changes to fetch, mirror or IPFS logic.
- **Explicitly not touched**: `PackRevealDialog.tsx`, `AtomicPackRevealDialog.tsx`, `CardDealAnimation.tsx`, `PuzzleBuilder.tsx`, pack cards, and the trade composer.
- Grain texture is generated inline (CSS gradients / SVG data URI) rather than a downloaded image, so it adds no network weight and works in the offline bundle.

## Out of scope for now

- Using the actual geepeekay JPG scans as the image source (they exist for base fronts only, no backs or variants).
- Series 3+ retro support — the toggle will simply be a no-op for those cards until you ask to extend it.
