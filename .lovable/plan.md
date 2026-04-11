

## Fix Banner Ad Display

### Issues
1. **Both positions always rendered** -- The code loops over positions `[1, 2]` and renders a banner for each one found. If only one position is rented on CheeseHub, the other position still resolves to an old/stale row and shows up.
2. **Size not enforced** -- The banner uses `max-w-[580px] w-full h-[150px]` but when there's 1 banner vs 2, the layout should still maintain the exact 580x150 size per slot.

### Changes

**File: `src/components/BannerAd.tsx`**
- Fix the banner slot sizing to use explicit `w-[580px] h-[150px]` instead of `max-w-[580px] w-full` so each slot is always exactly 580x150 regardless of how many banners exist.
- When only 1 banner exists, render just that one centered. When 2 exist, render both side by side.

**File: `src/hooks/useBannerAds.ts`**  
- The resolution logic correctly returns `null` for positions with no valid ad. No change needed here -- the issue is purely in the rendering component showing a placeholder for empty positions or resolving stale rows incorrectly.
- However, need to verify: if position 2 has no active rental but old rows exist in the table, `resolveActiveBanner` will still find them and return a banner. Fix: only return a banner if its resolved row's time falls within a reasonable active window (i.e., the row is for today or the most recent past booking that hasn't expired). Since each row represents a day rental (`time` = the day it's booked for), we should only return banners where `row.time >= start` (today's start), not just `< end`.

### Technical Detail

In `resolveActiveBanner`, add a check: only consider rows where `row.time >= start` (today or later). Currently it only filters `row.time < end` (not future), which means any historical row from months ago could match. Adding `row.time >= start` ensures only today's active rentals are shown.

```
const { start, end } = getDayBounds();
// ...
if (row.time >= end) continue;    // future
if (row.time < start) continue;   // expired (not today)
```

This single change ensures that if position 2 isn't rented today, no banner appears for it.

