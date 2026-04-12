

## Fix Shared Banner Slots to Match CheeseHub

### Problem
Two issues prevent shared banners from displaying correctly:

1. **Missing placeholder emission**: When a shared slot has only one renter (no second renter), CheeseHub emits a `__placeholder__` banner with a static image. Our `useBannerAds.ts` does not emit this placeholder, so half-rented shared slots only show one banner with no rotation.

2. **No placeholder image handling in UI**: Our `BannerAd.tsx` has no concept of `__placeholder__` banners. When a banner has `user === "__placeholder__"` and an empty `ipfsHash`, it tries to load from IPFS and fails silently.

### What Changes

**1. `src/hooks/useBannerAds.ts` — Add placeholder emission for half-rented shared slots**

After emitting the primary banner for a shared rental, if there is no second renter (`!shared_user` or `shared_user === contract`), emit a placeholder banner:
```
{ user: "__placeholder__", ipfsHash: "", websiteUrl: "bannerads-link", displayMode: "shared" }
```
This matches CheeseHub's exact logic at lines 121-129 of their hook.

**2. `src/components/BannerAd.tsx` — Handle `__placeholder__` banners with static image**

- Save the user-uploaded `cheese_banner4.png` to `public/cheese-banner-placeholder.png`
- In `SingleBanner` and `SharedBannerRotator`, detect `banner.user === "__placeholder__"` and render the static placeholder image instead of trying IPFS
- Placeholder banners link to the banner ads page (`https://cheesehubwax.github.io/cheesehub/bannerads`)
- Show "Ad (Shared)" badge on placeholder banners

**3. Save placeholder banner image**

- Copy `cheese_banner4.png` to `public/cheese-banner-placeholder.png` for use as the static fallback image in shared slots

### Files Changed
- `public/cheese-banner-placeholder.png` — new static placeholder image
- `src/hooks/useBannerAds.ts` — add placeholder banner emission for half-rented shared slots
- `src/components/BannerAd.tsx` — handle `__placeholder__` user with static image, matching CheeseHub's `BannerImage` component

