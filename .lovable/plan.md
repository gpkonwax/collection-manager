

## Rewrite Banner Ads to Match CheeseHub Implementation

### Problem
Our `useBannerAds.ts` uses a custom "group by time, pick most recent group" algorithm that does not match CheeseHub's actual logic. CheeseHub uses a 24-hour window filter (`time <= now < time + 86400`) with **pre-processed content inheritance** across all rows before filtering. Our code also handles shared banners differently -- embedding shared data in one object instead of emitting separate banner entries for rotation.

### What Changes

**1. Rewrite `src/hooks/useBannerAds.ts` to match CheeseHub exactly**

The CheeseHub algorithm:
- Fetch `limit: 100` rows in natural order (no `reverse: true`)
- Sort all rows by time ascending
- **Content inheritance**: for any row where `user != contract` but `ipfs_hash` is empty, copy content fields from the most recent earlier row with same user + position
- Filter to rows in the current 24h window: `nowSec >= row.time && nowSec < row.time + 86400`
- Skip rows owned by the contract account or with empty `ipfs_hash` or suspended
- For shared rentals (`rental_type === 1`):
  - Emit primary banner + secondary banner (shared user's content) if second renter exists with content
  - Emit primary + placeholder if no second renter
- For exclusive rentals: emit single banner
- Add `displayMode` ("full" | "shared") and `rentalType` fields to `ActiveBanner`

**2. Rewrite `src/components/BannerAd.tsx` to match CheeseHub's display logic**

- Separate banners by `displayMode`: "full" vs "shared"
- Group shared banners by position and use a `SharedBannerRotator` that alternates between primary/secondary every 30 seconds
- Handle placeholder banners (user `__placeholder__`) with a static fallback image linking to the banner ads page
- Keep the external link warning dialog integration
- Maintain 580x150px dimensions and the "Advertise with CheeseHub" link

### Technical Details

Key interface change for `ActiveBanner`:
```text
ActiveBanner {
  time, position, user, ipfsHash, websiteUrl,
  rentalType: "exclusive" | "shared",
  displayMode: "full" | "shared",
  sharedUser?, sharedIpfsHash?, sharedWebsiteUrl?
}
```

Content inheritance pseudocode (runs before filtering):
```text
sortedByTime = rows.sort(ascending by time)
for each row in sortedByTime:
  if row.user != contract AND row.ipfs_hash is empty:
    find most recent earlier row with same position+user that has content
    copy ipfs_hash, website_url, rental_type, shared fields from donor
```

### Files Changed
- `src/hooks/useBannerAds.ts` -- full rewrite to match CheeseHub's fetch + inherit + 24h-window + shared-emit logic
- `src/components/BannerAd.tsx` -- rewrite display to handle displayMode, SharedBannerRotator, and placeholder banners

