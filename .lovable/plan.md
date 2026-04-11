

## Reduce AtomicAssets API Calls

### Current Situation
Every page load makes **15-20+ API calls** to AtomicAssets. The main offenders:
- `fetchTemplateTotals()` in `useCollectionCompletion` fetches templates across 8 categories (~10-12 calls) on every mount
- `useBinderTemplates` fetches the same template endpoints independently (2-3 more calls)
- None of this data is cached between page loads, even though template sets are essentially static

### Plan

**1. Create a shared template data store with sessionStorage caching**
- New file: `src/lib/templateDataCache.ts`
- Fetches all gpk.topps templates once, caches in memory + sessionStorage (TTL: 30 minutes)
- Single function `getAllTemplates()` returns all templates grouped by schema
- Both `useCollectionCompletion` and `useBinderTemplates` consume from this shared store

**2. Update `useCollectionCompletion`**
- Replace `fetchTemplateTotals()` with a call to the shared store
- Derive counts from the cached template list instead of making its own API calls
- Eliminates ~10 redundant API calls

**3. Update `useBinderTemplates`**
- Consume from the shared store instead of fetching independently
- Filter/sort the cached data for the active schema
- Eliminates 1-3 more redundant API calls

**4. Result**
- First page load: **~3-5 API calls** (one paginated fetch for all templates + user assets + packs)
- Subsequent loads within 30 min: **~2 API calls** (just user assets + packs, templates from cache)
- Template data fetched once and shared, not duplicated across hooks

### Files Changed
- `src/lib/templateDataCache.ts` (new) — shared template fetch + sessionStorage cache
- `src/hooks/useCollectionCompletion.ts` — use shared cache instead of own fetch loop
- `src/hooks/useBinderTemplates.ts` — use shared cache instead of own fetch loop

