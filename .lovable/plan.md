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

The old button worked even with an empty local history. Replay needs an entry. In practice a live open on this device always records one, and anything older can be rebuilt from chain through the existing download flow — so the gap is narrow, but it is the reason to keep the Pack History button prominent in the header.
