# Card Deal Animation — Fix Skips & Clunky Scroll

## Root causes (in `src/components/simpleassets/CardDealAnimation.tsx`)

1. **Body scroll is hard‑locked (`document.body.style.overflow = 'hidden'`).**
   This blocks the component's own `window.scrollTo(...)` from moving the page in some browsers (and prevents the user from following the deal). The "stable scrollY" poll then immediately reports stable (scroll never changed), so `beginFly()` fires using a `getBoundingClientRect()` for a cell that is still off‑screen. The card animates to coordinates outside the viewport → **looks "skipped."**

2. **Stability poll is too lenient.** It accepts "stable" after just 2 × 50 ms ticks. Combined with smooth scroll latency, the fly often starts before the cell is actually visible, especially for cards far down the grid.

3. **No verification that the target cell is in‑viewport before flying.** When a card is off‑screen, its rect is still returned and used as the flight target, with no fallback.

4. **No re‑measurement if the user (or layout) shifts things mid‑deal.** Each `flyTarget` snapshot is taken once and never reconciled.

5. **Stack `cardSize` is captured once on mount.** If grid cells haven't rendered yet (common when many packs were just opened), it falls back to 160×160, so subsequent scale math is wrong and cards "snap" off‑target.

## Fix plan

### 1. Replace the hard scroll lock with a soft lock
- Remove `document.body.style.overflow = 'hidden'`.
- Instead, prevent only user‑initiated wheel/touch/keyboard scroll during the brief `flying` + `landed` phases (when a card is mid‑flight), and allow it during `sitting`/`scrolling` so the auto‑scroll can run and the user can watch.
- Implementation: attach `wheel`, `touchmove`, and `keydown` (arrow/space/page keys) listeners with `preventDefault` gated on `phase === 'flying' || phase === 'landed'`. Listeners attached as non‑passive on `window`.

### 2. Use `scrollend` (with timeout fallback) instead of stability polling
- Replace both polling blocks (initial scroll and per‑card scroll) with:
  - `window.addEventListener('scrollend', handler, { once: true })`
  - Fallback `setTimeout` after 1500 ms in case `scrollend` is unsupported or already at target.
  - If `window.scrollY` is already at the desired target (within 2 px) before calling `scrollTo`, skip waiting entirely.

### 3. Guarantee target visibility before flying
- After scrolling, re‑measure the target cell. If its center is still outside the viewport's middle 50 % band, issue a corrective `scrollIntoView({ block: 'center', behavior: 'smooth' })` and wait for `scrollend` again (single retry).
- If, after the retry, the cell still isn't measurable or visible, fall back to marking the card dealt instantly (current behavior) but only after the retry — not on first miss.

### 4. Re‑measure `flyTarget` on the frame before transition starts
- Already partially done; tighten by using two `requestAnimationFrame`s back‑to‑back so the browser has committed the post‑scroll layout before we read `getBoundingClientRect()`.

### 5. Recompute `cardSize` lazily
- If `cardSize` is still the 160×160 fallback when the first `scrolling` phase starts, re‑run `getCardSize()` and update state before measuring `flyTarget`. This fixes the scale mismatch on the first card.

### 6. Minor robustness
- Clear shuffle audio if user clicks Skip mid‑initial‑delay.
- Guard against `cards.length === 0` reaching the deal loop.

## Files touched

- `src/components/simpleassets/CardDealAnimation.tsx` — only this file.

No changes to `Index.tsx`, hooks, or styles. No behavior change to the reveal pipeline that feeds `dealingCards`.

## Verification

- Open a 30‑card Mega pack on a tall grid; confirm every card flies into its slot, the page auto‑scrolls smoothly between bands, and no cards land off‑screen.
- Try to scroll with the mouse wheel during `sitting` (allowed) and during `flying` (blocked) — confirm flights still land on correct cells.
- Click **Skip Animation** at various points; confirm remaining cards appear instantly and shuffle audio stops.
