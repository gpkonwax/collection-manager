# Protocol-locked trading + SimpleAssets ↔ SimpleAssets swaps

Trading stays strictly same-protocol: AtomicAssets trades only for AtomicAssets, SimpleAssets only for SimpleAssets. Never a mix.

## 1. Lock the trade to one protocol

The protocol is decided by the card you click **Trade** on:

- Click an AtomicAssets card → composer header reads **AtomicAssets ↔ AtomicAssets trade**, and both pickers list only AA cards (this is the current behaviour, made explicit).
- Click a SimpleAssets card → composer header reads **SimpleAssets ↔ SimpleAssets trade**, and both pickers list only SA cards.

Details:
- A protocol badge sits next to the dialog title, plus one line of helper text explaining that mixed-contract trades are not supported.
- Each picker's counts, filters and empty states apply to that protocol's cards only, so there is no way to select a card from the other contract.
- The Trade button currently only appears on AtomicAssets cards when viewing someone's wallet; it will now also appear on SimpleAssets cards.

## 2. How a SimpleAssets swap works

SimpleAssets has no built-in two-sided escrow, so the swap is executed as an **atomic multisig proposal** (`eosio.msig`): a single transaction that transfers your cards to them and their cards to you. It only ever executes with both signatures — neither side can take a card and walk away.

Flow from the user's point of view:

```text
You:   pick their cards + your cards -> "Send offer"
       (signs: eosio.msig propose + your approval)

Them:  sees it under Trades > Received
       "Accept"  -> signs approval, proposal executes, cards swap
       "Decline" -> proposal is dropped / ignored
       "Counter" -> cancels the old proposal, proposes a fresh one

You:   "Cancel" on a sent offer -> cancels the proposal
```

Everything is presented in the existing Trades dialog with the same wording as AA offers ("You send" / "They send back"), the same mint-placeholder ribbon, card ID + variant and series labels.

## 3. Trades dialog

- Received and Sent tabs merge AA offers and SA proposals into one chronological list.
- Every row carries a small protocol badge (AtomicAssets / SimpleAssets) so it is always clear which contract the trade uses.
- Offers older than 7 days are flagged **Stale** with a one-click Cancel (sent) or Decline (received). Nothing expires automatically; proposals are created with a long on-chain expiry so they stay valid until acted on.
- The unread badge in the header counts both kinds.
- Accept / decline / cancel / counter all use the existing optimistic-removal + retry-polling behaviour so the list updates without a page refresh.

## Technical notes

**New: `src/lib/saTradeActions.ts`**
- `buildSaSwapTransaction({ me, counterparty, myAssetIds, theirAssetIds, memo })` → two `simpleassets::transfer` actions (mine→them authorized by me, theirs→me authorized by them) wrapped into an `eosio.msig::propose` with `requested = [me@active, counterparty@active]` and a long expiration (30 days).
- `buildApproveAction`, `buildExecAction`, `buildCancelAction`, `buildUnapproveAction` for `eosio.msig`.
- Deterministic proposal name derived from proposer + timestamp (12-char eosio name), stored so the row can be matched later.
- `validateSaOffer(...)` mirroring `validateOffer` in `atomicTradeActions.ts` (non-empty both sides, cap per side, no self-trade, memo length).

**New: `src/lib/saOffers.ts`**
- Reads `eosio.msig` `proposal` + `approvals2` tables (scope = proposer) to get proposal state and who has approved.
- Discovery of proposals where I am a requested approver: query the Hyperion history endpoint for `eosio.msig::propose` actions referencing my account, then hydrate each from the tables above. The exact Hyperion filter will be verified against the live endpoint during implementation; a locally-cached list of known proposals (written when I propose, and when I see one) is kept as a fallback so nothing is lost if history is unavailable. Reuses the existing RPC/API fallback lists in `waxRpcFallback.ts`.
- Decodes the packed transaction back into the two transfers, then resolves each `assetid` against the `simpleassets::sassets` tables of both owners to produce the same `OfferAsset` shape the AA path already uses (name, image via IPFS gateway rotation, cardid, variant, category) so `TradesDialog` renders both protocols with one code path.
- Proposals whose transaction is not exactly two same-protocol transfers between the two parties are ignored (defensive: never render or auto-approve an unrecognised proposal).

**New: `src/hooks/useSaOffers.ts`**
- Same surface as `useAtomicOffers` (`incoming`, `outgoing`, `isLoading`, `refresh`, `removeOfferLocally`, `refreshWithRetries`, unread tracking), polling on the same 60s interval.

**Changed files**
- `src/components/TradeComposerDialog.tsx` — takes a `protocol: 'atomicassets' | 'simpleassets'` prop; filters picker sources by that protocol (`myAssets.filter(a => a.source === protocol)`); the SA path builds and signs the msig proposal instead of `createoffer`; title/badge/helper text reflect the protocol.
- `src/components/TradesDialog.tsx` — accepts a combined offer list with a `protocol` field, adds the protocol badge and stale flag, and routes accept/decline/cancel/counter to the AA or SA action builder.
- `src/pages/Index.tsx` — `handleTradeFromCard` records the clicked card's `source` as the composer protocol; wires `useSaOffers` alongside `useAtomicOffers` and merges both for the dialog and unread badge.
- `src/components/simpleassets/SimpleAssetCard.tsx` — show the Trade button for SimpleAssets cards too (currently gated on `isAtomic`).

**Tests**
- Unit tests for `saTradeActions` (action shape, ordering, authorizations, validation edge cases) and for the proposal decoder in `saOffers` (round-trip a built proposal back into two transfers, reject malformed ones).
