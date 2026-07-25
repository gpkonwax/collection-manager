## Fix Exotic Mega (and every SA pack) getting stuck in "Preparing your reveal…"

### What actually went wrong

The screenshot shows the preload phase frozen on "Loading card 1 of 25…" for an Exotic Mega. The preload loop in `src/components/simpleassets/PackRevealDialog.tsx` fires all 25 image requests in parallel through the same first gateway (Pinata):

```ts
await Promise.all(cards.map(async (c) => preloadCardImage(c.image, 4000)))
```

That triggers three compounding problems:

1. **All 25 requests hit Pinata simultaneously.** Browsers cap concurrent HTTP/1.1 connections per origin at ~6, and Pinata rate-limits/holds the rest. Nothing decodes within 4s.
2. **`new Image()` timeouts don't cancel the underlying request.** When the 4s timer fires we move on logically, but the stalled request stays in the browser's per-origin queue and blocks the retry to the same origin. All 25 cards then try gateway 2 in parallel — same wall.
3. **Exotic packs are mostly GIFs.** Prism / slime / gum / tiger-stripe / etc. variants resolve to multi-MB animated files (`gpkCardImages.ts` flags them as `.gif`). 4s per attempt is too aggressive even on a healthy gateway.

Secondary UI issue: the progress text reads `Loading card ${done + 1} of ${total}` which makes an all-parallel stall look like it's frozen on card 1 specifically, and the `preloading` phase has no escape hatch, so a user can't bail out the way they can from `waiting` after 60s.

### Fix (single file: `src/components/simpleassets/PackRevealDialog.tsx`)

1. **Cap preload concurrency at 4.** Replace the flat `Promise.all` with a small worker pool so we never fan more than 4 requests at the same gateway origin. This eliminates the head-of-line stall entirely — the first few cards actually finish, the "done" counter moves, and slots free up as each resolves.
2. **Bump the per-attempt hang timeout from 4s → 8s** in the preload path, matching the `IMAGE_LOAD_TIMEOUT.max` we already treat as the ceiling elsewhere. Keeps the mid-reveal `RevealCardImage` hang-swap at its current 4s (it swaps between gateways after the browser has already cached the winner, so it can be aggressive).
3. **Log each card's outcome** — `[pack-reveal] card N → <winning gateway>` on success and `card N → unreachable` on total failure — so the next stuck report is diagnosable from the console.
4. **Rewrite the progress line** to `"{done} / {total} cards ready"` and add a subline showing which gateway index the pool is currently reaching for. No more misleading "card 1 of 25".
5. **Add a "Reveal now" escape hatch** that appears after 20s in the `preloading` phase. Clicking it accepts whatever winners have resolved so far, keeps the original URL for cards still in flight, and transitions to `revealing`. `RevealCardImage` already has hang-swap + error rotation, so unresolved cards still self-heal during the staggered reveal.

No changes to `Index.tsx`, the deal animation, the atomic path, or the polling. This is purely the SA reveal preload robustness fix — and since `PackRevealDialog` is shared across every SA pack symbol, it covers Series 1 five/mega, Series 2 a/b/c, and Exotic five/mega uniformly.

### Verification

- Open an Exotic Mega on the deployed site: console should show `[pack-reveal] targeting 25-card unboxing` immediately followed by a stream of `card N → https://...` lines, the counter should climb steadily past 1, and the reveal should start when all 25 (or the user hits "Reveal now") are ready.
- Sanity replay: Series 1 mega (30) and Series 2c (35) — same behaviour, no regressions, no changes to demo mode (still short-circuits before the preload branch).

### Files touched

- `src/components/simpleassets/PackRevealDialog.tsx` — concurrency-limited preload pool, 8s per-attempt timeout, per-card logs, clearer progress copy, "Reveal now" escape hatch after 20s.
