## Problem

When the detail dialog opens, the **back** image often takes up to ~30s to appear. Cause is in `useIpfsMedia`: it tries one IPFS gateway at a time with a 5s starting timeout (growing to 8s), across 5 gateways. If the first 2–3 gateways are slow/dead, elapsed time is `5s + 6.5s + 8s + 8s ≈ 27–30s` before the back finally renders. The front usually looks instant because it was already cached while browsing the grid — the back was never fetched until the dialog opened.

## Fix strategy

Two complementary changes, both scoped to the media/loading layer (no business logic touched):

### 1. Parallel gateway race for detail-context images

Add a `race` mode to `useIpfsMedia` used only when `context === 'detail'`:

- On mount (or when `enabled` flips true) for an uncached hash, fire an in-memory `Image()` preload against the first **3 gateways in parallel**.
- The first one to fire `onload` wins:
  - Cache that exact URL via existing `setCachedLoadedUrl` / `setCachedGateway`.
  - Set `src` to the winning URL so the visible `<img>` renders from the browser's HTTP cache (no second network round-trip).
- If all 3 lose their own 4s timeout, fall back to the current sequential rotation for the remaining gateways.
- Skip racing entirely when `getCachedLoadedUrl(hash)` already returns a URL.

Expected result: back image resolves in roughly `min(latency of 3 fastest gateways)` ≈ 300–1500 ms instead of up to 30s.

### 2. Prefetch the back image while the card is on-screen

In `SimpleAssetCard` (or wherever card grid cells resolve `asset.images`), when the card scrolls into view fire a low-priority `new Image()` for `images[1]` if it exists. This warms `loadedUrlCache` before the user ever clicks. If they never open the detail dialog nothing is displayed; if they do, it's instant.

This uses the same gateway rotation cache already in place, so a warmed back reuses whatever gateway worked for the front.

## Technical details

Files to change:

- `src/hooks/useIpfsMedia.ts`
  - Add internal `raceGateways(hash, startIdx, count, perTimeoutMs)` helper returning `Promise<{ url, gwIdx } | null>`.
  - New effect: when `context === 'detail'`, `enabled`, no `cachedLoadedUrl`, and not yet loaded, call race with first 3 gateways starting at `startIdx`, 4000 ms each. On success, set gwIdx/nonce/cache and mark loaded. On failure, let the existing sequential path continue from where the race left off (advance `triedCount` by 3, `gwIdx` to `startIdx + 3`).
  - Guard with `attemptRef` so stale races from previous URLs are ignored.

- `src/lib/ipfsGateways.ts`
  - Lower `IMAGE_LOAD_TIMEOUT.detail` from 5000 → **3500 ms** so the sequential fallback after a lost race also fails faster.
  - Add exported `RACE_GATEWAY_COUNT = 3` and `RACE_TIMEOUT_MS = 4000` constants for the hook to consume.

- `src/components/simpleassets/IpfsMedia.tsx`
  - No structural change; still renders single `<img>` bound to `src` from the hook. Race happens inside the hook so the DOM tree is unchanged (avoids layout jank and duplicate visible images).

- `src/components/simpleassets/SimpleAssetCard.tsx`
  - When the card mounts and `asset.images[1]` exists, schedule an `idle` prefetch (`requestIdleCallback` with `setTimeout` fallback) that instantiates `new Image()` pointed at the primary gateway for the back hash. Skip if `getCachedLoadedUrl(backHash)` already returns a value.

Non-goals:

- No changes to the gateway list order.
- No changes to reveal/animation/collection logic.
- No new dependencies.

## Verification

1. Load app, open a Series 1 card detail dialog cold (hard refresh first). Front and back should both appear within ~1–2s under normal network conditions.
2. Simulate a slow gateway by blocking `gateway.pinata.cloud` in DevTools → back should still load quickly via the parallel race winner.
3. Scroll through the collection, then open a card that was visible: back should be instant (prefetch cache hit).
4. Confirm no duplicate network requests for already-loaded hashes (existing sticky cache still short-circuits).
