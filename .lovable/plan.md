
Goal: stop cards from thrashing between image/placeholder while scrolling, especially after they have already loaded once.

What I think is happening:
- `useIpfsMedia` now keeps retrying aggressively, but `onError` still advances unconditionally.
- If the browser cancels/deprioritizes image work during scrolling, those cancellations can look like failures and trigger gateway swaps.
- Once a card has loaded, later retries/errors should not replace it with a placeholder or a different gateway URL.
- `IpfsMedia` is also still unmounting the media element behind the visibility gate, so remounts can briefly appear blank again.

Plan:
1. Harden `useIpfsMedia.ts` so stale/cancelled events cannot trigger a retry loop.
   - Track the currently active request/attempt.
   - Ignore `onError` / timeout transitions when they no longer belong to the active attempt.
   - Stop retry timers immediately on success or when loading is disabled.

2. Make successful renders “sticky”.
   - Once a hash loads successfully, treat that exact URL as authoritative for that session.
   - If the same card later hits an error/backoff, keep returning the last good URL instead of swapping to `/placeholder.svg`.
   - Only fall back to placeholder if the card has never loaded successfully and all retry rounds are exhausted.

3. Keep lazy loading, but avoid blanking already-known cards in `IpfsMedia.tsx`.
   - Do not reintroduce the eager bypass that caused mass fetches.
   - Preserve the current IntersectionObserver gate for first load.
   - For cards that already have a known-good URL, avoid showing the skeleton/blank state again once they re-enter view.

4. Verify the scroll behavior in all card contexts.
   - Classic grid
   - Binder owned cards
   - Missing binder placeholders using `IpfsMedia`
   - Saved layout cards

Files to update:
- `src/hooks/useIpfsMedia.ts`
- `src/components/simpleassets/IpfsMedia.tsx`

Expected result:
- First-time loads can still retry across gateways.
- After a card has rendered once, it should stay visually stable on scroll-back instead of disappearing/reloading over and over.
- Fewer false failures caused by scroll-induced browser cancellations.
