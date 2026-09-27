# Rework bright mode’s background and headings

## Result
Keep the current page, collection grid, cards, controls, interactions, and dark mode exactly as they are. Make bright mode feel like the supplied unofficial GPK banner through a cleaner backdrop and stronger heading typography—not by placing the banner in the app or rebuilding the page.

## Visual direction
- Replace bright mode’s brown background with a near-white paper canvas and a restrained, broad wash of lemon yellow, pink, and cyan. No glowing orbs; keep the wash behind the content so cards and text stay easy to inspect.
- Give the main title and section headings a punchier printed-poster feel: Archivo Black, high-contrast near-black ink, and selective pink/yellow/blue emphasis. Keep heading sizes and wraps practical on mobile.
- Preserve the existing arrangement, wording, ad positions, yellow controls and cards, and the current grid. Make only the small bright-mode contrast adjustments directly caused by switching to a light background—for example, body text, muted text, or a heading that would otherwise disappear.
- Leave dark mode’s backdrop, typography, colors, and decoration untouched.

## Technical approach
- Scope new colors and background/heading treatments to the `.bright` theme in the global design tokens and focused theme classes. Avoid broad changes to shared card or button styles.
- Replace only the bright-mode rendering of `BackgroundDecorations`; retain its dark-mode rendering. Load the display font without changing dark mode’s font.
- Apply the heading treatment to the signed-out title and the collection section headings without restructuring the page.
- Compare bright and dark screenshots at desktop and phone widths, including a signed-in collection if a session is available; check title wrapping, contrast, card readability, and that the grid and its controls still work.

## Scope boundary
No changes to wallet actions, collection filters, pack opening, trading, saved layouts, card rendering or behavior, and no official GPK imagery.
