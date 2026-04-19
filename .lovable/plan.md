
The user set an alert at 10000 WAX for a template that has a listing at 6500 WAX, clicked "Check Now", but no alert triggered. Let me investigate the alert checking logic.

Key areas to check:
1. `runBatchedCheck` in `usePriceAlerts.ts` — the API request and parsing
2. `template_whitelist` parameter — is this the correct AtomicAssets API parameter?
3. Price parsing — is the WAX conversion correct?
4. ETag caching — could be returning stale 304 with no payload

Looking at the existing code:
- Endpoint: `${ATOMIC_API.paths.sales}?state=1&symbol=WAX&template_whitelist=...&sort=price&order=asc&limit=100`
- Parses `sale.assets[0].template.template_id` and `sale.price`

Suspected issues:
1. **`template_whitelist` is not a valid AtomicMarket API param.** The correct param is `template_id` (single) or you need to filter client-side. AtomicMarket `/sales` supports `template_id=N` for one template, but for multiple templates you'd need separate calls or use `collection_name` + filter.
2. **`sales` endpoint URL** — `ATOMIC_API.paths.sales` may point to AtomicAssets sales, but the live market is on AtomicMarket (`/atomicmarket/v2/sales`), not AtomicAssets (`/atomicassets/v1/...`).
3. **ETag cache bug** — if etag is returned but `payload` is set from `await resp.json()` BEFORE storing, that's fine. But if first call returns 304 with no cached payload, payload stays null → no sales parsed, but no error logged either.
4. **`asset.template.template_id` vs `template_id`** — sale objects on AtomicMarket use `sale.assets[0].template.template_id` as a string; need to confirm match against the whitelisted IDs.

Need to verify:
- `src/lib/waxConfig.ts` — what is `ATOMIC_API.paths.sales`?
- Confirm the endpoint actually supports `template_whitelist`
- Test the URL manually

Let me inspect the config to confirm.
<br>
[Investigation needed: read waxConfig.ts to see paths.sales]

Based on AtomicMarket docs, the correct multi-template filter is **`template_whitelist=id1,id2,id3`** — this IS supported on `/atomicmarket/v2/sales`. So if the path is correct, the param is fine.

However, there's a subtle bug:
- The endpoint requires `state=1` (listed) — correct
- But sales objects nest the template under `sale.assets[0].template.template_id`. Some responses also have `sale.template_id` at top level. The current code tries both.

**Most likely actual root causes (in order of likelihood):**

1. **ETag/304 silent failure**: First fetch returns 200 + etag + payload (cached). On manual "Check Now" recheck, server returns 304 with empty body. Code checks `if (resp.status === 304 && moduleEtagCache.payload)` — but if `moduleEtagCache.payload` was overwritten or never set on the first response (e.g., if etag header was missing), payload becomes null and no sales are parsed → no trigger. Even though `lastChecked` updates, nothing fires.

2. **`fetchWithFallback` may not preserve 304 status** — could be normalizing to 200 with empty body.

3. **CORS / etag header stripping** — many CDN proxies strip the `etag` header, so it's never cached, and every fresh response has full data. So this isn't actually the bug.

4. **Bell icon shows "triggered" via session toast dedupe**: `moduleSessionTriggered` set prevents toast duplicates within session. But the `triggered` flag is persistent in localStorage. If a previous test already triggered + cleared, it's possible the alert object's `triggered` is somehow true already... but UI would show BellRing.

Most likely: the AtomicMarket API call is returning data, but the template_id match is failing due to type mismatch (string vs number) or the endpoint not actually supporting `template_whitelist`.

I need to view `waxConfig.ts` and look at recent network logs to confirm the request shape. Let me ask what was observed.

Actually — given user already tested manually and saw no alert, the most actionable plan is:
1. Read `waxConfig.ts` to confirm sales endpoint
2. Add diagnostic logging to `runBatchedCheck` to trace: URL fetched, sales count returned, cheapestByTemplate map contents
3. Fix likely issues: ensure `template_whitelist` works, ensure type coercion of template IDs (compare as strings), bypass etag cache on manual checkNow

## Plan: Fix price alert not triggering

### Investigation steps (during implementation)
1. Read `src/lib/waxConfig.ts` to confirm `ATOMIC_API.paths.sales` points at AtomicMarket sales endpoint (`/atomicmarket/v2/sales`), not AtomicAssets.
2. Read `src/lib/fetchWithFallback.ts` to confirm 304 handling.

### Suspected root causes
1. **Wrong endpoint path**: `paths.sales` may point to `/atomicassets` not `/atomicmarket`. AtomicAssets has no `/sales` — only AtomicMarket does. If wrong, request returns empty/404 silently and `cheapestByTemplate` is empty.
2. **Template ID type mismatch**: Whitelisted IDs are strings (e.g. `"184"`), and `sale.assets[0].template.template_id` is also a string in API responses, but defensive coercion is missing. Map lookup could miss.
3. **Stale ETag cache returning empty payload**: Manual "Check Now" reuses cached etag → server returns 304 → if `moduleEtagCache.payload` was lost (e.g. page reload cleared module state but localStorage kept alerts), code falls through with `payload = null` and parses 0 sales.
4. **`template_whitelist` parsing**: Some atomic mirrors interpret the param differently. Need to URL-encode commas correctly (currently using `encodeURIComponent` which encodes commas — **this may be the bug**: AtomicMarket expects raw commas as separators, not `%2C`).

### Fix
**File: `src/hooks/usePriceAlerts.ts`**

1. **Don't URL-encode the comma-separated IDs**: change `encodeURIComponent(ids)` → just `ids` (template IDs are numeric and safe). AtomicMarket parses `template_whitelist=1,2,3` as a list, and `1%2C2%2C3` becomes a single literal token.
2. **Bypass ETag on manual checks**: pass a `force` flag from `checkNow` to `runBatchedCheck` that skips the `If-None-Match` header and resets `moduleEtagCache` after a fresh response.
3. **Coerce template IDs to strings on both sides** when building/looking up `cheapestByTemplate`.
4. **Add console diagnostic logging** (info level) showing: requested IDs, response sale count, parsed cheapestByTemplate entries, and per-alert decision. This makes future debugging trivial and can be left in (`console.info('[priceAlerts] ...')`).
5. **Verify `paths.sales`**: if `waxConfig.ts` does not have an AtomicMarket-specific path, add one or correct the existing one to `/atomicmarket/v2/sales`.

### Files affected
- **EDIT** `src/hooks/usePriceAlerts.ts` — fix encoding, bypass etag on manual check, add diagnostic logging, ensure string coercion of template IDs.
- **EDIT (if needed)** `src/lib/waxConfig.ts` — confirm/correct `ATOMIC_API.paths.sales` to point to `/atomicmarket/v2/sales`.

### Validation
After the fix, set an alert and click "Check Now" — console should log the API URL, the number of listings returned, and which alerts matched. The toast should fire and the bell should turn red (BellRing).
