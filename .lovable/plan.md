

## Add Collection Completion Score

### Overview
Add a completion percentage for each category (Series 1, Series 2, Tiger King, etc.) displayed alongside the packs section. 100% = owning at least 1 of every unique card template in the set + 1 of every pack type (unopened). When "All Categories" is selected, show a combined total percentage.

### How It Works

**What counts toward 100%:**
- Every unique card template in the gpk.topps collection for that schema (fetched from AtomicAssets API)
- Every pack type mapped to that category (both SimpleAssets token packs and AtomicAssets NFT packs)

**What the user owns:**
- Unique templates matched from their `assets` array (by template_id or cardid+quality+variant key)
- Pack types with amount > 0 (SimpleAssets) or count > 0 (AtomicAssets)

### Technical Plan

**1. New hook: `src/hooks/useCollectionCompletion.ts`**
- Accepts: all assets, packs, atomicPacks, and the PACK/ATOMIC_PACK category maps
- On mount, fetches template counts for all relevant schemas (`series1`, `series2`, `exotic`, `crashgordon`, `bernventures`, `mittens`, `gamestonk`, `foodfightb`) using the AtomicAssets templates endpoint with `&count=true` or paginated fetches
- Uses the same `ALLOWED_SCHEMA_VARIANTS` filtering as the binder to get accurate totals
- For each category, computes: `ownedUniqueCards / totalTemplates` + `ownedPackTypes / totalPackTypes`
- Returns a `Record<string, { owned: number; total: number; percent: number }>` plus an `overall` entry

**2. UI in `src/pages/Index.tsx`**
- Import the new hook and call it with existing data
- Display a compact completion badge/bar to the right of the packs section heading, e.g.: `Series 1: 42%` with a small progress bar
- When `categoryFilter === 'all'`, show the combined "Overall" percentage
- Use the existing `Progress` component from `src/components/ui/progress.tsx` styled with cheese colors

### Schema-to-Category Mapping for Template Fetching
```text
series1     → schema "five" + "series1" (SA + AA)
series2     → schema "series2"
exotic      → schema "exotic"
crashgordon → schema "crashgordon"
bernventures→ schema "bernventures"
mittens     → schema "mittens"
gamestonk   → schema "gamestonk"
foodfightb  → schema "foodfightb"
```

### Pack Types Per Category
```text
series1:      GPKFIVE, GPKMEGA
series2:      GPKTWOA, GPKTWOB, GPKTWOC
exotic:       EXOFIVE, EXOMEGA, template 13778 (if crashgordon maps here — no, it maps to crashgordon)
crashgordon:  template 13778
bernventures: template 48479
mittens:      template 51437
gamestonk:    template 53187
foodfightb:   templates 59072, 59489, 59490, 59491, 59492
```

### Files Changed
1. **New**: `src/hooks/useCollectionCompletion.ts` — hook to fetch template totals and compute completion
2. **Edit**: `src/pages/Index.tsx` — import hook, render completion % near the packs section

