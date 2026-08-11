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

The user clicks **Pack History** in the header. The dialog shows the list plus two buttons: **Download pack history JSON** and **Load pack history JSON**.

The list itself is fed by exactly two things:

1. Openings recorded locally as they happen (written the moment a reveal completes).
2. A pack history JSON the user loads.

**Build from chain is export-only.** The dialog has a third, clearly secondary action — *Export my past openings from chain* — that queries WAX history, reconstructs the account's past openings, and immediately hands the user a downloaded JSON file. It does **not** populate the list and does **not** write to local storage. To see that data in the app, the user loads the file they just downloaded. That keeps loading the JSON the normal path instead of hammering chain history on every visit.

So the flow is: run the chain export once → download JSON → load JSON → list is populated → new opens append automatically → re-download whenever the dialog warns the file is out of date.

A warning line appears in the dialog when there are openings recorded since the last download, prompting a fresh export.

Loading merges by transaction id, so loading an older or overlapping JSON never creates duplicates and never overwrites a richer locally recorded entry.

The chain export is manual (button only) and reports clearly if history nodes are unavailable.


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

**Chain export** `src/lib/packOpenHistoryChain.ts`: a shared Hyperion helper (generalising the endpoint-fallback + AbortController pattern duplicated in `saOffers.ts` and `stuckPackDetect.ts`) querying `v2/history/get_actions` filtered on claim actions — `gpk.topps` claim/getcards for SimpleAssets and the AtomicAssets unpack/claim actions per `packOpenActions.ts`. SA rows resolve card identity through the same `resolvePendingGpkCard` path used by the reveal dialog; AA rows resolve template ids via `templateCache`/`templateDataCache`. The result is serialised straight to a downloaded file — it never touches the local store or the dialog list.

**Replay wiring**:

- New `src/components/simpleassets/PackHistoryDialog.tsx` (list, pack/date filters) plus a resolver hook mapping a history entry to `{ live: SimpleAsset[], missing: placeholder[] }`.
- `PackRevealDialog` / `AtomicPackRevealDialog` gain a `replayCards` prop: when supplied they skip chain polling, the claim transaction and the collect button, and drive the existing reveal phases straight from the supplied cards (same timing, audio, animations). Reuses the components rather than forking them.
- On replay finish, feed the resolved list into the existing `dealingCards` / `gridCellRefs` / `CardDealAnimation` path exactly as a live open does. Missing cards deal as `MissingCardPlaceholder` tiles landing in a temporary slot rather than a grid cell.
- Replay is blocked while a live open or deal animation is in flight.


**JSON wiring**: file is `gpk-pack-history-<account>-<date>.json` with envelope `{ type: "gpk-pack-history", version: 1, entries: [...] }`. The two dialog buttons are the primary path (download / load). For consistency, `src/lib/jsonRouter.ts` also gains a `'packhistory'` kind (detect branch, label, merge apply) so the file can be dropped into the existing "Import file(s)…" picker and appears in "Recent imports"; `JsonMenu.tsx` gets a matching badge colour and an "Export pack history" item.

**Out of scope**: history for other wallets, automatic cross-device sync, any on-chain writes.

