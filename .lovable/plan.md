

## Fix binder view count to show total NFTs owned (not unique slots)

### Problem

The two views count different things:
- **Regular view**: shows `filtered.length` = 99 (total individual NFTs, including duplicates)
- **Binder view**: shows `binderGrid.filter(s => s.owned).length` = 96 (unique template slots that have at least one owned card)

The difference (3) means you own duplicate copies of 3 cards. The binder collapses duplicates into stacks, so it counts 96 unique cards collected. Both numbers are technically correct but confusing when switching views.

### Fix

**`src/pages/Index.tsx`** — Update the binder header (line 763) to show both the total NFT count and the unique collected count, so it's clear and consistent:

Change from:
```
96 / 200 collected
```

To:
```
99 NFTs found · 96 / 200 unique collected
```

This way:
- `99 NFTs found` matches the regular view count exactly
- `96 / 200 unique collected` explains the binder completion progress

### Technical detail

Line 763 currently:
```typescript
{binderGrid.filter(s => s.owned).length} / {binderGrid.length} collected
```

Updated to:
```typescript
{filtered.length} NFT{filtered.length !== 1 ? 's' : ''} found · {binderGrid.filter(s => s.owned).length} / {binderGrid.length} unique collected
```

### Files touched
- `src/pages/Index.tsx` (1 line edit)

