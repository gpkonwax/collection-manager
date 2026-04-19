
The user wants images that have already loaded successfully to stay rendered when scrolled out of view and back. Currently, with virtualized lists (@tanstack/react-virtual per memory) and `IntersectionObserver` lazy-loading inside `IpfsMedia`, when an image scrolls far away it gets unmounted by the virtualizer. When it remounts, `useIpfsMedia` resets and starts loading again from scratch — which can fail or briefly show a placeholder.

Looking at `useIpfsMedia.ts`: there's already a `gatewayCache` (Map of hash → last working gateway index). So remounted images do reuse the working gateway. The visible flicker / missing images on scroll-back must come from:
1. `IntersectionObserver` in `IpfsMedia.tsx` — when remounted, `isVisible` starts false, briefly shows nothing/placeholder until intersection fires.
2. Browser HTTP cache should serve the image instantly, but the new img tag still goes through load lifecycle.
3. If a retry round added `?_r=N` cache-buster, that URL is now cached at that nonce; remount starts fresh at nonce=0, which should hit browser cache.

## Fix plan

Add a module-level **success cache** keyed by IPFS hash that records the exact resolved URL (including any retry nonce) once an image has successfully loaded. On any future mount of `useIpfsMedia` for that hash, immediately use that known-good URL and skip the IntersectionObserver gate / loading state.

### Changes

**`src/hooks/useIpfsMedia.ts`**
- Add `loadedUrlCache = new Map<string, string>()` at module scope.
- In `onLoad`, when load succeeds, store the current `src` into `loadedUrlCache` keyed by hash (in addition to existing `setCachedGateway`).
- Add `getCachedLoadedUrl(hash)` export.
- On mount, if hash has a cached loaded URL, initialize state to: `isLoading=false`, use that URL directly as `src`, skip rotation/timeout logic.

**`src/components/simpleassets/IpfsMedia.tsx`**
- Before setting up the IntersectionObserver, check `getCachedLoadedUrl(hash)`. If present, treat as immediately enabled (no lazy gate) so the cached URL renders instantly on remount.
- This means scrolling back up renders the exact previously-successful URL with zero placeholder flash; browser HTTP cache serves it.

### Why this works
- Browser already caches the image bytes; we just need to skip our own visibility gate and loading state for known-good hashes.
- Cache survives across virtualizer unmount/remount because it's at module scope, not component state.
- No memory bloat: bounded by gateway cache eviction (already 500-entry LRU); apply same cap to loaded URL cache.

### Files affected
- **EDIT** `src/hooks/useIpfsMedia.ts` — add `loadedUrlCache`, populate on success, prefer cached URL on init.
- **EDIT** `src/components/simpleassets/IpfsMedia.tsx` — bypass IntersectionObserver gate when hash is in loaded cache.

### Validation
Scroll down through many cards, let them load, scroll back up — every previously-loaded image should appear instantly with no placeholder flash, even after virtualizer recycles them.
