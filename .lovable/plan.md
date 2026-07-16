# Always-visible "Recover Stuck Cards" recovery button

## Problem

Right now `Collect Unclaimed` only renders when `showCollectUnclaimed` is true. That flag is set by `recheckUnclaimed`, which runs on mount / after actions. If the user closes the reveal modal, or the recheck races / errors out, the button is hidden and there is no way for the user to trigger a manual recovery pass — even though the cards are sitting in `pendingnft.a` on-chain waiting for `getcards`.

We also just fixed a pagination bug that caused `fetchPendingNfts` to miss the newest rows on busy accounts. Even with that fix, there is still no user-visible fallback if the reveal modal misses the poll window.

## Solution

Keep the current auto-shown `Collect Unclaimed` button (contextual, appears when the app knows there is work to do), and add a **persistent, always-visible manual button** so the user can always trigger `getcards` for any stuck `done=0` rows without depending on the recheck state.

### Where the button lives

In the same toolbar row as the existing conditional button (around `src/pages/Index.tsx` line 2423), add a small **"Recover Stuck Cards"** outline button. It is shown whenever:

- `accountName` is set (user is signed in), and
- `!isViewing` (not viewing another wallet read-only).

It stays visible even when there is nothing pending — that is the whole point of a fallback. The button is disabled (with spinner) while `isCollecting` is true.

When the conditional `Collect Unclaimed` button is already showing, the manual button is hidden to avoid two side-by-side buttons doing the same job.

### What it does

Wire it to reuse the existing `handleCollectUnclaimed` handler so we get the full success experience — **including the card deal animation**. That handler already:

1. Snapshots `preCollectIdsRef` from the current collection.
2. Calls `fetchPendingNfts` (paginated) and groups `done=0` rows by `unboxingid`.
3. Fires one `getcards` transaction per group via `executeRawTransaction`.
4. Sets `pendingAnimationRef` so `waitForNewCollectionAssets` can pick up the newly-minted assets after refetch.
5. Refetches SA / AA / packs, waits for the new assets to land, then triggers `focusCollectionView` and `reconstructLatestPackOpen({ focus: false, silent: true })` — which feeds the on-page **CardDealAnimation** (dealingCards → handleCardDealt → handleDealComplete flow already wired at lines 674+).
6. Updates `collectionSyncNotice` so the "Show Received Cards" pill remains available afterward.

If `fetchPendingNfts` returns no `done=0` rows, `handleCollectUnclaimed` already short-circuits with `toast.info('No unclaimed cards found')` and clears the sync notice — behavior we keep. No transaction fires and no animation plays in that case.

Because the deal animation is driven entirely inside `handleCollectUnclaimed` (via `pendingAnimationRef` + `reconstructLatestPackOpen`), pointing the new button at that same handler guarantees the animation plays exactly the same way as the existing auto-shown button today.

### Copy

- Button label: `Recover Stuck Cards`
- Icon: `RefreshCw` (matches sibling buttons; spins while `isCollecting`)
- Tooltip / `title`: `Scan pendingnft.a and claim any cards that were minted but never delivered.`
- Empty-state toast: keep existing `No unclaimed cards found`.

### Verification checklist (post-implementation, in build mode)

1. Sign in on an account with known stuck rows → button visible → click → `getcards` fires → deal animation plays → cards land in collection → sync-notice pill appears.
2. Sign in on a clean account → click button → empty toast → no animation, no error.
3. During an in-flight recovery, the button shows `Collecting...` and is disabled.
4. When `showCollectUnclaimed` is true, only the auto button renders (no duplicate).
5. Read-only "viewing" mode hides the button (same rule as the existing one).

### Technical notes

- File to edit: `src/pages/Index.tsx` only.
- No new hooks, no new state — reuse `isCollecting`, `handleCollectUnclaimed`, `showCollectUnclaimed`, `pendingAnimationRef`, `preCollectIdsRef`.
- Keep styling consistent with the sibling `border-cheese/50 text-cheese hover:bg-cheese/10` outline buttons.
- No changes to `PackRevealDialog.tsx`, `remoteMirror`, `CardDealAnimation`, or the recently-added pagination code — those are already correct.

### Out of scope

- No changes to the reveal-dialog polling behavior.
- No new persistent local-storage tracking of stuck packs (the on-chain `pendingnft.a` table is already the source of truth).
- No changes to atomic-assets pack recovery (this is a SimpleAssets `gpk.topps` flow).
