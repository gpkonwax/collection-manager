

## Fix Banner Ad Transition to Match CheeseHub

### Problem
The crossfade feels abrupt/janky. CheeseHub uses a 500ms transition (not 3000ms) and handles click targets per-layer with `pointer-events-none` on inactive banners.

### Root cause
The current code has the right stacking approach but two issues:
1. The 3000ms duration is too long — it creates a slow, noticeable blend rather than a clean swap
2. The click handler is on the outer container using the current `activeBanner`, so clicks route incorrectly during transitions

### Changes

**`src/components/BannerAd.tsx`** — Rework `SharedBannerRotator`:

1. Change `duration-[3000ms]` to `duration-500` (matching CheeseHub's 500ms fade)
2. Add `pointer-events-auto z-10` to the active banner and `pointer-events-none z-0` to inactive banners
3. Move the click handler from the outer container div into each banner layer, so only the active (visible) banner is clickable
4. Remove `cursor-pointer` from the outer container since clicks are per-layer now
5. Keep the invisible spacer image for height maintenance

### What stays
- 30-second rotation interval
- Gateway fallback logic
- Badge and external link icon overlays
- `SingleBanner` component unchanged

