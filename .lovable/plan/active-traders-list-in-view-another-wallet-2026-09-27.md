# Active Traders list in "View another wallet"

## Goal
Add a second list to the View Wallet popover: accounts that were **active in the last 90 days** — bought, sold, traded, or opened any `gpk.topps` cards/packs. These are the accounts most likely to see and respond to a trade offer. Data is fetched **live on demand** (no manifest, no republishing), cached for the session.

## How it works
1. New module `src/lib/activeWallets.ts`:
   - Queries the AtomicAssets transfers API: `GET /atomicassets/v1/transfers?collection_name=gpk.topps&after=<90 days ago in ms>&sort=created&order=desc&limit=100` and pages until the window is covered (max ~5 pages, so a hard cap keeps it fast).
   - Collects both `sender_name` and `recipient_name` from each transfer, excluding system/market contracts (`atomicmarket`, `atomicpacksx`, `atomicdropsx`, `eosio`, burn accounts) — those are pack sales/market escrows, not people.
   - Also queries the AtomicMarket sales API for the same window (`/atomicmarket/v1/sales?collection_name=gpk.topps&state=3&after=...`) and folds in `buyer` + `seller` — this catches pure buy/sell activity that never shows as a user-to-user transfer.
   - Pack openings are already covered: opening a pack produces a mint transfer to the opener, which appears in the transfers feed.
   - Returns a de-duplicated list sorted by most recent activity, each entry: account, last-active timestamp, activity count.
   - Uses the existing `fetchWithFallback` endpoint rotation (`ATOMIC_API.baseUrls`) with 8s timeouts; one failed mirror just tries the next.
   - Session cache (like the holders cache): one fetch per session, manual refresh button to re-fetch.

2. `ViewWalletControl.tsx` — extend the existing popover:
   - New toggle button under the holders one: **"Show List — Active traders (90 days)"**.
   - Same table style as the holders list: rank, account, "Last active" (e.g. "3d ago"), activity count.
   - Clicking an account fills the input box (same behavior as the holders list).
   - Shares the existing filter box behavior pattern, with its own filter field, loading spinner, error message, and refresh button.
   - Auto-loads on first expand, one attempt only, aborts on popover close — same lifecycle as the holders list.

3. Offline bundle: the list needs the network, so in offline mode the toggle shows "Not available offline" instead of spinning forever.

## Verification
- Unit-test the resolver's account filtering/dedup logic (vitest).
- Typecheck (`tsgo`).
- Live curl check of the transfers/sales queries against the real API to confirm the 90-day window returns accounts.
- Playwright on the preview: open the View Wallet popover, expand the Active list, confirm accounts render with recent dates, click one, confirm it fills the input.

## Technical notes
- `after` param is a millisecond timestamp; `created_at_time` on transfers is ms-precision (verified against live API).
- Endpoint caps at 100 rows/page; 90 days of gpk.topps activity is a few hundred transfers, so 3–5 pages covers it.
- No new dependencies. No backend changes. No manifest regeneration needed.
- Mint-number relay remains deferred — not part of this plan.
