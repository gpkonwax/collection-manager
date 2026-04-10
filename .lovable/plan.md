

## Fix: Sort cards by side (a before b) within same cardid + variant

### Problem
Cards with the same card ID and variant aren't sorted by side. So you get "5b, 5b, 5a, 5b" instead of "5a, 5b, 5b, 5b".

### Root cause
All three sort functions compare cardid then variant rank, but never compare the `side` field. Need to add `side` comparison after variant rank match.

### Changes

**1. `src/hooks/useSimpleAssets.ts`** (line ~113) — Add side sort after variant rank:
```ts
if (numA !== numB) return numA - numB;
const sideA = a.side || '', sideB = b.side || '';
if (sideA !== sideB) return sideA.localeCompare(sideB);
return getGpkVariantRank(a.quality) - getGpkVariantRank(b.quality);
```

**2. `src/hooks/useGpkAtomicAssets.ts`** (line ~97) — Same change.

**3. `src/pages/Index.tsx`** (line ~200) — Same change for the combined sort:
```ts
if (numA !== numB) return numA - numB;
const sideA = a.side || '', sideB = b.side || '';
if (sideA !== sideB) return sideA.localeCompare(sideB);
const rankDiff = getGpkVariantRank(a.quality) - getGpkVariantRank(b.quality);
return rankDiff !== 0 ? rankDiff : a.quality.localeCompare(b.quality);
```

Sort priority becomes: **Card ID → Side (a/b) → Variant rank**.

### Files touched
- `src/hooks/useSimpleAssets.ts`
- `src/hooks/useGpkAtomicAssets.ts`
- `src/pages/Index.tsx`

