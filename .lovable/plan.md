Root cause:

- The new resolver calls `https://nft-data.api.atomichub.io/v1/simpleassets/mints?...` directly from the browser.
- AtomicHub only returns `Access-Control-Allow-Origin` for whitelisted origins (their own hosts and `http://localhost:8080`). For the Lovable preview / published domain the response has no ACAO header, so the browser blocks it with "Failed to fetch".
- The resolver's catch swallows this, cards keep their initial bridge mint, and the two numbers look identical.

Fix — add a tiny backend proxy on Lovable Cloud and route the resolver through it.

1. Enable Lovable Cloud (no external account needed) so we can deploy a Supabase Edge Function.

2. Create edge function `supabase/functions/sa-mints/index.ts`:
   - Accepts `POST { asset_ids: string[] }` (JSON body — avoids URL length limits).
   - Validates each id is digits only, hard caps at 500 ids per call.
   - Server-side `fetch` to `https://nft-data.api.atomichub.io/v1/simpleassets/mints?asset_ids=<...>` (batches of 100 internally with `Promise.all`, concurrency 3).
   - Returns `{ success, data: [{ asset_id, mint, total, burned }] }` verbatim, with permissive CORS headers so the browser can read it.
   - 30s timeout, standard error envelope on failure.
   - Configured `verify_jwt = false` in `supabase/config.toml` (public data, no auth needed).

3. Update `src/lib/saMintResolver.ts`:
   - Replace the direct `fetch(ENDPOINT + ?asset_ids=...)` call with `supabase.functions.invoke('sa-mints', { body: { asset_ids: batch } })`.
   - Read the Supabase client from the standard Lovable Cloud generated client at `src/integrations/supabase/client.ts`.
   - On `FunctionsHttpError`, read `error.context.text()` and log real reason; return empty batch so cards keep bridge mint (graceful degradation stays intact).
   - Keep the 30-min memory + sessionStorage cache, batch dedup, and concurrency limits.

4. Do NOT change the UI. `SimpleAssetCard` and `SimpleAssetDetailDialog` already render both mint values correctly; once the resolver actually succeeds the primary mint will update to the true SA number and the bridge badge stays underneath.

5. Verify:
   - Reload the collection with asset `1099519849001` in view. The primary mint reads `#119 / 240`, the secondary badge reads `Bridge Mint #45 / 134`.
   - Network panel shows `POST /functions/v1/sa-mints` returning 200 with the mint rows.
   - A card whose sassets_id has no SA mint record still shows the bridge mint only.
   - If the edge function itself is unreachable, cards fall back to bridge mint (no crash).

Technical notes:

- Why not fetch directly: AtomicHub's CORS whitelist is out of our control; a server-side proxy is the only correct browser-safe path.
- Why POST + JSON body: sassets_ids for a full collection can exceed URL length limits when concatenated; JSON body avoids that and simplifies validation.
- Why Lovable Cloud: no external Supabase account required; the edge function ships with the project and CORS is trivial to set.