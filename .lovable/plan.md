# Fix mint numbers stuck on "resolving"

## Why it happens (confirmed)
AtomicHub's mint service only lets pages on atomichub.io read its answers. It checks which website sent the request and allows only `atomichub.io` / `wax.atomichub.io`. Your browser blocks the reply everywhere else, so every lookup fails ("Failed to fetch" in the preview logs) and the ribbons sit on `#--` forever. My earlier test ran from a server, which isn't subject to that check, so it looked fine.

## Fix
Add a small relay in Lovable Cloud that asks AtomicHub for the mint numbers and hands them back to the site. It works for both the Lovable site and the GitHub Pages site, with no accounts for you to set up.

1. Turn on Lovable Cloud for this project.
2. Create a `sa-mints` relay that:
   - accepts up to 100 SimpleAssets IDs (digits only, checked)
   - calls `https://nft-data.api.atomichub.io/v1/simpleassets/mints?asset_ids=...`
   - returns the same response shape, with cross-site headers
   - sets a 10-minute cache header so repeat views are instant
3. Point the mint lookup in the app at the relay first. Keep the direct AtomicHub call only as a last resort, which works if AtomicHub opens access later.
4. If a batch fails, stop showing "resolving…" forever. After the failure the ribbon goes back to `#--` with the tooltip "Mint number unavailable", and it retries on the next refresh.
5. Offline bundle: offline mode skips the lookup and shows `#--`, with no errors.

## Verification
- Call the relay directly with known IDs (e.g. `100000004478015` → mint 356 / 398).
- Use Playwright on the preview to view a wallet with Series 1 cards (SA and bridged AA). Check that the ribbons change from `#--` to real numbers and no failed mint requests show in the logs.
- Check that the trades dialog and the trade composer show the same numbers.

## Technical notes
- `supabase/functions/sa-mints/index.ts`: GET/POST, zod-validated `asset_ids`, `verify_jwt` off (public data), `corsHeaders` on all responses including errors.
- `src/lib/saMintResolver.ts`: `fetchBatch` tries `${VITE_SUPABASE_URL}/functions/v1/sa-mints` with the publishable key, then falls back to direct. Failed IDs go into a short negative cache (2 min) so callers settle.
- Callers already treat a missing map entry as `#--`, so no component changes are needed beyond the tooltip text.
