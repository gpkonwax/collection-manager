## Problem

AtomicMarket sale listings show up in the "Sent" trades tab. They shouldn't — the Trades section is meant for P2P asset-for-asset trades only, not marketplace listings.

## Root cause (verified)

AtomicMarket implements sales by creating an atomicassets offer from the seller to the `atomicmarket` contract as escrow. These offers have `is_recipient_contract=true`. Our fetcher in `src/lib/atomicOffers.ts` already passes `hide_contract_offers=true`, but that server-side param is clearly not filtering these on the API endpoints we're hitting (the user is seeing them in-app). We're also not defensively filtering client-side.

Additionally, marketplace offers are typically one-sided (assets only in `sender_assets`, nothing in `recipient_assets`), which is another distinguishing signal — a real P2P trade has assets on both sides (or at minimum, is not going to/from a contract).

## Fix

Update `fetchPendingOffers` in `src/lib/atomicOffers.ts` to filter out marketplace/contract offers client-side after normalization, so it doesn't matter whether the API honors `hide_contract_offers`:

1. Drop any offer where `is_sender_contract` or `is_recipient_contract` is `true` (that's atomicmarket, atomicpacksx, etc.).
2. Also drop any offer where both sides are empty (defensive; shouldn't happen but cheap check).
3. Keep the existing ownership-validation step so stale offers still get pruned.

No UI changes needed — the tabs already labeled "Received" / "Sent" will only show true P2P offers once the filter is in place.

## Files touched

- `src/lib/atomicOffers.ts` — add client-side contract-offer filter in `fetchPendingOffers`.
