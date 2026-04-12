

## Fix: Banner Ads Not Showing (Wrong Expiry Logic)

### Problem
Our `useBannerAds.ts` applies a strict 24-hour window filter (`row.time + 86400 <= now`) that expires banner rows after 24 hours. CheeseHub does **not** do this — it simply picks the most recent row group whose `time` is in the past. This means our code filters out all active banners once they're >24h old, falling back to the "Advertise here" placeholder.

### Fix
Replace the `resolveActiveBanner` logic in `src/hooks/useBannerAds.ts` to match CheeseHub's approach:

1. Group rows by `time` value
2. Find the most recent group where `time <= now`
3. From that group, extract position 1 and position 2 banners (skip suspended, skip contract-owned)
4. Remove the `SECONDS_PER_DAY` constant and the 24h window check entirely

### File Changed
- `src/hooks/useBannerAds.ts` — rewrite `resolveActiveBanner` and `fetchBannerAds` to use "most recent past group" logic instead of 24h rolling window

