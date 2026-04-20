
## Why the banner isn't showing

`useBannerAds` calls `fetchTableRows({ code: 'cheesebannad', table: 'bannerads', limit: 100 })` with no `reverse` flag. By default, the WAX RPC returns rows in **ascending primary-key order starting from the lowest**. Since the contract has been writing two rows per day (positions 1 and 2) for many months, the table now contains far more than 100 rows. The fetch returns the oldest 100 — the most recent timestamp in the response is **2026-03-24**, ~27 days before today (2026-04-20). Every row is outside the active 24-hour window, so the active filter drops them all and `<PlaceholderSlot>` renders instead.

Verified from the live network response: 100 rows returned, max `time = 1774360800` (Mar 24, 2026), current time = Apr 20, 2026.

## Fix

Update `src/hooks/useBannerAds.ts` so `fetchBannerAds` requests rows in reverse order:

```ts
const result = await fetchTableRows<BannerAdRow>({
  code: CONTRACT_ACCOUNT,
  scope: CONTRACT_ACCOUNT,
  table: 'bannerads',
  limit: 100,
  reverse: true,
});
```

Notes:
- Existing logic re-sorts ascending for content inheritance, so reverse fetch doesn't break inheritance.
- 100 newest rows = ~50 days of slots, plenty for the 24h active window plus inheritance lookback.
- Single-line change; no other files need editing.

### Files
- **EDIT** `src/hooks/useBannerAds.ts` — add `reverse: true` to the `fetchTableRows` call.

### Validation
After the change, the placeholder should be replaced by the active rented banner (currently `cheesepromoz` if a recent row falls in the 24h window) and the network response will contain rows from the past day.
