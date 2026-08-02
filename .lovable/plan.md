# Clarify the "Swap gc3aaapatdyl" label on SimpleAssets trades

`gc3aaapatdyl` is not an account. It is the on-chain **multisig proposal name** — a 12-character eosio name generated when the swap is proposed (`g` + encoded timestamp + 3 random chars, from `makeProposalName`). SimpleAssets has no escrow contract, so each swap lives as an `eosio.msig` proposal identified by proposer + this name; it is the exact equivalent of the `Offer #12345` id shown on AtomicAssets rows.

The counterparty is already shown right after the protocol badge ("to guydgnjzgage"), so no account information is missing — the label just reads like one.

## What changes

- The row header shows `Proposal gc3aaapatdyl` instead of `Swap gc3aaapatdyl`, so it clearly reads as an id rather than a name.
- Hovering the id shows a tooltip: "On-chain multisig proposal id, proposed by <proposer>".
- The counterparty stays where it is, with the existing "to" / "from" wording.

## Technical notes

`src/components/TradesDialog.tsx` line 180 — change the non-atomic branch label text and wrap the id in a `title`/tooltip using `offer.proposal?.proposer`. Presentation only; no change to proposal naming or trade logic.
