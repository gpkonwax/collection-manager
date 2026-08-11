# Cache Pack History thumbnails

## Problem

Thumbnails in Pack History re-fetch every time the dialog is opened after a page reload, and sometimes even between opens. Today the only memory of "where this image came from" is an in-memory map inside the image hook: it maps an IPFS hash to the exact URL that last loaded successfully. That map is wiped on every page refresh, so each session starts from scratch and re-races mirrors/gateways for hundreds of small card images. Even within a session, whether an image appears instantly depends on the browser's own HTTP cache, which IPFS gateways often discourage.

## What will change

1. **Remember successful image URLs across reloads.**
   The hash-to-URL map (and the matching gateway index) gets persisted to local storage with a time-to-live of about 30 days, restored on app start. On the next visit the app immediately points each thumbnail at the URL that previously worked instead of re-probing.

2. **Store the actual thumbnail bytes locally.**
   Add a small image cache using the browser's Cache Storage, scoped to pack-history-sized thumbnails. When a thumbnail loads from the mirror, its bytes are stored; on later opens they are served straight from disk cache with no network request, so the grid paints instantly and works even if the mirror is briefly unreachable. Cache entries are capped (roughly 1500 images, oldest evicted first) and can be cleared.

3. **Warm the cache when the dialog opens.**
   After a history JSON is loaded, quietly pre-fetch the thumbnails for the visible pack groups so drilling into a pack is instant rather than staggered.

4. **Stop unnecessary remounts.**
   Keep the resolved thumbnail state for a pack group alive while the dialog is open, so switching between the gallery overview and a pack's detail list does not restart image loading for images already shown.

5. **Clear control.**
   The existing Clear (trash) action in the Pack History toolbar also clears the thumbnail cache, so stale or wrong images can always be flushed.

## Technical notes

- `src/hooks/useIpfsMedia.ts`: back `loadedUrlCache` / `gatewayCache` with a versioned, TTL'd local-storage snapshot (debounced writes, hydrate once at module load). Add a Cache Storage lookup ahead of the mirror-first attempt: on hit, hand the hook an object URL; on load success, `cache.put` the response for mirror-served (same-origin/CORS-safe) URLs only — cross-origin gateway responses that are opaque are skipped and only their URL is remembered.
- New `src/lib/thumbCache.ts`: thin wrapper over `caches.open('gpk-thumbs-v1')` with `get(hash)`, `put(hash, url)`, `prune(max)`, `clear()`, plus a graceful no-op path when Cache Storage is unavailable.
- `src/components/simpleassets/PackHistoryDialog.tsx`: call a `warmThumbs(hashes)` helper after history load/group selection; wire `clear` to `thumbCache.clear()` and the persisted URL map.
- No changes to how images are resolved on the homepage/detail views beyond the shared persisted URL map, which benefits them too without altering their fallback behaviour.
