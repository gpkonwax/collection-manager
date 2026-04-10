

## Fix AtomicHub Links for Missing Puzzle Piece Placeholders

### Problem
The AtomicHub market URL in `MissingPuzzlePiecePlaceholder` uses `collection_name=gpk.topps&schema_name=series2`, but the puzzle pieces belong to the `gpktwoeight` collection. This means the links point to the wrong marketplace listings.

### Fix
**`src/components/simpleassets/MissingPuzzlePiecePlaceholder.tsx`** — line 11

Change the `getAtomicHubSearchUrl` function to use the correct collection and schema:

```typescript
function getAtomicHubSearchUrl(cardId: number): string {
  return `https://wax.atomichub.io/market?collection_name=gpktwoeight&order=asc&sort=price&search_type=sales&immutable_data.cardid=${cardId}`;
}
```

Single line change — corrects `collection_name` to `gpktwoeight` and removes the incorrect `schema_name=series2` filter.

