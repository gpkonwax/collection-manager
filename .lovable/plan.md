## Investigation: SimpleAssets Mint Numbers

### Findings

**1. SimpleAssets standard does NOT store a "mint number / supply" per NFT row.**

The `simpleassets::sassets` table (which we already query for each owner) only contains:
- `id` — the asset's unique global ID (auto-incremented across all NFTs ever minted by the contract, not per-template)
- `owner`, `author`, `category`
- `idata` (immutable data, set by author at mint) — JSON string
- `mdata` (mutable data, can be updated by author) — JSON string
- `container`, `containerf`

There is no `mint`, `edition`, `serial`, or `template_id` column at the protocol level. Whether a mint number exists at all is entirely up to the author (gpk.topps) to write into `idata` / `mdata`.

**2. What gpk.topps actually stores.**

Our parser (`useSimpleAssets.ts`) already extracts everything from `idata`/`mdata`. The fields we currently know exist in the GPK SA payload are: `name`, `cardid`, `variant`, `quality`, `img`, `backimg`, etc. No `mint` / `edition` / `serial` / `maxsupply` field has been observed in the GPK Topps SA cards — that's why the green mint badge never renders for SA cards (the `getMintInfo` helper returns `null`).

The AtomicAssets versions of GPK cards DO have mint numbers because AA tracks `template_mint` natively in the asset row. SA does not.

**3. Other SimpleAssets contract tables — could a mint number live elsewhere?**

The `simpleassets` contract exposes these other tables, none of which give a per-asset mint number for already-issued NFTs:
- `tokenconfigs` — global contract config, version info
- `stat` — per-author/category statistics: `supply`, `max_supply`, `issued_supply`, `burned_supply`. This is **aggregate** (e.g. "12000 of category gpk1 issued") — not per-asset.
- `offers`, `delegates`, `accounts` (FT only)

So the closest thing to a "supply" we can derive from the contract for SA cards is the category-level `issued_supply` from `stat`, scoped `gpk.topps` / category `<series>`. But that is the total issued count of that category — not the mint position of an individual card.

**4. Could we synthesise a "mint #" from the asset ID?**

Theoretically yes — for a given `cardid` + `side` + `variant`, we could rank our owned assets by ascending `id` and call the lowest "mint #1 owned". But:
- This is **not** the true mint position. The real mint order requires querying the full historical issuance for that template across all owners (currently impossible from `sassets` since it is scoped per-owner).
- It would be misleading vs. AA's authoritative `template_mint`.

### Conclusion

For gpk.topps SimpleAssets cards, there is no reliable mint number to display. The protocol doesn't track it, the author didn't put it in metadata, and the only derivable proxy (asset `id` ordering) is misleading. This is a known limitation of the SimpleAssets standard vs. AtomicAssets — and the reason Topps eventually migrated to AA where mint numbers are first-class.

### Recommended next step (optional)

I can add a small visual cue so users understand the difference instead of seeing a missing badge:

- In `SimpleAssetCard.tsx` and `SimpleAssetDetailDialog.tsx`, when `source === 'simpleassets'` and no mint metadata is found, show a subtle `Asset ID #<id>` chip in place of the mint chip with a tooltip: *"SimpleAssets does not record per-card mint numbers. Shown is the on-chain asset ID."*
- We already render `#<asset.id>` in the bottom-right of the card; we'd just add the tooltip to it for SA cards so users know that's the closest analog.

No contract-level fetch can recover real mint numbers for these cards — this is purely a UX clarification.

Approve this plan to apply the tooltip/labeling change, or let me know if you'd rather leave the UI as-is now that the mystery is explained.