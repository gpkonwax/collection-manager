

## Fix: Card deal animation landing off-screen and disjointed movement

### Root causes

1. **Stale coordinates**: `getBoundingClientRect()` captures viewport-relative positions BEFORE the page scrolls to the destination. By the time the card flies (600ms later), the scroll has moved and the fixed-position target is wrong — the card lands off-screen.

2. **Scrolls back to top every card**: The `idle` phase calls `window.scrollTo({ top: 0 })` before EVERY card (line 67), not just the first. This creates the disjointed, jumpy feeling — the page ping-pongs between top and bottom.

3. **Only 300ms between cards**: After the first card, there's only a 300ms gap before the next sitting phase starts, giving no breathing room.

### Fix (single file: `CardDealAnimation.tsx`)

1. **Re-measure target AFTER scroll settles**: Instead of capturing `getBoundingClientRect` during sitting and then scrolling, scroll first, wait for it to settle (~800ms), THEN capture the rect and set flyTarget. This ensures the fixed-position coordinates match what's actually on screen.

2. **Only scroll to top for the first card**: Remove the `scrollTo top` from the idle phase for subsequent cards. After card 1 lands, the next card's sitting phase should show the stack where it is (or scroll up just enough to see the stack), not jump all the way to the top.

3. **Smooth scroll sequence per card**:
   - Scroll to show the stack area (not necessarily top 0)
   - Sit for 4s showing the card
   - Scroll to destination, wait for scroll to finish
   - Measure target rect fresh
   - Fly card (4s)
   - Landed pause (2s)

4. **Add a semi-transparent backdrop** so the card is always visible against the page content during flight.

### Technical detail

The key change is splitting the sitting-to-flying transition:

```
sitting → (timer 4s) → 'scrolling' phase
scrolling → scroll to target, wait 800ms → measure rect → set flyTarget → 'flying'
flying → (timer 4.2s) → 'landed'  
landed → (timer 2s) → mark dealt, next card → 'sitting' (skip idle for subsequent cards)
```

This eliminates the scroll-to-top bounce and ensures coordinates are always fresh.

