## Fix: show original SimpleAssets mint number for bridged AtomicAssets GPK cards

### Problem
For bridged GPK cards, we currently display `template_mint / issued_supply` from the AtomicAssets API (e.g. `#45 / 134` for asset `1099519849001`). That's the **bridge order**, not the card's real mint number.

AtomicHub has just switched to showing the **original SimpleAssets mint** (e.g. `#119 / 240` for the same asset). Every bridged AA asset carries the original SA id in `immutable_data.sassets_id` (schema field). The lower the `sassets_id`, the earlier the card was minted in SA. `#119 / 240` = position of this asset when all cards of the same template are ordered by `sassets_id` ascending, over the total number of SA mints that ever existed for that template (including any not yet bridged).

### Approach

1. **Numerator (mint position):** For each template that has a `sassets_id` field, fetch every bridged asset for that template, sort by `sassets_id` ascending, and record each asset's 1-based position. The current asset's position is its original SA mint number.
2. **Denominator (total supply):** Read the original SimpleAssets stat row for the matching `author + category + name` (schema/cardid/quality/variant combo) from the `simpleassets` contract, `stats` table, to get the true "ever-minted" count. Fall back to bridged count if the SA stat row is unavailable.

Numerator alone is enough to display the correct `#N` even if the SA stat lookup fails. Denominator is best-effort; if the SA total can't be resolved we keep bridged `issued_supply` as the total so the label always renders.

### Implementation plan

**A. New utility `src/lib/saMintResolver.ts`**
- `resolveSaMintForTemplate(templateId)` → returns `Map<asset_id, { mint: number; bridgedTotal: number }>`.
- Paginates `/atomicassets/v1/assets?collection_name=gpk.topps&template_id=<id>&limit=1000` sorted by `asset_id` asc, collects `{ asset_id, sassets_id }`, sorts by `sassets_id` asc, assigns position.
- Skips templates whose schema has no `sassets_id` field (unbridged / native AA templates such as `packs`).
- Memoizes per-template result in memory + `sessionStorage` (30 min TTL) mirroring `templateDataCache` so re-renders don't refetch.
- `getSaTotalForTemplate(templateId, templateImmutable)` → calls `simpleassets` `stats` scope `gpk.topps` for the matching schema/quality/variant/cardid tuple, cached the same way. Returns `null` if not found.

**B. Wire it into `src/hooks/useGpkAtomicAssets.ts`**
- After parsing assets, group by `template_id`.
- For each template that has a `sassets_id` field in the schema, resolve the SA mint map + SA total, in parallel across templates (with a small concurrency limit, e.g. 5).
- Overwrite the parsed asset's `idata.mint` with the SA mint number and `idata.maxsupply` with the SA total (falling back to `template.issued_supply` when SA total is unknown).
- Preserve the existing sort order.

**C. No changes needed to `SimpleAssetCard.tsx` / `SimpleAssetDetailDialog.tsx`**
- They already read `idata.mint` / `idata.maxsupply`, so once the hook rewrites those fields the badge (`#119 / 240`) will render automatically.

**D. Graceful degradation**
- If the mint resolver fails for a template, that template's cards keep their existing `template_mint / issued_supply` display (no regression, no error toast).
- Never block first render on the resolver: assets render with the old mint immediately, then update once the SA-mint map resolves (state update in the hook).

### Verification
- Reload the collection page, confirm the badge on asset `1099519849001` reads `#119 / 240` (matches AtomicHub).
- Spot-check 2–3 other cards across different templates/schemas.
- Confirm native AA-only cards (schema `packs`, no `sassets_id`) still show `#template_mint / issued_supply`.
- Confirm the network tab shows one paginated fetch per unique template (not per asset), served from cache on subsequent renders.
