

## Fix: Exotic Pack Cards Show Blank During Reveal

### Root Cause
Two issues prevent exotic card images from appearing during the reveal:

1. **`src/lib/gpkCardImages.ts`** — `SERIES_HASH` is missing entries for `exotic5` and `exotic25`. Since `buildGpkCardImageUrl` returns `null` when the boxtype isn't found, all exotic cards render as blank 🃏 placeholders.

2. **`src/components/simpleassets/PackRevealDialog.tsx`** — `EXPECTED_CARDS` and `SYMBOL_TO_BOXTYPE` are missing `EXOFIVE`, `EXOMEGA`, and `GPKMEGA`. This means polling can't match by boxtype for these packs, though it falls back to count-based matching.

### Verified Data
From the AtomicAssets API, exotic cards use IPFS hash `QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25` with the same path structure (`{variant}/{cardid}{quality}.{ext}`). Series 1 uses `QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p`.

### Changes

**File 1: `src/lib/gpkCardImages.ts`**
Add exotic and mega entries to `SERIES_HASH`:
```typescript
const SERIES_HASH: Record<string, string> = {
  five: 'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p',
  thirty: 'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p',
  gpktwoeight: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
  gpktwo25: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
  gpktwo55: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
  exotic5: 'QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25',
  exotic25: 'QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25',
};
```

**File 2: `src/components/simpleassets/PackRevealDialog.tsx`**
Add missing pack symbols to both maps:
```typescript
const EXPECTED_CARDS: Record<string, number> = {
  GPKFIVE: 5, GPKMEGA: 30, GPKTWOA: 8, GPKTWOB: 25, GPKTWOC: 55,
  EXOFIVE: 5, EXOMEGA: 25,
};

const SYMBOL_TO_BOXTYPE: Record<string, string> = {
  GPKFIVE: 'five', GPKMEGA: 'thirty',
  GPKTWOA: 'gpktwoeight', GPKTWOB: 'gpktwo25', GPKTWOC: 'gpktwo55',
  EXOFIVE: 'exotic5', EXOMEGA: 'exotic25',
};
```

### Scope
Two files, no structural changes — just adding missing mapping entries.

