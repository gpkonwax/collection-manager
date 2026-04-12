

## Fix Card Deal Animation: Accuracy and Performance

### Problems Identified

**1. Cards flying off-screen:** The `flyTarget` coordinates are measured after an 800ms `SCROLL_SETTLE` delay, but `smooth` scrolling may not have finished by then. If the scroll is still in progress, `getBoundingClientRect()` returns incorrect viewport-relative coordinates, causing the card to fly to a wrong position and then snap back.

**2. Stuttery scrolling during dealing:** During the deal animation, `visibleCount` is set to `Infinity`, which renders the **entire collection** at once (potentially hundreds of cards with IPFS images). Each `SimpleAssetCard` includes `IpfsMedia` with `IntersectionObserver` and `useIpfsMedia` hook — as the viewport scrolls past each card, observers fire, images start loading/gateway-rotating, causing layout thrash and jank. No API calls are being made during scroll (the data hooks only fetch on mount/account change), but mass image loading and DOM reflows from rendering hundreds of cards is the bottleneck.

### Plan

**File: `src/components/simpleassets/CardDealAnimation.tsx`**

1. **Replace fixed SCROLL_SETTLE timeout with scroll-end detection.** After calling `window.scrollTo()`, poll `scrollY` every 50ms until it stabilizes (same value for 2 consecutive checks) or a max timeout (2s) elapses. Only then measure `getBoundingClientRect()` for the fly target. This ensures coordinates are always accurate regardless of scroll distance.

2. **Use `requestAnimationFrame` before measuring.** Wrap the final `getBoundingClientRect()` call in a `requestAnimationFrame` to ensure the browser has painted the latest layout before we read coordinates.

3. **Use CSS `will-change: transform` on the flying card** to promote it to its own compositor layer, reducing paint overhead during the transition.

4. **Reduce SIT_DURATION and LAND_PAUSE slightly** (optional, user can decide) — currently 2800ms sitting + 1400ms land pause per card means a 25-card pack takes ~3+ minutes.

**File: `src/pages/Index.tsx`**

5. **Limit rendered cards during deal animation.** Instead of setting `visibleCount` to `Infinity`, calculate the minimum needed: the last dealing card's position in the filtered list + a small buffer. This avoids rendering hundreds of off-screen cards that cause layout thrash and image loading storms during scrolling.

### Technical Details

```text
Current flow:
  scrollTo(target) → wait 800ms → measure rect → fly

Improved flow:
  scrollTo(target) → poll scrollY until stable (max 2s) → rAF → measure rect → fly
```

Scroll stability check:
```ts
let lastY = -1;
let stableCount = 0;
const poll = setInterval(() => {
  const y = window.scrollY;
  if (Math.abs(y - lastY) < 2) stableCount++;
  else stableCount = 0;
  lastY = y;
  if (stableCount >= 2 || elapsed > 2000) {
    clearInterval(poll);
    requestAnimationFrame(() => { /* measure and fly */ });
  }
  elapsed += 50;
}, 50);
```

For visible count during dealing:
```ts
// Instead of Infinity, find the max index of any dealing card in `filtered`
const maxDealIdx = Math.max(...dealingCards.map(c => {
  const idx = filtered.findIndex(f => f.id === c.id);
  return idx >= 0 ? idx : 0;
}));
setVisibleCount(maxDealIdx + 12); // buffer for surrounding cards
```

### Files Changed
- `src/components/simpleassets/CardDealAnimation.tsx` — scroll-end detection, rAF measurement, will-change
- `src/pages/Index.tsx` — smarter `visibleCount` during dealing

