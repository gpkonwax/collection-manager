## What actually happened

The `getcards` transaction your app broadcast after the reveal **succeeded on-chain** — the manual retry error `e_card_already_minted` is the `gpk.topps` contract confirming those `pendingnft.a` rows were already consumed. So the 5 Series 1 cards were minted into `simpleassets` under new asset IDs and are sitting in your WAX wallet right now. Two independent UI bugs stacked to make it look otherwise:

1. **Wrong deal animation.** `handlePackOpened` (`src/pages/Index.tsx` ~line 347) snapshots `preCollectIdsRef` then diffs the next `assets` change. The 300 ms `setTimeout` before refetch is often shorter than indexer catch-up on `sassets`; when the refetch returns without the new IDs, an unrelated background refetch (AtomicAssets rehydrate, or the initial paginated sweep completing) drops other IDs into the diff. Those "already-owned" cards get fed to `CardDealAnimation`, which is exactly what you saw.
2. **Category jump hid the real cards.** The effect at line 317 calls `setCategoryFilter(newCards[0].category)` from those wrong diff cards. Meanwhile the real refetch (which arrives a few seconds later) does include the freshly minted IDs, but you'd never notice — the animation dominates the screen and the category filter is already parked on whatever the diff picked.

## Fix plan

Files: `src/pages/Index.tsx`, `src/components/simpleassets/PackRevealDialog.tsx`, `src/components/simpleassets/AtomicPackRevealDialog.tsx`, `src/components/simpleassets/GpkPackCard.tsx`, `src/components/simpleassets/AtomicPackCard.tsx`.

1. **Emit the reveal identity from the dialog.** When `PackRevealDialog.handleCollect` succeeds, call `onComplete(txId, { unboxingId, pendingRowIds, cards: [{cardid, side, variant}, ...] })`. Mirror on the atomic reveal dialog with template/asset identifiers it already has.

2. **Match, don't diff.** Rewrite `handlePackOpened` to:
   - store the reveal identity in a ref (`pendingRevealRef`),
   - loop: `await refetchSa(); await refetchAa();` then check whether every revealed card is matched to a new `sassets`/atomic asset ID not present in `preCollectIdsRef`,
   - retry with backoff (2 s, 4 s, 6 s… up to ~45 s total),
   - when all matched, set `dealingCards` to **exactly those matched asset IDs** — never a blind `assets.filter(...)`.

3. **Never deal blind cards.** Remove the current effect at line 317 that starts the animation from any non-empty diff; the animation must only start from the matched list built in step 2.

4. **Timeout path.** If matching doesn't complete within the window: skip the animation, run `recheckUnclaimed()`, toast "Cards delivered — refresh to see them if they don't appear shortly", and re-focus `categoryFilter` on the pack's expected category so the user finds them.

5. **Guard the category jump.** Only call `setCategoryFilter` once the matched list is non-empty, using the matched cards' category.

6. **Post-mortem for your current pack.** No code change needed — refresh the page (or click any refetch trigger) and the freshly minted Series 1 cards will appear in your SA collection under new asset IDs. Do not retry `getcards` for that `unboxingid`; it will keep failing with `e_card_already_minted` because delivery already happened.

## Manual `getcards` format (for future manual recovery only)

```text
from     : your WAX account            (name)
unboxing : pendingnft.a.unboxingid     (uint64, single value)
cardids  : [row.id, row.id, ...]       (uint64 array of pendingnft.a PK ids,
                                        one call per unboxingid group)
```

Plain integers, JSON array, no quotes. `cardids` uses the `id` column of `pendingnft.a` — not the `cardid` metadata field and not the `unboxingid`.

## Verification

- `bunx tsgo --noEmit` passes.
- Open a Series 1 pack in preview:
  - reveal shows correct 5 cards,
  - after Collect, only those exact 5 cards are dealt (matched by `cardid+side+variant`), never a stray "already-owned" card,
  - if indexer stalls past 45 s, no animation runs and a toast + Collect Unclaimed appears instead.
- Cross-check `sassets` scope for the account shows the new IDs.
