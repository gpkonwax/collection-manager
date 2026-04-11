

## Fix Banner Ads: Match Contract Logic

### Root Cause

The current `resolveActiveBanner` logic has two problems:

1. **Missing "is rented" check** -- In the contract, when `row.user === 'cheesebannad'` (the contract account itself), the slot is **unrented/available**. The current code never checks this, so it tries to render unrented placeholder slots.

2. **Wrong time window** -- The code uses UTC midnight day bounds (`row.time >= start && row.time < end`), but the contract defines an active slot as `row.time <= now && row.time + 86400 > now`. If the contract's `start_time` values don't align perfectly with UTC midnight, the filtering misses today's active slot or picks up old ones.

### Fix (2 files)

**`src/hooks/useBannerAds.ts`** -- Rewrite `resolveActiveBanner`:
- Remove `getDayBounds()` entirely
- Use the contract's actual active-window check: `row.time <= nowSeconds && row.time + 86400 > nowSeconds`
- Skip rows where `row.user === 'cheesebannad'` (unrented slots)
- Skip suspended rows
- For the first matching active+rented row per position, resolve ipfs_hash (own or fallback from earlier same-user row)
- Return only genuinely rented, currently-active banners

**`src/components/BannerAd.tsx`** -- No changes needed (already renders only returned banners with correct 580x150 sizing).

### Updated Resolution Logic

```typescript
const CONTRACT_ACCOUNT = 'cheesebannad';
const SECONDS_PER_DAY = 86400;

function resolveActiveBanner(rows: BannerAdRow[], position: number): ActiveBanner | null {
  const now = Math.floor(Date.now() / 1000);

  const positionRows = rows
    .filter(r => r.position === position)
    .sort((a, b) => b.time - a.time); // newest first

  for (const row of positionRows) {
    // Skip if not currently active
    if (row.time > now || row.time + SECONDS_PER_DAY <= now) continue;
    // Skip unrented slots (owned by contract)
    if (row.user === CONTRACT_ACCOUNT) continue;
    // Skip suspended
    if (row.suspended === 1) continue;

    // Resolve ipfs_hash
    let ipfsHash = row.ipfs_hash;
    if (!ipfsHash) {
      const fallback = positionRows.find(
        r => r.time < row.time && r.ipfs_hash && r.user === row.user
      );
      if (fallback) ipfsHash = fallback.ipfs_hash;
      else continue;
    }

    // Build banner (including shared slot handling)
    ...
    return banner;
  }
  return null;
}
```

This ensures only currently-active, genuinely-rented ads are displayed -- matching exactly how the CheeseHub site resolves them.

