

## Center Rented Banner When Only One Slot is Active

### Problem
Currently, both banner slots (position 1 and 2) are always rendered side-by-side. When only one slot is rented, the unrented slot shows a dashed placeholder outline. CheeseHub instead centers the single rented banner and hides the empty slot entirely.

### Fix
In `src/components/BannerAd.tsx`, update `BannerAdComponent`:

1. Determine which positions have active banners (from `positionBanners` map)
2. Only render slots that have banners — skip empty positions entirely (no `PlaceholderSlot`)
3. The existing `flex justify-center gap-4` container will automatically center a single banner

### Changes
**`src/components/BannerAd.tsx`** — In `BannerAdComponent`, replace the hardcoded `renderSlot(1)` + `renderSlot(2)` with a dynamic loop that only renders occupied positions. Remove the `PlaceholderSlot` fallback from `renderSlot`. If no positions are occupied, show nothing (or a single centered placeholder).

```
// Instead of always rendering both slots:
{renderSlot(1)}
{renderSlot(2)}

// Render only occupied slots:
const occupiedPositions = [1, 2].filter(p => positionBanners.has(p));
{occupiedPositions.length === 0
  ? <PlaceholderSlot ... />
  : occupiedPositions.map(p => renderSlot(p))}
```

### Files Changed
- `src/components/BannerAd.tsx` — render only occupied banner slots, center when single

