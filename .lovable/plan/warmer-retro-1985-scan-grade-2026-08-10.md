# Warmer Retro (1985 Scan) Grade

Tune the existing Retro filter so Series 1 & 2 cards look closer to the aged, yellowed originals in the reference image — warmer shadows, more sepia lift, and a stronger "old cardboard" cast without losing the artwork detail.

## What the user sees

- The Retro toggle stays in the same toolbar location and keeps the same eligibility (Series 1 & 2 only).
- When Retro is on, cards in the grid and detail dialog get a noticeably warmer/yellower grade.
- Pack openings, puzzle pieces, Series 3+, Exotic, packs and the trade composer remain untouched.
- The existing CSS variable system is preserved so the grade can still be nudged later.

## The look

Pushed toward the scanned reference on the right side of the uploaded image:

- Higher sepia lift to yellow the whites and warm the shadows.
- A warm hue-rotate nudge so magentas/purples shift toward brown-red instead of staying cool.
- A stronger warm color overlay (`::before`) using amber/orange rather than the current neutral tan.
- Slightly higher grain and vignette opacity so the printed texture reads more like aged cardstock.
- Keep brightness and contrast close to current values so the image does not get muddy.

## Technical notes

- **Only file touched**: `src/index.css` — the `.retro-grade` class and its CSS custom-property defaults.
- No component props, eligibility logic, or application points change.
- New default token values (starting point, to be previewed and refined):
  - `--retro-saturate: 0.95`
  - `--retro-sepia: 0.30`
  - `--retro-contrast: 0.98`
  - `--retro-brightness: 0.98`
  - `--retro-hue: 6deg`
  - `--retro-grain-opacity: 0.10`
  - `--retro-vignette-opacity: 0.20`
  - `--retro-warm-tint: rgba(230, 160, 70, 0.12)` (new overlay tint for the `::before` layer)
- Filter order stays the same: `saturate` → `sepia` → `contrast` → `brightness` → `hue-rotate`.
- The warm tint layer uses `mix-blend-mode: multiply` and sits above the artwork but below any card text/ribbons because the grade is applied only to the media shell.

## Verification

- Build/typecheck passes.
- A quick browser smoke test toggles Retro on/off and the grade is visibly warmer in the grid and detail dialog.
- No changes to pack reveal, puzzle builder, or trade composer.

## Out of scope

- Replacing image sources with actual geepeekay scans.
- Extending the warmer grade to Series 3+ or other categories.
