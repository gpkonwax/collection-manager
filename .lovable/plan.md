

## Fix: First Card Lands Off-Target When Scrolled Down

### Root Cause
When the demo button is pressed while scrolled down the page, the animation starts by smooth-scrolling to top (line 77). It then waits a fixed 1500ms before proceeding. If the page was scrolled far enough down, the smooth scroll hasn't finished in 1500ms, so the grid cell coordinates measured for the first card's flight target are wrong — they're based on a mid-scroll viewport position.

### Fix
In `src/components/simpleassets/CardDealAnimation.tsx`, replace the fixed 1500ms timeout for the first card's scroll-to-top with a poll that waits until `window.scrollY` is actually 0 (or near 0) before advancing to the `'sitting'` phase. This ensures the scroll has fully settled regardless of how far down the user was.

```typescript
// Replace fixed timeout with scroll-settle check
if (isFirstCardRef.current) {
  isFirstCardRef.current = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Poll until scroll reaches top
  let elapsed = 0;
  const interval = setInterval(() => {
    elapsed += 50;
    if (window.scrollY <= 1 || elapsed > 3000) {
      clearInterval(interval);
      setPhase('sitting');
    }
  }, 50);
  return () => clearInterval(interval);
}
```

### File Changed
- `src/components/simpleassets/CardDealAnimation.tsx` — replace fixed 1500ms delay with scroll-position polling

