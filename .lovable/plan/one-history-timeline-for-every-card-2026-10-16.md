# One history timeline for every card

## What you'll see
- **Every card gets the same left-to-right timeline**, whether it is a SimpleAssets or an AtomicAssets card.
- **Bridged AtomicAssets cards (Series 1/2) show their whole life.** The timeline runs from the pack opening, through every SimpleAssets sale and transfer, to the bridge, and then on through the AtomicAssets sales and transfers to the current owner. A small "Bridged to AtomicAssets" step marks where the switch happened.
- **Native AtomicAssets cards** (Crash Gordon, Food Fight and the others) get the same timeline built from their AtomicHub sales and transfers.
- **A "Classic list" tickbox** sits beside "Show history" and switches back to the old layout for any card. The old layout is the newest-first list for SimpleAssets cards and the two Sales/Transfers columns for AtomicAssets cards. The choice is remembered on this device.
- The "Show listings & cancellations" button stays and applies to every card.

## Limits to know
- AtomicHub returns at most the 100 most recent sales and 100 most recent transfers for each card. If a card goes over that, a note says older AtomicAssets events may be missing.
- If the AtomicHub service is down, the SimpleAssets part still shows, with a "Try again" for the rest.

## Technical details
- `SimpleAssetDetailDialog` passes `saOriginId` (`asset.idata.sassets_id` when bridged) to `TradeHistorySection`.
- New pure function `mergeHistory(saEvents, aaHistory)` in `src/lib/historyTimeline.ts`:
  - Converts AA sales to `kind: 'sale'` (seller→buyer, with price amount and token) and AA transfers to `kind: 'transfer'`.
  - Drops AA transfers that duplicate a sale (same txid), then sorts oldest first.
  - Tags each event with its chain so each card shows a small SA or AA marker.
- `tradeHistory.ts` gains raw amount and token fields so prices render the same in both formats.
- The tickbox state is saved in localStorage (`gpk-history-classic`). The classic view reuses the old row and column markup, which will be restored.
- Tests: the merge order and the removal of duplicate sales and transfers; that a bridged card includes its SA events before its AA events; and that the tickbox switches the view.
