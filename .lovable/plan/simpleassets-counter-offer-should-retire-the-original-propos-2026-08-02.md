# SimpleAssets counter-offer should retire the original proposal

## What's happening

For AtomicAssets, a counter-offer declines the original offer on-chain in the same transaction. SimpleAssets can't do that: an `eosio.msig` proposal can only be cancelled by its proposer, and when you counter you are the *recipient*, not the proposer. `buildSaSwapActions` reflects this — it only emits a `cancel` when `counterProposal.proposer === me`.

So today, countering an incoming SA offer:

- creates the new proposal (shows in your Sent), and
- leaves the original proposal live on-chain; it is only hidden in your browser's local hidden-list, and stays fully visible in the other trader's Sent tab.

Two real problems: the original stays executable (if you had already approved it, the other side could still execute it), and both traders see a stale row.

## What changes

1. **Withdraw approval when countering.** If I had approved the original proposal, the counter transaction also signs `eosio.msig::unapprove` on it, so it can never execute behind the counter-offer.
2. **Link the counter to the original.** The counter proposal's memo carries a `re:<original proposal name>` marker.
3. **Both sides see the original retired.** Any proposal that another live proposal points at via that marker is treated as superseded — it is dropped from Received on my side and shown in the other trader's Sent tab as **Countered** with a Cancel button, instead of a normal pending offer.
4. **The proposer's own counter still cancels on-chain** (existing behaviour, unchanged).
5. **Local hide is per-account and persists**, so a refresh does not resurrect the countered row.

## Technical notes

- `src/lib/saTradeActions.ts`
  - `buildSaSwapActions` gains `counterApproved?: boolean`; when the counter target's proposer is not me and I had approved, prepend `buildMsigUnapproveAction(me, target.proposer, target.name)`.
  - Memo written into both inner transfers becomes `<memo> re:<targetName>` (trimmed to `SA_MAX_MEMO_LENGTH`); add a `parseCounterRef(memo)` helper.
- `src/lib/saOffers.ts`
  - After decoding each live proposal, collect `parseCounterRef` of every proposal; any proposal whose `name` is referenced by another live proposal is marked `supersededBy`.
  - Superseded proposals where I am the recipient are filtered out; where I am the proposer they are returned with `superseded: true` on the `proposal` field.
- `src/components/TradesDialog.tsx` — render a "Countered" badge and restrict actions to Cancel for `proposal.superseded` rows.
- `src/pages/Index.tsx` — pass whether I approved the countered proposal (`offer.proposal.approvedBy` includes me) into the composer so the unapprove action is included.
- `src/components/TradeComposerDialog.tsx` — forward `counterApproved` to `buildSaSwapActions`; keep the existing local hide of the countered proposal.
- Extend `src/lib/saTrade.test.ts`: unapprove is present only when countering someone else's approved proposal, memo carries `re:` marker and round-trips through `parseCounterRef`, superseded filtering picks the right rows.
