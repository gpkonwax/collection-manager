
Goal: remove the long wait when opening NFT details and make animated Prism/Collector cards play smoothly again.

What I found
- The detail dialog only switches IPFS gateways after the browser hard-fails an image. If a gateway hangs, the back image can sit there for a very long time before anything changes.
- There is already an `IMAGE_LOAD_TIMEOUT` config, but it is not being used by the actual image components.
- IPFS fallback logic is duplicated across cards, placeholders, detail view, and deal animation, so each part behaves differently and can restart from a bad gateway.
- Animated cards are still rendered as plain `<img>` GIFs. The grid currently forces eager/sync loading for them, which can make multiple animated cards feel chunky.
- The app already has utilities for video detection/cached media in other areas, but the main asset hooks/UI are not using that richer media path.
- Opening the detail dialog also triggers a Radix ref warning, which is extra noise and worth cleaning while touching that flow.

Implementation plan
1. Centralize media loading
- Create one shared IPFS media loader/hook used by cards, detail dialog, missing placeholders, and deal animation.
- Make it advance on timeout as well as `onError`, instead of waiting forever on a stalled gateway.
- Cache the last successful gateway per CID/path so once one side of a card loads, the other side starts from the working gateway instead of retrying from the bad one.

2. Speed up NFT detail view
- Update `SimpleAssetDetailDialog` to preload all card media as soon as the dialog opens.
- Add visible loading states per side so users see progress immediately instead of a blank area.
- For detail view specifically, use a more aggressive fallback strategy so the back image resolves quickly.
- Keep raw JSON toggle and metadata behavior unchanged.

3. Improve animated card playback
- Extend asset parsing so cards can carry richer media info, not just a single image string:
  - front/back still image URLs
  - optional animation/video URL when metadata provides one
  - media type flag
- Prefer video playback for animated variants when metadata includes a video source.
- If only GIF exists, stop forcing heavy decode behavior across many cards and only autoplay animation for cards actually on screen.

4. Build a shared media renderer
- Replace direct `<img>` usage in the main NFT card path with a shared component that can render:
  - static image
  - animated GIF fallback
  - looping muted `<video>` when available
- Use lightweight grid settings (`lazy`/`metadata`) and stronger detail settings (`auto`/preload on open).
- Pause or avoid mounting offscreen animated media so the browser is not decoding lots of animations at once.

5. Reduce page-wide slowdowns
- Reuse the new loader in `MissingCardPlaceholder` so binder view is not filling the page with stalled IPFS requests.
- Reuse it in `CardDealAnimation` so reveal/deal animation does not reintroduce the same slow media behavior.
- If the page still hiccups after media fixes, do a small follow-up refactor so periodic wallet balance updates do not rerender the whole collection screen.

6. Cleanup and regression checks
- Fix the dialog ref warning in the shared dialog wrapper/components while updating the detail modal.
- Verify normal grid, binder view, selection mode, drag/drop, and detail modal still work after media changes.

Technical details
- Likely files touched:
  - `src/lib/ipfsGateways.ts`
  - `src/hooks/useSimpleAssets.ts`
  - `src/hooks/useGpkAtomicAssets.ts`
  - `src/components/simpleassets/SimpleAssetCard.tsx`
  - `src/components/simpleassets/SimpleAssetDetailDialog.tsx`
  - `src/components/simpleassets/MissingCardPlaceholder.tsx`
  - `src/components/simpleassets/CardDealAnimation.tsx`
  - `src/components/ui/dialog.tsx`
- New shared shape I’d introduce on assets:
  - primary thumbnail/front
  - optional back image
  - optional animation/video source
  - media type / playback hint
- Fallback strategy:
  - grid: short timeout + cached gateway preference
  - detail: preload immediately + faster fallback escalation
- No backend changes needed.

Success criteria
- Opening an NFT detail should show the back within a few seconds when any healthy gateway is available.
- Prism/Collector animations should look continuous instead of stop-start when visible in the grid.
- Binder placeholders and other IPFS-heavy views should feel more stable, not slower.
