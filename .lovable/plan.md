

## Fix Food Fight Pack Reveal: Slow Minting, Missing Cards, and Interrupted Animation

### Problems identified

1. **Slow minting detection**: The `unbox.nft` polling uses the Atomic API to detect new assets by comparing snapshots. The Atomic API has indexing lag (sometimes 30-60+ seconds), and the current timeout messages are passive — there's no hard timeout or retry logic if the API endpoints themselves time out (which the console logs confirm is happening repeatedly).

2. **Not all 3 cards revealed**: The `unbox.nft` flow calls `onComplete(null)` immediately when all cards are flip-revealed (line 288), passing `null` as txId. In `handlePackOpened` (Index.tsx line 247), `if (txId)` is falsy for `null`, so `pendingAnimationRef` is never set. The card deal animation never triggers.

3. **Site refresh cutting off reveal**: The `onComplete(null)` call triggers `handlePackOpened` which runs `refetchAtomicPacks()` + `refetchAa()`. These refetches cause state changes that re-render the page. Combined with the 1.5-second auto-close timer, the dialog closes and components remount before the reveal animation finishes. The refetch can also cause Vite HMR or React state resets that appear as a "refresh".

### Root cause summary
The `unbox_nft` path skips the "Collect Assets" step and jumps straight to `done`, calling `onComplete(null)`. This:
- Gives no txId, so the card deal animation is never queued
- Triggers refetches immediately, destabilizing the page during the reveal
- Auto-closes the dialog after 1.5s regardless of whether the user saw all cards

### Changes

**`src/components/simpleassets/AtomicPackRevealDialog.tsx`**
1. For `unbox_nft` mode, after all cards are flip-revealed, transition to a `'collect'`-like phase that shows a "Done" button instead of auto-completing — this lets the user see all cards before dismissing
2. Pass a synthetic transaction marker (e.g., `"unbox_nft_complete"`) instead of `null` to `onComplete` so `handlePackOpened` can set up the card deal animation
3. Increase the polling timeout tolerance and add a longer wait message after 90 seconds
4. Only snapshot 50 most recent assets — increase to 100 to avoid missing cards in large collections

**`src/pages/Index.tsx`**
1. Update `handlePackOpened` to accept the `"unbox_nft_complete"` marker as a valid txId for triggering the deal animation
2. Defer the refetch calls until after the reveal dialog fully closes, not immediately on `onComplete`

### Technical detail

Current broken flow:
```text
flip reveal ends → setPhase('done') + onComplete(null) → handlePackOpened(null) 
  → txId is falsy, no animation queued → refetch all → page destabilizes 
  → 1.5s auto-close → user sees partial reveal + no deal animation
```

Fixed flow:
```text
flip reveal ends → show "View in Collection" button → user clicks 
  → onComplete('unbox_nft_complete') → handlePackOpened sets up deal animation 
  → dialog closes → refetch detects new assets → deal animation plays
```

