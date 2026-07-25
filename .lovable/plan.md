## Problem

After a stuck-card recovery of 25 cards, only 20 animated in — the first 5 in the pack were missing from the deal.

Root cause: the `visibleCount` effect in `src/pages/Index.tsx` (around line 391) computes the furthest dealing-card position against the **unsorted** `[...saAssets, ...aaAssets]` array, not against `sortedFiltered` (the array the grid actually slices with `sortedFiltered.slice(0, visibleCount)`). Under the current sort (e.g. "Recently received"), a dealing card can sit at a much higher index in `sortedFiltered` than in the raw list. Any card beyond `visibleCount` in `sortedFiltered` is never rendered, so `CardDealAnimation` can't measure its grid cell and the card silently disappears from the deal.

The Saved view has the same shape of bug: it slices `savedGridSlots.slice(0, visibleCount)` but `visibleCount` is derived from raw asset indices.

## Fix

Move the `visibleCount` calculation to run **after** `sortedFiltered` and `savedGridSlots` are defined, and derive it from the arrays the grid actually renders:

1. In `src/pages/Index.tsx`, delete the current effect at ~lines 390–402 that uses `[...saAssets, ...aaAssets]`.

2. Add a new effect placed after `sortedFiltered` and `savedGridSlots` are defined that, whenever `dealingCards.length > 0`, finds the maximum index of any dealing card in whichever list backs the current view:
   - Classic / Binder → `sortedFiltered`
   - Saved → `savedGridSlots` (match by slot id)
   Then set `setVisibleCount(prev => Math.max(prev, maxIdx + 12))` so we only ever grow, never shrink below what the user was already scrolled through.

3. Keep the buffer of `+12` so a partial row at the bottom is still measurable.

No changes to preload logic, recovery flow, or `CardDealAnimation` — this is purely making the "how many rows to render" calculation agree with the array the grid slices.

## Verification

- Trigger a 25-card recovery under "Recently received" sort → all 25 cells should be present in the DOM before the deal starts, and all 25 should animate.
- Repeat under "Card # ascending" and in Saved view to confirm both code paths render every dealing card.
