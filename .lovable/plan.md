# Fix "overdrawn balance" on SimpleAssets trade offers

## What went wrong

Sending an SA↔SA offer signs three actions: the `eosio.msig` proposal, your approval, and a **dust `eosio.token` transfer of 0.00000001 WAX** to the other player. That dust transfer is only there so the recipient can find the proposal (the chain has no "proposals awaiting me" index).

`overdrawn balance` is the token contract rejecting that dust transfer: the sending account has a WAX balance row, but not even one satoshi of *liquid* WAX (everything staked). The proposal itself costs nothing, so the trade fails purely because of the beacon.

## The fix: drop the dust transfer entirely

Incoming proposals can be discovered from history directly. Checked against the live history API: filtering all `eosio.msig::propose` actions returns only ~328 results in the indexed window chain-wide, and each one carries the full `requested` approver list in its action data. So we can list proposals where you are a requested approver without any on-chain beacon, and without any WAX balance.

Discovery becomes:

1. Query the history endpoints for recent `eosio.msig:propose` actions (30-day lookback), keep the ones whose `requested` list contains your account (incoming) or whose `proposer` is you (outgoing).
2. Hydrate each from the `proposal` / `approvals2` tables exactly as today, decode the packed transaction, and keep only well-formed two-transfer SimpleAssets swaps between the two parties.
3. The existing local proposal cache stays as a fallback when history is unreachable.

## Declining without a beacon

Declining currently also sends a dust transfer, so it has the same failure mode. Instead:

- **Decline** hides the offer locally for the recipient and calls `eosio.msig::unapprove` when an approval exists — free, no balance needed. The proposer keeps seeing it as pending until they cancel it or it expires (7 days), and the row is marked "Declined by recipient" once their approval is absent after they acted.
- **Counter-offer** no longer sends a decline beacon; it hides the original locally and proposes the new swap.
- **Cancel** (proposer) is unchanged: `eosio.msig::cancel`, free.

## Safety net

Before signing an SA swap, check the account's liquid WAX and CPU/NET resources and, if the transaction would fail, show a plain-language message ("your account has no liquid WAX / not enough CPU") instead of a raw assertion string. This also improves the failure text for AtomicAssets trades.

## Technical notes

- `src/lib/saTradeActions.ts` — remove `buildBeaconAction`, `offerBeaconMemo`, `declineBeaconMemo`, `SA_BEACON_*` constants and the beacon actions from `buildSaSwapActions` / `buildSaDeclineActions`; the swap bundle becomes `propose` + `approve` only. Add `buildMsigUnapproveAction` usage for decline.
- `src/lib/saOffers.ts` — replace `fetchBeacons` with `fetchProposeActions(account)` hitting `/v2/history/get_actions?filter=eosio.msig:propose&limit=1000&sort=desc&after=<30d>` across `HYPERION_ENDPOINTS`, matching on `act.data.proposer` and `act.data.requested[].actor`. Decline state is derived from the local hidden list plus missing approvals rather than decline beacons. Keep `rememberProposal` / `hideProposalLocally`.
- `src/components/TradesDialog.tsx` — decline path calls the new unapprove/hide flow; no wording change needed beyond the "Declined" state.
- `src/hooks/useSaOffers.ts` — unchanged surface; only the underlying fetch changes.
- Preflight helper reads `/v1/chain/get_account` (core liquid balance + cpu/net limits) through the existing RPC fallback and is called from `TradeComposerDialog` before signing.
- Update the unit tests for `saTradeActions` (no beacon action in the bundle) and add one for the propose-action filter.
