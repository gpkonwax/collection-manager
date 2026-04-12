

## Fix Demo Openings: Pad Cards to Match Expected Pack Size

### Problem
Demo openings pull random cards from your collection. If you own fewer cards than the pack contains (e.g., 5 cards but opening a 25-card Exotic Mega), you only see 5 cards instead of 25.

### Solution
When the user has fewer collection assets than the expected card count, repeat/cycle through their existing cards to fill the full count. This way a 25-card demo always shows 25 cards being revealed and dealt.

### Changes

**1. `src/components/simpleassets/GpkPackCard.tsx`** (lines 71-75)
- Update `demoAssetsSample` to cycle through available cards when `collectionAssets.length < expectedCount`
- Shuffle first, then repeat the array until we reach `expectedCount`, giving each duplicate a unique suffix ID

**2. `src/components/simpleassets/AtomicPackCard.tsx`** (lines 40-44)
- Same padding logic for `demoAssetsSample` using `pack.cardsPerPack`

**3. Both files — `demoCards` memo**
- Ensure duplicate entries get unique `asset_id` values (e.g., `demo-${a.id}-${index}`) so React keys don't collide

### Implementation Detail
```ts
const demoAssetsSample = useMemo(() => {
  if (collectionAssets.length === 0) return [];
  const shuffled = [...collectionAssets].sort(() => Math.random() - 0.5);
  const result: SimpleAsset[] = [];
  for (let i = 0; i < expectedCount; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}, [collectionAssets, expectedCount]);

const demoCards = useMemo((): RevealCard[] => {
  return demoAssetsSample.map((a, i) => ({
    asset_id: `demo-${a.id}-${i}`, name: a.name, image: a.image || null, rarity: a.quality || '',
  }));
}, [demoAssetsSample]);
```

### Files Changed
- `src/components/simpleassets/GpkPackCard.tsx`
- `src/components/simpleassets/AtomicPackCard.tsx`

