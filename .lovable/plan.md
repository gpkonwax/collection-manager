
## Why the deal animation broke

With virtualization, only ~30-60 cards exist in the DOM at any time. The deal animation does this per card:

1. `gridCellRefs.current.get(card.id)` — looks up the destination cell's DOM node
2. If found → scroll to it, fly the card there, land
3. If **not** found → silently skip the card entirely

Before virtualization, every card was always mounted, so step 1 always succeeded. Now most target cells don't exist until the virtualizer scrolls them into view — so most cards get silently skipped, and the animation appears broken.

The one-shot `scrollToCardIndex(maxIdx)` in `Index.tsx` (line 236) only scrolls to the *last* dealing card on mount. It doesn't bring each intermediate card's row into view as dealing progresses.

## Fix

Wire the virtualizer's `scrollToCardIndex` into the animation's per-card scrolling phase, then wait for the target row to actually mount before measuring and flying.

### Changes

**1. `src/components/simpleassets/CardDealAnimation.tsx`**
- Add a new prop: `getCardIndex: (id: string) => number | null` — caller maps card id → absolute card index in the visible list.
- Add a new prop: `scrollToCard: (cardIndex: number) => void` — caller proxies to the virtualizer.
- In the `scrolling` phase, before the DOM lookup:
  - Call `scrollToCard(getCardIndex(card.id))` to make the virtualizer mount that row.
  - Poll for `gridCellRefs.current.get(card.id)` to appear (every 50ms, up to ~2s) instead of assuming it already exists.
  - Once it appears, do an additional `scrollIntoView`-style nudge to center it precisely, then poll for scroll stability as today, then fly.
- If after the timeout the cell still doesn't mount (extreme edge case — filter changed mid-deal), fall back to the current "skip silently" behavior so the animation never deadlocks.

**2. `src/pages/Index.tsx`**
- Remove the existing one-shot `useEffect` at lines 224-240 that pre-scrolls to `maxIdx`. Per-card scrolling replaces it.
- Pass two new props to `<CardDealAnimation>`:
  - `getCardIndex={(id) => { const i = filtered.findIndex(a => a.id === id); return i >= 0 ? i : null; }}` — note: must use `filtered` (what the VirtualGrid actually shows), not `assets`, because `classicGridRef.scrollToCardIndex` operates on the rendered list.
  - `scrollToCard={(idx) => classicGridRef.current?.scrollToCardIndex(idx, 'center')}`
- Keep the in-flight placeholder (line 1162) and dealtIds glow logic exactly as-is — they still work, they just need the row to be mounted, which the new scroll handles.

**3. No changes to `VirtualGrid.tsx`**
- Its existing `scrollToCardIndex` imperative handle is exactly what we need.

### Edge cases handled

- **Card not in current filter**: `getCardIndex` returns `null` → animation skips that card cleanly (same as today).
- **Fast dealing of many cards across distant rows**: each card triggers its own scroll + mount-poll, so each lands correctly even if 100 rows apart.
- **First card**: keep existing "scroll to top" intro for the first card so the stack visual sits at the top of viewport, then start per-card scrolling on subsequent cards.
- **Skip Animation button**: unchanged — still marks all remaining as dealt and completes.

### Expected result

- Deal animation works again with virtualized infinite scroll.
- Cards visibly fly from the stack to their correct grid cell, scrolling the page as needed between cards.
- No silent skips for cards outside the initial viewport.
