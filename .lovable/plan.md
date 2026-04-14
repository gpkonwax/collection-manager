

## Add 3-Second Fade Transition to Shared Banner Rotator

### Problem
Currently the `SharedBannerRotator` swaps images instantly. The CheeseHub site has a smooth 3-second crossfade between shared ads.

### Approach
Use a crossfade technique: render both the outgoing and incoming banners stacked via `absolute` positioning, and animate opacity over 3 seconds.

### Changes

**`src/components/BannerAd.tsx`** — Rework `SharedBannerRotator`:
- Add a `fading` state and a `previousIndex` state
- When `currentIndex` changes, set `fading = true` and track the previous index
- Render both the previous and current banner images stacked with `absolute inset-0`
- The outgoing image fades from `opacity-100` to `opacity-0` over 3s; the incoming fades from `opacity-0` to `opacity-100` over 3s
- After the 3s transition completes, set `fading = false` and stop rendering the old image
- Use `transition-opacity duration-[3000ms]` Tailwind classes for the fade

### What stays
- 30-second rotation interval unchanged
- Gateway fallback logic unchanged
- Badge, external link icon, click handling unchanged

