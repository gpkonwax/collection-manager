# Notify when a sent trade offer gets a reply

Today the Trades button badge only counts new incoming offers. When someone accepts, declines or counters an offer you sent, nothing tells you. This adds a reply notification and an outcome message.

## What the user sees

- **Trades button:** the badge also counts unread replies to your sent offers (one combined number, still capped at "9+"). Tooltip lists both, e.g. "2 new offers, 1 reply".
- **Opening the Trades dialog:** a "Replies" panel at the top lists each unseen outcome:
  - **Accepted** (green) — "alice accepted your trade. You received N cards."
  - **Countered** (yellow) — "alice countered your offer" with a "View counter-offer" button that jumps to it in Received.
  - **Declined** (red) — "alice declined your trade."
  - Each row shows the cards you offered (same small tiles and protocol badge as the offer rows) and the reply time.
- Replies stay in the panel until dismissed (per row, or "Dismiss all"). The badge clears as soon as the dialog is opened, like incoming offers.
- Cancelling your own offer never creates a reply notification.
- Works for both AtomicAssets and SimpleAssets trades.

## How outcomes are worked out

Each poll remembers your pending sent offers. When one disappears from the pending list, its outcome is looked up:

- **AtomicAssets:** look the offer up by ID. Accepted / declined come straight from its state. A decline counts as **Countered** when, within a couple of minutes of the decline, a new offer arrives from that same trader (a counter declines the original and creates the new one in one transaction).
- **SimpleAssets:** an offer whose counter-offer points at it (the existing `re:` marker) is **Countered** — this already shows today as "Countered" in Sent and now also triggers the notification. Otherwise the proposal history is checked: executed = **Accepted**; cancelled by the other trader or expired = **Declined**; cancelled by you = no notification. If history is unreachable, the outcome is checked again on the next poll rather than guessed.
- An offer that vanishes because you acted on it from this app (cancel, or your own counter) is skipped.

## Technical notes

- New `src/lib/tradeReplies.ts`: per-account localStorage store (`gpk-trade-replies:<account>`) of known pending sent offer IDs plus resolved replies `{ id, protocol, outcome, counterparty, assets, repliedAt, seen, dismissed }`; pure `diffSentOffers(prevIds, currentOutgoing)` and `classifyAaOutcome(offer, incoming)` / `classifySaOutcome(...)` helpers. Capped at the 50 most recent replies.
- `src/lib/atomicOffers.ts`: add `fetchOffersByIds(ids)` (`/atomicassets/v1/offers?ids=...`, all states) using the existing API fallback list.
- `src/lib/saOffers.ts`: add `fetchProposalOutcome(proposer, name)` reading Hyperion `eosio.msig` exec / cancel actions for that proposal name (existing full-history fallback list); returns `executed | cancelled(by) | unknown`.
- `useAtomicOffers` / `useSaOffers`: after each refresh, diff outgoing against the stored IDs and resolve vanished ones; expose `replies`, `unreadReplyCount`, `markRepliesSeen`, `dismissReply`. Locally cancelled/countered IDs (already tracked for optimistic removal) are recorded as "self-resolved" and skipped.
- `src/pages/Index.tsx`: badge = incoming unread + reply unread across both protocols; opening the dialog marks both seen.
- `src/components/TradesDialog.tsx`: new Replies panel above the tabs; "View counter-offer" switches to Received and scrolls to that offer.
- Tests (`src/test/tradeReplies.test.ts`): accepted/declined/countered classification for AA, SA executed/cancelled-by-them/cancelled-by-me/superseded, own cancel never notifies, unknown history leaves the offer pending.
