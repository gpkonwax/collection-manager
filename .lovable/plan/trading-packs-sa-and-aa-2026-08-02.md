# Trading packs (SA and AA)

Let packs be included in trades on both contracts, alongside or instead of cards. A trade stays locked to one protocol: AtomicAssets packs trade only with AtomicAssets items, SimpleAssets packs only with SimpleAssets items.

## What changes for the user

**Category dropdown gains "Packs"**
Both sides of the trade composer get a "Packs" entry in the category dropdown. Packs are hidden while "All Categories" is selected, so normal card browsing is unchanged — you have to pick "Packs" to see and select them.

**AtomicAssets packs**
AA packs are ordinary NFTs, so they behave exactly like cards: each pack is its own tile with a picture and its asset id, selectable up to the same per-side cap. Tiles show the pack name and "x cards per pack" instead of a card id / variant line, and no mint ribbon (packs have their own mint but no card metadata).

**SimpleAssets packs**
SA packs are not NFTs — they are token balances on `packs.topps` (for example "3 GPKTWOA"). Selecting "Packs" on a SimpleAssets trade switches that side's grid to a quantity picker: one tile per pack type the wallet holds, with a minus/plus stepper and the owned balance shown. The Selected strip lists them as "2x GPK Series 2A Pack" with an X to clear.

**Mixing**
Any combination is allowed on each side as long as one side is non-empty: cards only, packs only, or both.

**Received / sent offers**
Offers in the Trades dialog render pack entries the same way — AA packs as tiles, SA pack quantities as "2x GPK Series 2A Pack" — on both the "They send" and "You send back" columns.

## Technical notes

**AtomicAssets** — no on-chain change. `useGpkAtomicAssets` already returns schema `packs` assets and the composer does not filter them out, so the work is purely picker-side: add a `packs` key to the category list handling, exclude `packs` from the "All Categories" result set, and branch the tile renderer for pack assets. `createoffer` takes the pack asset ids exactly like card ids.

**SimpleAssets** — the msig proposal grows from two actions to up to four:

```text
simpleassets::transfer(me   -> them, myAssetIds)     [omitted if no cards]
packs.topps::transfer (me   -> them, "2 GPKTWOA")    [one per pack type]
simpleassets::transfer(them -> me,   theirAssetIds)  [omitted if no cards]
packs.topps::transfer (them -> me,   "1 GPKFIVE")    [one per pack type]
```

Still a single atomic proposal requiring both approvals, so neither side can walk away holding both.

- `src/lib/saTradeActions.ts`: add `buildPackTransferAction(from, to, symbol, amount, precision, memo)` emitting a `packs.topps::transfer` with the quantity string formatted to the token's precision. `buildSwapTransactionObject` takes optional `myPacks` / `theirPacks` lists and resolves the ABI per action account (`simpleassets` and `packs.topps`) rather than one ABI for all. `validateSaOffer` accepts pack entries so a side counts as non-empty when it holds only packs, and rejects amounts above the owner's balance or below 1.
- `src/lib/saOffers.ts`: `decodeSwapTransaction` currently hard-requires exactly two `simpleassets::transfer` actions. Widen it to 2–4 actions drawn from `simpleassets::transfer` and `packs.topps::transfer`, still asserting only two distinct accounts and a strict two-way direction; group actions by direction into `{ assetIds, packs }`. Ownership pre-check gains a `packs.topps` `accounts` balance read per party, mirroring the existing "both parties still own everything they promised" filter.
- `src/lib/atomicOffers.ts` types: offer sides carry an optional `packs: Array<{ symbol; amount; label }>` so the SA decoder can surface quantities to the UI.
- `src/components/TradeComposerDialog.tsx`: `AssetPicker` gains a `packMode` branch — for AA it renders pack asset tiles from the existing asset list, for SA it renders the quantity stepper fed by `useGpkPacks(me)` and `useGpkPacks(counterparty)`. Selected pack quantities live in new `myPackQty` / `theirPackQty` state maps and are passed into `buildSaSwapActions`.
- `src/components/TradesDialog.tsx`: render pack entries in both columns.
- `src/lib/saTrade.test.ts`: cover pack-only, pack+card, and mixed-direction proposals through build → decode round-trip, plus validation rejecting over-balance amounts.

The 7-day expiry, `re:<name>` counter-offer supersession, approve/unapprove/cancel flows and the AA counter-offer path are all untouched.
