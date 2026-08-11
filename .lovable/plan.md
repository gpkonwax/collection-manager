# Mirror-first thumbnails — Pack History only

Speed up the card thumbnails inside the Pack History dialog by loading them from our own backup mirror first, instead of racing public IPFS gateways. Nothing outside Pack History changes.

## Behaviour

- Card thumbnails in Pack History try the primary mirror (GitHub Pages snapshot) first, with a short ~1.5s timeout.
- If the mirror doesn't have the file (404) or is slow, the thumbnail silently falls back to the existing gateway rotation — same look, no error shown.
- Misses are remembered for the session: once a file is known missing on the mirror, later renders of that file skip the mirror straight away. If the mirror itself looks down (repeated network failures), the mirror step is skipped for the rest of the session.
- Grid, binder, detail view, trade pickers, pack reveal and every other surface keep their current loading behaviour untouched.
- A manually selected backup mirror (Netlify / Cloudflare) still wins over everything, as today.

## Technical notes

- `src/hooks/useIpfsMedia.ts`: add an opt-in `mirrorFirst?: boolean` option. When true and no manual mirror is selected, the first attempted URL is `PRIMARY_MIRROR + hash` with a 1.5s timeout; on error/timeout the hook advances into the normal gateway rotation from its cached index. Add module-level session caches: `mirrorMissSet: Set<hash>` and a `mirrorDown` flag (set after a small number of consecutive mirror failures) that both short-circuit the mirror attempt.
- `src/components/simpleassets/IpfsMedia.tsx`: accept and forward a `mirrorFirst` prop to the hook; default false so all existing call sites are unchanged.
- `src/components/simpleassets/PackHistoryDialog.tsx`: pass `mirrorFirst` on the card thumbnail `IpfsMedia` (line ~331). Pack artwork there is a plain `<img>` from `gpkPackMeta` and stays as-is.
- Existing gateway-index caching and the loaded-URL cache stay intact, so a successful mirror load is remembered per hash the same way a gateway load is.
