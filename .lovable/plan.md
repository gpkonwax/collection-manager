# Pack Opening History + Replay

Give every connected user a personal log of every pack they've opened — when, which pack, and what came out — plus a Replay button that re-runs the full reveal and card-deal experience for any past opening.

## What the user sees

- A new **Pack History** button in the header (only when a wallet is connected, styled like the other header buttons).
- A dialog listing past openings, newest first. Each row shows:
  - Pack artwork + name (e.g. "GPK Series 2A Pack") with the SA/AA protocol logo
  - Date/time opened and card count
  - A strip of thumbnails of the cards that came out
  - A **Replay** button and a link to the opening transaction on the explorer
- Replay runs the same experience as a live open: reveal dialog (pack tear, per-card reveal, sounds, timing) followed by the card-deal animation dealing cards into the collection grid — no on-chain transaction, no wallet signing.
- Cards still owned are shown from the live collection. Cards no longer in the wallet (traded, burned, transferred) render as a blank placeholder tile in the same slot, so the pack's shape is preserved.
- Privacy: history is only shown for the connected account. When viewing someone else's wallet, the button is hidden.

## How history is collected

Two sources, merged and de-duplicated by transaction id:

1. **Recorded going forward** — every successful open is written to local device storage the moment the reveal completes. Instant and complete (exact card identities, images, variants).
2. **Backfilled from the chain** — for openings before this feature (or on another device), query WAX history for the account's claim actions and reconstruct each opening. Chain rows give pack type, timestamp, transaction and card identifiers; artwork resolves through the existing card-image tables.

Backfill runs once per account on first open of the dialog, with a manual "Refresh from chain" action. If history nodes are unavailable, locally recorded entries still display with a note that chain backfill failed.

## Technical notes

**Storage module** `src/lib/packOpenHistory.ts`, mirroring `stuckPackStorage.ts` (safe read/write JSON, capped list, per-account filter). Key `gpk:packHistory:v1`, cap ~300 entries. Entry shape:

```text
{ txId, account, source: 'simpleassets' | 'atomicassets',
  packSymbolOrTemplateId, packName, packImage,
  openedAt (ms), matchers: RevealMatcher[],
  cards: [{ id?, name, image, cardid?, side?, variant?, category?, templateId? }] }
```

`matchers` reuses the `RevealMatcher` union from `src/lib/packReveal.ts`, so replay can re-resolve cards against the live collection with `matchRevealedAssets`; `cards` is the frozen snapshot used for placeholders when an asset is gone.

**Write point**: `handlePackOpened` in `src/pages/Index.tsx` (around the `setDealingCards` call at line ~780, plus the second path at ~937) — pack metadata, txId and matched assets are in scope there. Also write a partial entry when matchers time out, so nothing is lost.

**Chain backfill** `src/lib/packOpenHistoryChain.ts`: a shared Hyperion helper (generalising the endpoint-fallback + AbortController pattern duplicated in `saOffers.ts` and `stuckPackDetect.ts`) querying `v2/history/get_actions` filtered on claim actions — `gpk.topps` claim/getcards for SimpleAssets and the AtomicAssets unpack/claim actions per `packOpenActions.ts`. SA rows resolve card identity through the same `resolvePendingGpkCard` path used by the reveal dialog; AA rows resolve template ids via `templateCache`/`templateDataCache`. Results merge into the local store by txId, never overwriting a richer local entry.

**Replay wiring**:

- New `src/components/simpleassets/PackHistoryDialog.tsx` (list, pack/date filters) plus a resolver hook mapping a history entry to `{ live: SimpleAsset[], missing: placeholder[] }`.
- `PackRevealDialog` / `AtomicPackRevealDialog` gain a `replayCards` prop: when supplied they skip chain polling, the claim transaction and the collect button, and drive the existing reveal phases straight from the supplied cards (same timing, audio, animations). Reuses the components rather than forking them.
- On replay finish, feed the resolved list into the existing `dealingCards` / `gridCellRefs` / `CardDealAnimation` path exactly as a live open does. Missing cards deal as `MissingCardPlaceholder` tiles landing in a temporary slot rather than a grid cell.
- Replay is blocked while a live open or deal animation is in flight.

**Out of scope**: history for other wallets, cross-device sync, any on-chain writes.
