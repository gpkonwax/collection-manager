

## Fix: Cards Disappearing During Deal Animation

### Problem
When demo packs are padded with duplicate cards (cycling through a small collection), multiple `dealingCards` entries share the same `.id`. Since `dealingCardIds` is built from a `Set`, duplicates collapse — meaning fewer placeholder grid cells are rendered than cards to deal. When the animation tries to find a grid cell for a duplicate, it can't, and instantly skips it (the "disappear" effect).

### Solution
Give each entry in `demoAssetsSample` a unique ID so that every card in the deal animation has its own placeholder cell and flies properly.

### Changes

**`src/components/simpleassets/GpkPackCard.tsx`** — In the `demoAssetsSample` memo, clone each asset with a unique ID:
```ts
result.push({ ...shuffled[i % shuffled.length], id: `demo-${shuffled[i % shuffled.length].id}-${i}` });
```

**`src/components/simpleassets/AtomicPackCard.tsx`** — Same change in its `demoAssetsSample` memo.

This ensures every card passed to `dealingCards` has a distinct `.id`, so:
- `dealingCardIds` (Set) won't collapse duplicates
- Each card gets its own placeholder grid cell with a ref in `gridCellRefs`
- The animation finds every target cell and flies each card properly

### Files Changed
- `src/components/simpleassets/GpkPackCard.tsx`
- `src/components/simpleassets/AtomicPackCard.tsx`

