
Diagnosed from your console/network data:

- The alert check is running.
- The request is `GET /atomicmarket/v1/sales?...template_whitelist=184,191...`
- But the response contains unrelated `blueeyesdesc` sales with template `671561`.

That means the current API query is not reliably filtering by the requested template IDs. So the previous fix did not address the real root cause: the batched `template_whitelist` strategy is returning wrong market data, so `cheapestByTemplate.get(yourTemplateId)` stays empty and no alert triggers.

## Fix plan

### 1. Replace the batched whitelist request with per-template checks
Edit `src/hooks/usePriceAlerts.ts`:

- Stop using one shared request with `template_whitelist=...`
- For each active alert, fetch the cheapest listing for that exact template instead:
  - `collection_name=gpk.topps`
  - `template_id=<alert template id>`
  - `state=1`
  - `symbol=WAX`
  - `sort=price`
  - `order=asc`
  - `limit=1`

Why: max alerts is only 5, so a few precise requests are safer than one unreliable bulk query.

### 2. Filter to the GPK collection explicitly
Even with exact template checks, keep `collection_name=gpk.topps` in the request so unrelated collections can never satisfy an alert.

### 3. Update trigger logic per alert
For each alert response:

- Read the first returned sale only
- Parse the WAX price
- Set `lowestPrice` and `lastChecked`
- Mark `triggered=true` when `lowest <= maxPrice`
- Fire the toast once per session as before

### 4. Make failures isolated
If one alert request fails, do not abort all alerts.
Only mark that alert as unchecked/unchanged and continue checking the others.

### 5. Keep the diagnostic logs, but make them specific
Log per-template checks like:

- template id requested
- final request URL
- collection returned
- lowest listing found
- comparison against max price

This will make it obvious if an endpoint ever returns wrong data again.

## Files to edit
- `src/hooks/usePriceAlerts.ts` — replace `template_whitelist` batching with exact per-template market checks
- `src/lib/waxConfig.ts` — only if needed, to switch sales path from `v1` to `v2` after verifying which endpoint behaves correctly with `template_id`

## Validation after implementation
Test with the exact scenario you described:

1. Set an alert above an already-listed card price
2. Click “Check Now”
3. Confirm:
   - toast appears immediately
   - bell switches to triggered state
   - dialog shows the lowest seen WAX price
   - console logs show the exact template id matched, not unrelated collections

## Technical note
Previous attempts focused on encoding/caching. Your latest logs prove the deeper issue is query correctness, not just caching:
`template_whitelist=184,191` returned `blueeyesdesc / 671561`, so the server response is not honoring the intended template filter. The safest fix is to stop relying on that bulk filter entirely.
