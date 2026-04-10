

## Fix Banner Ads: Data Format + Size + Position

### Problem
The banner ads show empty because of three data format mismatches between our code and the actual contract data, plus wrong sizing and placement.

### Root causes
1. **`time` is a unix timestamp** (integer like `1775656800`), not an ISO string — our comparison logic fails
2. **Positions are 1 and 2**, not 0 and 1 — we never find any matching rows
3. **`rental_type` is a number** (0=exclusive, 1=shared), not a string — shared detection fails
4. **Size is wrong** — should be 580x150, currently 468x60
5. **Advertise link** should point to `https://cheesehubwax.github.io/cheesehub/bannerads`
6. **Placement** — should be above the title, below the header (currently below the title)
7. **Need to fetch all rows** — there are 126 rows, current limit of 100 misses some

### Changes

**`src/hooks/useBannerAds.ts`**
- Change `BannerAdRow.time` from `string` to `number`
- Change `BannerAdRow.rental_type` from `string` to `number`
- Update `getCurrentDayStart()` to return a unix timestamp
- Fix `resolveActiveBanner` to use numeric comparisons for time and positions 1/2
- Fix shared detection: `rental_type === 1` instead of `=== 'shared'`
- Increase fetch limit to 200

**`src/components/BannerAd.tsx`**
- Change banner dimensions to `max-w-[580px] h-[150px]`
- Update placeholder link to `https://cheesehubwax.github.io/cheesehub/bannerads`
- Update placeholder size to match

**`src/pages/Index.tsx`**
- Move `<BannerAd />` above the title `<div>` (before the `text-center mb-8` block)

