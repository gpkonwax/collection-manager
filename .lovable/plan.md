# Selling SimpleAssets for WAX

## What the digging found

I pulled the live `simpleassets` ABI from WAX and went through every action and table.

**SimpleAssets has no built-in sale mechanism.** Its transfer-related actions are:

- `transfer` — move assets, no payment
- `offer` / `claim` / `canceloffer` — a "gift waiting to be picked up" (owner, newowner, assetids, memo). There is **no price field anywhere**, so the claimer pays nothing
- `delegate` / `undelegate` — timed lending
- `burn`, `attach`, `mdupdate`, etc. — nothing money-related

The fungible side (`offerf`, `transferf`) is the same story: a `quantity` of a token, not a price. So there is no native "sell this card for X WAX" action in the contract itself. Payment must be enforced by something outside SimpleAssets.

There are two realistic ways to do it, and both work today.

### Option A — SimpleMarket (`simplemarket`), the existing CryptoLions marketplace

It's deployed and still functioning on WAX (most recent activity in the last weeks, though volume is very low). Verified flow from on-chain history:

```text
List:   simpleassets::transfer  owner -> simplemarket
        memo: {"price":"5.00000000 WAX"}
Buy:    eosio.token::transfer   buyer -> simplemarket
        memo: {"nftid":100000020283693,"affiliate_id":200001}
Cancel: simplemarket::cancel    { owner, assetids[] }
Reprice: simplemarket::updateprice { saleid, newprice, offerprice, offertime }
Listings live in the `sells` table (id, owner, author, category, price, offerprice).
```

Fees observed on a real sale: 1% house + 2% tax + an author fee set per author. The `feestable` scope for `gpk.topps` is **empty**, so GPK cards would carry no author fee — a seller nets roughly 97%.

Trade-off: the card sits in the marketplace contract's custody while listed, and it's a third-party contract we don't control. Upside: listings are public, so anyone with any wallet or explorer can buy — it's a real open market.

### Option B — WAX-for-cards atomic swap using our existing msig system (recommended)

We already run SimpleAssets P2P trades through `eosio.msig` in `src/lib/saTradeActions.ts`: one proposal holding both sides' transfers, executing only when both parties approve. Adding WAX to a side is a one-line conceptual change — swap in an `eosio.token::transfer` action alongside the `simpleassets::transfer`:

```text
proposal trx:
  simpleassets::transfer  seller -> buyer   [assetids]
  eosio.token::transfer   buyer  -> seller  "25.00000000 WAX"
```

Nothing leaves either wallet until both sign, no escrow contract, no marketplace fees, and it reuses the composer, offers list, counter-offer, supersession and expiry logic we already built. It also covers `packs.topps` pack tokens for WAX with the same shape.

Trade-off: it's a private offer between two named accounts, not a public listing — a buyer has to be found first (same as our current card-for-card trades).

## Recommendation

Build Option B first: add WAX as an asset type inside the existing trade composer ("You send: 2 cards" / "They send back: 25 WAX"), since it's a small, self-contained extension of code that already works and carries no fees or custody risk. Option A can be layered on later as a public "List for sale" surface if you want open-market discovery.

## Technical notes for Option B

- `src/lib/saTradeActions.ts`: add `buildWaxTransferAction(from, to, amount, memo)` targeting `eosio.token::transfer` with `quantity: "N.00000000 WAX"` (8-decimal precision), and accept `myWax` / `theirWax` in `buildSwapTransactionObject` and `buildSaSwapActions` alongside the existing `myPacks` / `theirPacks`.
- `validateSaOffer`: allow a side that contains only WAX; require at least one non-WAX item overall so it isn't just a payment; enforce a sane min (e.g. 0.1 WAX) and a max, and reject WAX on both sides.
- Preflight: `describeResourceProblem(..., { requiresWax })` in `src/lib/accountResources.ts` already exists — use it to warn the payer before signing, and re-check the payer's liquid balance when the offer is *accepted* (balance can drop between propose and exec, which would make `exec` fail with "overdrawn balance").
- `src/lib/saOffers.ts`: the proposal decoder needs to recognise `eosio.token::transfer` actions and surface the amount so received/sent offers show "+25 WAX" on the correct side.
- `src/components/TradeComposerDialog.tsx`: a WAX amount input per side, rendered as a chip in the same strip as card and pack tiles, with the standard "You send / They send back" wording.
- `src/components/TradesDialog.tsx`: show the WAX leg in both the received and sent views, and in the counter-offer flow.
