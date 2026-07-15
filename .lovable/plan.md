# Series 1 Pack Opening — Stuck-in-`pendingnft.a` Recovery

## What the user reported

A collector opened a Series 1 pack (`GPKFIVE`). The pack was consumed, the cards were minted into `gpk.topps` → `pendingnft.a` (scope = their wallet), but the reveal dialog never delivered them. They ended up having to open `waxblock.io` and call `gpk.topps::getcards` by hand.

## Root cause

The reveal flow already has two safety nets, but they don't cover this case:

1. **`PackRevealDialog` (`src/components/simpleassets/PackRevealDialog.tsx`)** — polls `pendingnft.a` every 3s. If the group's row count never reaches `expectedCount` (5 for GPKFIVE) — indexer lag, RPC hiccup, `boxtype` string mismatch, or the user closes the dialog via the 60s escape — the auto `getcards` call is never queued. The dialog stops polling on close.

2. **"Collect Unclaimed" button in `src/pages/Index.tsx` (line 362-371)** — checks `pendingnft.a` **exactly once**, when `accountName`/`isViewing` changes. If rows land after that check (i.e. anytime after page load), the button never appears until the user hard-refreshes the page. That is exactly what happened to the reporter: they opened the pack after login, so the initial check saw zero rows, and nothing re-ran that check afterwards.

Result: cards sitting in `pendingnft.a`, no UI affordance to call `getcards`.

## Fix

Make the recovery button self-healing so a stalled reveal always leaves the user with a one-click path to their cards, and clear the flag once cards are collected via the normal reveal path too.

### Changes (all in `src/pages/Index.tsx`)

1. **Extract the pending check** into a stable `recheckUnclaimed` callback (wraps the existing `fetchPendingNfts(accountName)` + `done === 0` filter + `setShowCollectUnclaimed`).
2. **Background poll while logged in and not viewing another wallet**: `setInterval(recheckUnclaimed, 45_000)` inside the existing effect, cleared on unmount / account change. Also re-run on `window` `focus` and `visibilitychange` → `visible` so returning to the tab surfaces the button immediately.
3. **Re-check on reveal completion / close**: pipe `recheckUnclaimed` into `onSuccess` handlers used by `GpkPackCard` / `AtomicPackCard` (already fired by `PackRevealDialog.handleRevealComplete` and by the escape-hatch close). Call it after the existing `Promise.all([refetchSa, refetchAa, refetchPacks, refetchAtomicPacks])` in `handleCollectUnclaimed` too, so the flag clears reliably once cards are delivered.

### Non-goals

- No contract or transaction-shape changes — `getcards` action, `unboxing` id, and `cardids` grouping already work (that's the manual path the user used successfully on waxblock).
- No changes to `PackRevealDialog` polling logic or the 60s escape hatch — those already behave correctly; the fix is purely making sure the fallback UI reappears.
- No new storage / stuck-pack recording — this case isn't a burned pack; cards exist and are recoverable.

## Verification

- Type check.
- Playwright: load `/` while logged out → button hidden (no regressions). Can't fully reproduce the on-chain stall in preview, but confirm the 45s interval fires (spy on `fetchPendingNfts`) and that manually toggling `showCollectUnclaimed` renders the button in the toolbar row near line 2068.
