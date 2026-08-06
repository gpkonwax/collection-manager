# Pack Opening History + Replay

Give every connected user a personal log of every pack they've opened — when, which pack, and what came out — plus a Replay button that re-runs the full reveal and card-deal experience for any past opening.

## What the user sees

- A new **Pack History** button in the header (visible only when a wallet is connected, styled like the other header buttons).
- A dialog listing past openings, newest first. Each row shows:
  - Pack artwork + name (e.g. "GPK Series 2A Pack"), SA/AA protocol logo
  - Date/time opened, card count
  - A strip of thumbnails of the cards that came out
  - **Replay** button, and a link to the opening transaction on the explorer
- Replay runs the same experience as a live open: the reveal dialog (pack tear, per-card reveal, sounds, timing) followed by the card-deal animation dealing cards into the collection grid — no on-chain transaction, no wallet signing.
- Cards still owned are shown from the live collection. Cards that were in the pack but are no longer in the wallet (traded, burned, transferred) render as a blank placeholder tile in the same slot, so the pack's shape is preserved.
- Privacy: history is only ever shown for the connected account. When viewing someone else's wallet, the button is hidden.

## How history is collected

Two sources, merged and de-duplicated by transaction id:

1. **Recorded going forward** — every successful open is written to local device storage at the moment the reveal completes. This is instant and complete (includes exact card identities, images, variants).
2. **Backfilled from the chain** — for openings that happened before this feature (or on another device), query WAX history for the connected account's claim actions and reconstruct each opening. Chain rows give the pack type, timestamp, transaction, and card identifiers; card artwork is resolved through the existing card-image tables.

Backfill runs once per account on first open of the dialog, with a manual "Refresh from chain" action. If history nodes are unavailable, the locally recorded entries still display, with a note that chain backfill failed.

## Technical notes

**New storage module** `src/lib/packOpenHistory.ts`, mirroring the `stuckPackStorage.ts` pattern (safe read/write JSON, capped list, per-account filter). Key `gpk:packHistory:v1`, cap ~300 entries. Entry shape:

```text
{ txId, account, source: 'simpleassets' | 'atomicassets',
  packSymbolOrTemplateId, packName, packImage,
  openedAt (ms), matchers: RevealMatcher[],
  cards: [{ id?, name, image, cardid?, side?, variant?, category?, templateId? }] }
```

`matchers` reuses the existing `RevealMatcher` union from `src/lib/packReveal.ts`, so replay can re-resolve cards against the live collection with `matchRevealedAssets`; `cards` is the frozen snapshot used for placeholders when an asset is gone.

**Write point**: `handlePackOpened` in `src/pages/Index.tsx`, immediately after all matchers resolve (currently around the `setDealingCards` call) — pack metadata, txId and the matched `SimpleAsset[]` are all in scope there. Also write a partial entry when matchers time out, so nothing is lost.

**Chain backfill** `src/lib/packOpenHistoryChain.ts`: a shared Hyperion helper (generalising the endpoint-fallback + AbortController pattern duplicated in `saOffers.ts` and `stuckPackDetect.ts`) querying `v2/history/get_actions` for the account filtered on the claim actions — `gpk.topps:getcards` for SimpleAssets and the AtomicAssets unpack/claim actions per `packOpenActions.ts`. SA rows carry `cardids`, resolved to card identity via the same `resolvePendingGpkCard` path used by the reveal dialog; AA rows resolve template ids through `templateCache`/`templateDataCache`.

**Replay wiring**:
- New `src/components/simpleassets/PackHistoryDialog.tsx` (list + filters by pack/date) and a `useCards`-side resolver hook that maps a history entry to `{ live: SimpleAsset[], missing: placeholder[] }`.
- `PackRevealDialog` / `AtomicPackRevealDialog` gain a `replayCards` prop: when supplied they skip chain polling, the claim transaction and the collect button, and drive the existing reveal phases straight from the supplied cards (same timing, audio and animations). This reuses the existing components rather than forking them.
- On replay finish, feed the resolved list into the existing `dealingCards` / `gridCellRefs` / `CardDealAnimation` path exactly as a live open does. Missing cards deal as placeholder tiles (reusing `MissingCardPlaceholder`) that land in a temporary slot rather than a grid cell.
- Replay is blocked while a live open or deal animation is in flight.

**Out of scope**: history for other people's wallets, cross-device sync, and any on-chain writes.
