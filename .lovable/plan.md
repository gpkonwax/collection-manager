# Show real SimpleAssets mint numbers on bridged GPK cards

## The situation

The mint data is already being fetched successfully. I confirmed AtomicHub's endpoint returns live, correct values for all three bridged schemas:

| Schema | Example `sassets_id` | Real mint | Total |
|---|---|---|---|
| series1 | 100000004451204 | 153 | 218 |
| series2 | 100000004892973 | 42 | 146 |
| exotic | 100000004695981 | 874 | 1164 |

`useGpkAtomicAssets.ts` already calls this and writes the result into `idata.mint` / `idata.maxsupply`. The cards still show `#--` because of a wiring gap, not missing data.

## Why the ribbon shows `#--`

In `SimpleAssetCard.tsx` the ribbon value is built from:

```text
realMint      = asset.mintNumber        -> undefined (field never set on AA assets)
nativeAAMint  = idata.bridge_mint       -> only when NOT a bridged schema
effectiveMint = realMint ?? nativeAAMint -> undefined for bridged cards
```

So for `series1` / `series2` / `exotic` the ribbon always falls through to `#--`. The resolved value sitting in `idata.mint` is simply never read on that path.

There is a second, subtler problem blocking a naive fix. The hook **pre-fills** `idata.mint` with the bridge mint at line 105 so cards render instantly, then overwrites it with the real mint when the resolver returns. If the card just read `idata.mint`, it would show the *wrong* bridge number on first paint and silently flip to the correct one a moment later — worse than showing `#--`, because a wrong mint looks authoritative.

## What changes

### 1. Keep resolved mints in their own fields

In `src/hooks/useGpkAtomicAssets.ts`, stop overwriting the ambiguous `mint` / `maxsupply` keys. On resolver success, write to dedicated keys instead:

- `sa_mint` — the true original SimpleAssets mint
- `sa_total` — the true total
- `sa_burned` — burn count (already returned by the endpoint, currently discarded)

`bridge_mint` / `bridge_total` stay exactly as they are. This makes "resolved" unambiguous: if `sa_mint` is absent the real mint genuinely isn't known yet, so `#--` remains correct and no wrong number is ever shown.

### 2. Read the real mint in the ribbon

In `src/components/simpleassets/SimpleAssetCard.tsx`, extend the mint resolution so bridged AA cards prefer `idata.sa_mint`:

```text
saMintDisplay  (SimpleAssets cards, unchanged)
  ?? idata.sa_mint        (bridged AA - NEW)
  ?? nativeAAMint         (native AA, unchanged)
  ?? '#--'
```

Update the tooltip so a resolved value reads "Original SimpleAssets mint number" rather than the current placeholder wording. Add `sa_mint` to the `React.memo` comparator at line 288 so the card actually re-renders when the resolver lands.

The existing "Bridge Mint #N" badge below the artwork stays — it's genuinely different information (bridging order), and keeping both makes the distinction visible rather than confusing.

### 3. Same treatment in the detail dialog

`SimpleAssetDetailDialog.tsx` has the identical `realMint ?? nativeAAMint` pattern at lines 56-62. Apply the same `sa_mint` / `sa_total` preference there so the ribbon and the detail view never disagree. Add `sa_mint`, `sa_total`, `sa_burned` to the hidden-keys list at line 316 so they don't also appear as raw attribute rows.

### 4. Handle the `mint > total` anomaly

Real data from the endpoint includes rows like:

```text
{ asset_id: 100000007398709, mint: 1427, total: 1335, burned: 209 }
```

AtomicHub's `total` nets out burns inconsistently, so a plain `#mint / total` render produces nonsense such as "1427 of 1335" on a visible subset of series2 cards.

Rule: display the fraction only when `mint <= total`. Otherwise show the mint alone (`#1427`), since the mint number is reliable and only the denominator is suspect. This is a small guard in the shared display helper, applied in both the card and the dialog.

## Technical notes

- Files touched: `src/hooks/useGpkAtomicAssets.ts`, `src/components/simpleassets/SimpleAssetCard.tsx`, `src/components/simpleassets/SimpleAssetDetailDialog.tsx`.
- No change to `src/lib/saMintResolver.ts` — it already returns `{ mint, total, burned }` and caches per session. Only `burned` needs to be passed through instead of dropped.
- No backend, network, or schema changes. Purely reading data the app already fetches.
- Native (non-bridged) AA sets and pure SimpleAssets cards keep their current behaviour exactly.

## Verification

Load a wallet holding bridged cards and confirm: ribbon starts at `#--`, then populates with the real mint once the resolver returns; the "Bridge Mint" badge still shows the different bridging number; no card renders a fraction where the mint exceeds the total.
