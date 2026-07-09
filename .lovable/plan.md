Plan:

1. Use AtomicHub’s live SimpleAssets mint endpoint as the source of truth for the primary mint number:
   - `https://nft-data.api.atomichub.io/v1/simpleassets/mints?asset_ids=<sassets_id,...>`
   - Verified: `100000004438388` → `mint: 119`, `total: 240` (matches AtomicHub for AA asset `1099519849001`).

2. Rewrite `src/lib/saMintResolver.ts`:
   - Take a list of `sassets_id` values, batch them (e.g. 100 per request), and return a map keyed by AA `asset_id` → `{ saMint, saTotal }`.
   - 30‑minute memory + sessionStorage cache. Deduplicated in-flight requests.
   - On failure, resolve to an empty map so cards keep their bridge mint.

3. Update `src/hooks/useGpkAtomicAssets.ts`:
   - Keep AA `template_mint` / `issued_supply` as the initial `idata.mint` / `idata.maxsupply` so cards render immediately with the bridge mint.
   - Also store the bridge mint permanently in new fields: `idata.bridge_mint` and `idata.bridge_total` (from `template_mint` / `issued_supply`).
   - After the AtomicHub batch resolves, for each bridged asset overwrite `idata.mint` and `idata.maxsupply` with the SA `mint` / `total`.
   - Native AA assets (no `sassets_id`) stay unchanged and get no bridge fields.

4. Update the card and detail views to show both numbers when the bridge fields are present:
   - `src/components/simpleassets/SimpleAssetCard.tsx`: keep the existing mint badge (now the true SA mint), and add a second small badge next to it labeled `Bridge Mint #<n>` when `idata.bridge_mint` exists.
   - `src/components/simpleassets/SimpleAssetDetailDialog.tsx`: under the existing “Mint #X / Y” row, add a second row `Bridge Mint #X / Y` when `idata.bridge_mint` exists.
   - Styling: reuse existing badge tokens; bridge label uses muted/secondary styling so the true SA mint remains the primary number.

5. Verify:
   - Asset `1099519849001` shows `Mint #119 / 240` and `Bridge Mint #45 / 134`.
   - A native AA-only card (no `sassets_id`) shows a single mint with no bridge label.
   - If the AtomicHub endpoint fails, cards render only the bridge mint with its label so nothing looks broken.

Technical notes:
- Endpoint returns `{ success, data: [{ asset_id, mint, total, burned }] }` keyed by SA asset_id, not by AA asset_id — the resolver joins back via each AA asset’s `immutable_data.sassets_id`.
- Batch size capped at 100 IDs per request to stay within URL length limits; concurrency capped at 3.
- No changes to sort order, filtering, or completion counts.