
The user is noticing that initial scroll loads images quickly, but after a while loading slows to ~30% speed. Let me diagnose why and propose fixes.

## Why this happens

Looking at the current setup:

1. **Concurrency limiter** (`ipfsConcurrency.ts`): caps at 12 concurrent loads. After scrolling through many cards, the queue backs up — every newly-mounted card has to wait its turn behind cards that may have already been unmounted but didn't release their slot cleanly.

2. **Slot leak risk**: In `useIpfsMedia.ts`, slots are released on `onLoad`, on `failed`, and on unmount. But during virtualization, cards unmount mid-load. The cleanup releases the slot — but only after the React effect cleanup runs. With rapid scrolling, the limiter sees brief spikes of "active" counts that take a moment to drain.

3. **Gateway cache pollution**: `gatewayCache` stores per-hash gateway choices. After many failures, `lastGoodGatewayIndex` may end up pointing at a degraded gateway, and new hashes inherit that bad start position.

4. **Auto-retry timers stay scheduled** on cards that have unmounted? Looking at the code — `mountedRef.current` is checked before setState, and timers are cleared on unmount. That's clean. ✓

5. **Failed cards block the limiter cycle**: Cards that fail go through 5 gateways (~6s each = 30s+) before releasing their slot. While they're churning, healthy cards are starved. This is the biggest contributor to the slowdown the user describes.

6. **No prioritization by viewport position**: A card 3 rows below the viewport gets the same priority as a card barely peeking in. The limiter is FIFO, not viewport-aware.

7. **Browser-level connection saturation**: Pinata/dweb hold open HTTP/2 connections; once we've hit ~50 in-flight requests across an HTTP/2 multiplexed connection, the browser starts queuing. Combined with our 12-slot limiter that's mostly stuck on slow/dead requests, throughput collapses.

## Proposed fixes (ranked by impact)

**1. Faster fail-fast for cards (biggest win)**
Lower per-gateway timeout for `card` context from 6s → 2.5s, and cap total sweep at 3 gateways instead of 5. A card that hasn't responded in 2.5s on a healthy gateway is almost certainly going to fail. Move on faster → release the slot faster → unblock the queue.

**2. Drop the dead Cloudflare gateway**
`cloudflare-ipfs.com` has been documented as failing for 2+ weeks (per memory + comments in `ipfsGateways.ts`). Remove it entirely. One less wasted retry cycle per failed card.

**3. Viewport-priority slot acquisition**
Replace FIFO queue with a priority queue keyed on "distance from viewport center." Cards entering the viewport jump ahead of cards that have scrolled out of overscan. Implementation: each `acquireSlot()` call accepts a priority number; lower = higher priority. Cards report their distance via the IntersectionObserver.

**4. Cancel in-flight loads on unmount**
When a card unmounts mid-load, swap its `<img>` `src` to empty string before unmount to signal the browser to abort. Currently the browser may keep fetching even after the React node is gone, holding the underlying socket. This is subtle but matters under saturation.

**5. Increase concurrency cap with HTTP/2 awareness**
Bump cap from 12 → 20. Pinata/dweb both support HTTP/2 multiplexing, so 20 parallel requests against 4 gateways = ~5 per gateway on different HTTP/2 streams. Browsers handle this fine.

**6. Reset `lastGoodGatewayIndex` if the chosen gateway has been failing recently**
Track per-gateway recent failure rate; if the "last good" gateway's recent failures exceed 50%, demote it and re-shard new hashes across the others.

**7. Reduce overscan during fast scroll**
`VirtualGrid` currently overscans 2 rows. Detect scroll velocity; during fast scroll, overscan = 0 so we don't waste slots loading cards the user is flying past.

## What I'd actually change

To keep this focused and high-impact, I'll do **#1, #2, #4, #5, and #7** in this round. #3 and #6 are more invasive and we should verify the simpler fixes first.

## Files to change

- `src/lib/ipfsGateways.ts` — drop cloudflare gateway; lower `card` timeout to 2500ms; lower max sweep to 3 gateways' worth of time.
- `src/lib/ipfsConcurrency.ts` — bump `MAX_CONCURRENT` from 12 → 20.
- `src/hooks/useIpfsMedia.ts` — cap card sweep at 3 gateway attempts (not all 5); abort in-flight load on unmount by clearing `<img>` src via a ref the IpfsMedia component exposes.
- `src/components/simpleassets/IpfsMedia.tsx` — on unmount during loading, set `img.src = ''` to release socket.
- `src/components/VirtualGrid.tsx` — track scroll velocity; reduce `overscan` from 2 to 0 during fast scrolling, restore to 2 when idle.

## Expected outcome

- Initial load stays fast (no regression)
- Sustained scroll throughput stays close to initial throughput because the limiter no longer chokes on long-running failures
- Failed cards still show retry overlay but resolve to "failed" in ~7.5s instead of ~30s
- Fewer wasted requests during fast flick-scrolling

## What stays the same

- Infinite virtualized scroll UX
- Retry overlay, last-good-src preservation, neutral fallback
- Detail view behavior unchanged (`detail` context keeps higher timeout + 5 gateways since only 1–2 images load at once)

