
## Why this is worth doing

Good instinct. Today the reveal *does* include our mirrors in its candidate list, but it treats them as just another option in a mixed pile with public IPFS gateways — and it hands the "preferred" slot to whatever URL the app already resolved (which is usually a public gateway like `ipfs.io` or `cloudflare-ipfs.com`). That means reveals keep bottlenecking on IPFS even though we have a byte-verified copy of every card sitting on Netlify, GitHub Pages, and (for smaller files) Cloudflare.

We control the mirrors. They're fast, CORS-open, hash-verified, and complete for every series we've snapshotted (Series 1, Series 2, Exotic, plus the atomic mirror). They should be the reveal path, not a fallback.

## What changes (conceptually)

Reveals switch to a **mirror-first, IPFS-as-last-resort** model:

1. Local ZIP (instant, offline)
2. Primary mirror (Netlify) — raced in parallel with Backup A (GitHub) — first to answer wins
3. Backup B (Cloudflare) — only if the file exists there (some large files were excluded from Cloudflare's 25 MB limit)
4. Public IPFS gateways — only if all mirrors fail or the file isn't in the manifest at all (e.g. a brand-new card added after the last snapshot)

The "preferred URL" slot (whatever `useIpfsMedia` resolved earlier) is **ignored during reveals** when it points at a public gateway, because that's exactly the slow path we're trying to escape. We keep it only when it's a `blob:` URL (local mirror) or one of our own mirror hosts.

## Where it applies

- `PackRevealDialog.tsx` — flip-card reveal tiles + the background preloader race
- `Index.tsx` — the deal-animation image warmup (`warmDealImagesWithoutBlocking`)
- `handleCollectUnclaimed` recovery path — same behavior

Grid view, detail view, and everything else keep using `useIpfsMedia` unchanged — those already work well and rotate gateways per-tile without blocking anything.

## Behavior guarantees

- If a card's hash is in the pinned manifest → the reveal only ever hits our mirrors. Public IPFS is never touched.
- If a card's hash is *not* in the manifest (new cards minted after last snapshot) → falls through to IPFS gateways with the same racing logic we have now.
- "Reveal now" and the non-blocking reveal flow stay exactly as they are — mirror-first just makes the background warmup finish faster, so the button rarely needs to be pressed.
- No change to the mirror files, manifests, or build scripts.

## Technical details

**`PackRevealDialog.tsx`**
- Rewrite `buildImageCandidates` ordering:
  1. `preferred` URL only if it's `blob:` or starts with one of our mirror bases
  2. `local` (blob: from ZIP)
  3. `mirror` tier: emit as a single **parallel race group** rather than sequential entries (Netlify + GitHub together)
  4. `mirror` Cloudflare (separate — smaller catalog, tried after)
  5. `gateway` tier: only added when `manifest.files[hash]` is absent
- `RevealCardImage` currently walks `fallbacks[]` one at a time with a 3.5s hang-swap. Change it so the mirror group races in parallel (using existing `raceCandidateGroup`) and the winning URL becomes the tile's `src`. Sequential walking is kept only for the post-mirror fallback list.
- Background preloader uses the same ordering, so preloads finish in ~1 round-trip for manifest-covered cards.

**`Index.tsx`**
- `warmDealImagesWithoutBlocking` / `preloadImageThroughGateways` reuse the same mirror-first candidate builder from `PackRevealDialog` (extract it to a small shared helper — likely `src/lib/revealImageSources.ts` — so both files share one source of truth).

**Manifest awareness**
- `loadPinnedManifest()` is already called at reveal start. We use `manifest.files[hash]` presence as the switch: present → mirrors only; absent → allow gateway fallback.

## Out of scope

- Adding new mirrors or re-snapshotting anything
- Grid/detail image loading (unchanged)
- Any change to demo-mode reveals (they already use blob URLs / bundled assets)
