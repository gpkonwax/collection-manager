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

## How it works (simple version)

The user clicks **Pack History** in the header. The dialog opens with the list plus two buttons: **Download pack history JSON** and **Load pack history JSON**.

- First time for an account, the list is empty, so the dialog offers **Build from chain** — a one-off backfill that queries WAX history, reconstructs past openings, and fills the list. The user then downloads the JSON once and keeps it.
- From then on, every new pack opened is written straight to local storage as it happens; no chain query needed.
- If local storage is ever cleared (or the user switches device/browser), they click **Load pack history JSON** and they're back — no need to re-run the chain backfill.
- A warning line appears in the dialog when there are openings recorded since the last download, prompting a fresh export.

Everything merges by transaction id, so re-running the backfill or loading an older JSON never creates duplicates and never overwrites a richer locally recorded entry.

Backfill is manual (button), not automatic on open, and reports clearly if history nodes are unavailable.

## Technical notes

**Storage module** `src/lib/packOpenHistory.ts`, mirroring `stuckPackStorage.ts` (safe read/write JSON, capped list, per-account filter). Key `gpk:packHistory:v1`, cap 500 entries per account. Entry shape:




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


**JSON wiring**: `src/lib/jsonRouter.ts` gains `'packhistory'` in `JsonKind`, a `detectKind` branch for the `gpk-pack-history` envelope, a label, and an apply path that merges into `packOpenHistory`. `JsonMenu.tsx` gains an "Export pack history" item (disabled when empty) and a badge colour for the new kind. `Index.tsx` passes the export handler and bumps `refreshKey` after import, same as the existing kinds.

**Out of scope**: history for other wallets, automatic cross-device sync, any on-chain writes.

