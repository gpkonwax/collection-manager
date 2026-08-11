# Mirror-first thumbnails

## What changes

Card thumbnails currently ask public IPFS gateways first and only touch the backup mirrors as a last resort. The mirrors are plain static hosting (GitHub Pages, Netlify, Cloudflare Pages) with CDN caching and no rate limits, so they are consistently faster and steadier than the gateways.

Every card thumbnail across the app — collection grid, binder, pack reveal strips, trade pickers, puzzle builder, pack history — will try the primary mirror first and fall back to the normal gateway rotation only when the mirror doesn't have the file.

Detail-view (full-size) images keep the existing parallel gateway race, with the mirror added as a first-choice candidate so nothing there gets slower.

## Behaviour

```text
thumbnail request
  -> already loaded this session?      -> reuse cached URL
  -> primary mirror (fast, CDN)        -> done
  -> mirror 404 / error / slow (~1.5s) -> normal gateway rotation
  -> remember the miss for the session -> that image skips the mirror next time
```

- A mirror miss is recorded for the session so the same image never pays the mirror penalty twice.
- If the primary mirror itself is unreachable (not just missing one file), it is skipped app-wide for the rest of the session and everything falls straight through to gateways.
- Manually selecting a mirror in the backup panel keeps working exactly as today, including hash verification.
- Nothing changes about which images exist; this only changes the order they are fetched in.

## Technical details

- `src/lib/ipfsGateways.ts`: add a thumbnail-oriented candidate builder that puts `PRIMARY_MIRROR` ahead of `PUBLIC_IPFS_GATEWAYS`, plus a short mirror-probe timeout constant (~1500ms).
- `src/hooks/useIpfsMedia.ts`: when no mirror is manually selected and the context is `card`, start at the mirror URL instead of the cached gateway index; on error/timeout advance into the existing gateway rotation. Add a module-level `mirrorMissCache` (hash set) and a `mirrorDown` flag, both session-scoped, consulted before choosing the mirror. Existing gateway/loaded-URL caches, the sticky "already loaded" behaviour, and the detail-context race are left intact.
- `prefetchIpfsImage` gets the same mirror-first ordering so prefetched thumbnails warm the same URLs the render will use.
- No component-level changes needed — `IpfsMedia` already routes every thumbnail through this hook.
