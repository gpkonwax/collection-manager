I verified the current wallet signal: `pendingnft.a` has no `done: 0` rows, so `Collect Unclaimed` is correctly hidden. The last Series 1 unboxing rows are all `done: 1`, meaning `getcards` already consumed them.

The real bug is more specific: Series 1 `pendingnft.a.cardid` is zero-based, but the minted `simpleassets::sassets` metadata is one-based. For the latest Series 1 pack:

```text
pending reveal rows: 29b prism, 10a prism, 38b sketch, 32b base, 3b base
actual minted assets: 30b prism, 11a prism, 39b sketch, 33b base, 4b base
```

That explains why the cards you saw are not in the collection: the reveal UI and matcher used the raw pending card IDs, while the collection uses the minted metadata IDs.

Plan:
1. Add a shared card-ID normalizer for pack reveal rows:
   - For Series 1 boxtypes `five` and `thirty`, display/match `pending.cardid + 1`.
   - For Series 2, Exotic, and other boxtypes, keep the current card ID unchanged.
2. Use that normalized ID everywhere the reveal flow derives card identity:
   - reveal card name/label
   - reveal image URL
   - `RevealResult` matcher sent to `handlePackOpened`
3. Update exact delivery matching:
   - Match Series 1 minted assets using the normalized one-based ID.
   - Keep the existing “never deal blind cards” guard intact.
4. Improve timeout/recovery messaging:
   - If all pending rows are `done: 1`, do not show `Collect Unclaimed`.
   - Instead show a clear “Cards were collected; refresh/show newest cards” path so users are not looking for a claim button that should not exist.
5. Add a Newest/Recent view path after collection:
   - Auto-clear search, set Classic View, source All, variant All, correct category, and newest-first sorting when pack collection completes or matching times out.
   - This makes the actual newly minted duplicates visible immediately.

Current pack note: do not retry `getcards`; that will keep failing because the contract has already marked those rows as collected.