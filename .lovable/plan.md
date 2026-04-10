

## Speed up card deal animation to ~7 seconds per card

Current timing: 4s sit + 4s fly + 2s land = 10s per card.
Target: ~7s per card (~30% faster).

### Changes in `src/components/simpleassets/CardDealAnimation.tsx`

Update the three timing constants:

```ts
const SIT_DURATION = 2800;   // was 4000
const FLY_DURATION = 2800;   // was 4000
const LAND_PAUSE = 1400;     // was 2000
```

Total: 2.8 + 2.8 + 1.4 = 7.0 seconds per card.

### Files touched
- `src/components/simpleassets/CardDealAnimation.tsx` (3 constant values)

