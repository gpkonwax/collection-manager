# Fix: one Series 2A pack showing as several tiny openings

## What's happening

Confirmed on chain. A Series 2A pack is one "unboxing" that mints 8 cards, but the cards can be claimed in several separate transactions instead of one. Example from WAX history (unboxing 30355):

```text
4a3481d4a5  2026-04-02 06:10  cardids: 2
b461ab369c  2026-04-02 06:09  cardids: 1
df37037cbc  2026-04-02 06:09  cardids: 1
164de27903  2026-04-02 06:08  cardids: 1
e260040172  2026-04-02 06:07  cardids: 1
81634d2d04  2026-04-02 06:07  cardids: 1
86bdd03523  2026-04-02 06:02  cardids: 1
```

That is a single 8-card pack claimed across 7 transactions. The history rebuild creates one entry per transaction, so it appears as 7 packs of 1-2 cards. It also mislabels each fragment, because the pack name/artwork is guessed from the card count in that fragment.

## The fix

Group rebuilt SimpleAssets openings by the pack (`unboxing` id) instead of by transaction:

- Read the `unboxing` value from each `getcards` action while scanning history.
- Rebuild each claim transaction as today, but tag every claimed card with its unboxing id.
- Merge all cards that share the same unboxing id into a single history entry, ordered by claim time, using the earliest claim as the opening time.
- Guess the pack name/symbol/artwork from the merged total (8 -> Series 2A, 25 -> 2B, 55 -> 2C, etc.), so labels and pack art become correct.
- Keep the entry id stable and unique per pack (based on the unboxing id) so re-downloading and re-loading a JSON updates the same entry instead of duplicating it.
- Keep the existing behaviour where one transaction legitimately contains several distinct unboxings: those still split into separate entries.

AtomicAssets reconstruction is untouched.

## Note on already-loaded history

Old fragmented entries loaded from a previous JSON stay in the list until cleared, since they were saved with per-transaction ids. After the fix: use "Clear on this device", then download a fresh pack history JSON and load it.

## Technical details

- `src/lib/packOpenHistoryChain.ts`: carry `unboxing` from `getcards` actions through `reconstructSaOpening`, then merge across transactions in `exportPackHistoryFromChain` before assembling entries. Pack symbol/label/image resolution moves to the post-merge step.
