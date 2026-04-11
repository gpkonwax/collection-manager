

## Fix Banner Ads Not Displaying

### Root Cause Analysis

Two bugs in `src/hooks/useBannerAds.ts`:

**Bug 1 -- Row limit truncates newest data.** The contract table grows by 2 rows/day. The fetch uses `limit: 200` and WAX returns rows in ascending order by default. With 200+ rows in the table, the newest rows (including today's) get cut off -- we never see them.

**Bug 2 -- IPFS hash fallback is too restrictive.** When the most recent row for a position has an empty `ipfs_hash` (common for `cheesebannad` placeholder rows), the fallback only looks for earlier rows from the *same user*. Since `cheesebannad` never has a hash, it returns null. The correct behavior is to fall back to any earlier row for that position that has a valid hash, regardless of user.

### Changes

**File: `src/hooks/useBannerAds.ts`**

1. **Fetch newest rows first** -- Add `reverse: true` to the `fetchTableRows` call so we get the most recent rows first, and reduce limit since we only need recent data (last ~30 days at most).

2. **Update `fetchTableRows` params** -- Need to check if `waxRpcFallback.ts` supports the `reverse` parameter. If not, add it to the `TableRowsParams` interface.

3. **Fix `resolveActiveBanner` fallback logic** -- When the current row has no `ipfs_hash`, search ALL earlier rows for that position (not just same-user) to find the most recent valid hash. When no row for today/before today has a hash directly, walk backwards through sorted position rows until finding one with a valid `ipfs_hash`.

4. **Simplify the resolution** -- Instead of finding one "current row" then trying to patch its missing hash, iterate through position rows (newest first) and return the first one that has (or can resolve) a valid `ipfs_hash`.

**File: `src/lib/waxRpcFallback.ts`**

5. Add `reverse?: boolean` to the `TableRowsParams` interface so `fetchTableRows` can pass it to the RPC call.

### Technical Details

The updated `resolveActiveBanner` will:
- Filter rows for the position, sorted newest-first
- Skip rows in the future (time >= end of today)
- For each row from today or earlier: check if it has an `ipfs_hash`, or look for any earlier row for the same user with a hash
- If found, build and return the banner
- If the row is a placeholder (`cheesebannad` with no hash), skip it and continue to the next older row
- This ensures we always show the most recent valid ad

The `fetchBannerAds` call will use `reverse: true` and a limit of 60 (covers ~30 days), ensuring we always get the freshest rows without being cut off by table size.

