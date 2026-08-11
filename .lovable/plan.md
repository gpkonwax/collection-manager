# Retire the "Show Received Cards" header button

## What the button actually does today

Verified in `src/pages/Index.tsx`: the button is not a recovery tool. It is enabled only when the last pack audit (`packAudit`, built by `reconstructLatestPackOpen`) has matched assets, and clicking it just calls `focusCollectionView(category)` — switch to Classic view, clear search/filters, set the category to the last opened pack's category, and scroll to top. It shows no cards of its own and performs no chain work.

So yes: after a failed or half-drawn open, Pack History → Replay covers the same ground and more. Replay re-runs the reveal and the deal animation, and `handleReplayCollect` matches each recorded card back to assets you still own, so the cards land in the collection view. The one thing Replay needs that the button doesn't is a history entry — either recorded on this device or rebuilt via "Download pack history JSON" and loaded back in.

## Recommendation

Remove the button and lean on Pack History. "Recover Stuck Cards" stays — that one does real work (claims unclaimed `pendingnft.a` rows) and is not replaceable by replay.

## Changes

1. `src/pages/Index.tsx`
   - Delete the `Show Received Cards` `<Button>` from the header.
   - Delete the now-unused `receivedCardsCount`, `hasReceivedCardsToShow`, `receivedCardsCategory`, and `handleShowReceivedCards`.
2. Keep everything else untouched: `packAudit`, `reconstructLatestPackOpen`, `collectionSyncNotice`, `focusCollectionView`, and the pack-audit summary panel are all still used by the live open flow and the recovery path.
3. Optional nicety (say the word and it goes in): after a live pack open finishes, if the opening was recorded to history, surface a small "Replay in Pack History" hint in the audit panel so the fallback is discoverable at the moment it matters.

## Note on the one gap

"Show Received Cards" does not need a history entry. It scans the chain for the latest unboxing ID, finds which cards from that unboxing are now in your wallet, and jumps the collection view to that pack's category. It works immediately after a fresh open even if Pack History is empty.

Replay, by contrast, needs a Pack History entry. That entry contains the exact list of card names/sides/variants that were revealed, plus the pack name and image, so the animation can re-run. There are two ways to get that entry:

1. Live open on this device — the app already records one automatically when a pack is opened.
2. Older openings — the "Download pack history JSON" button rebuilds them from WAX history and loads them in.

So the only scenario where Replay cannot replace the old button is: a pack was just opened on this device, the local history entry somehow did not get written, and the user wants to see/filter the received cards without first rebuilding from chain. In practice the live-open recording path is reliable, so this gap is narrow. That is why it is safe to remove the button, but also why the Pack History button should stay prominent in the header as the replacement path.

