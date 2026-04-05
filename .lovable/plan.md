

## Fix: Back of card loading too slowly in NFT detail view

### Problem
The back image takes forever because:
1. **Detail timeout is 15 seconds** -- way too long when only 2 images are loading
2. **No global "last known good" gateway** -- the cache is per-hash, so the back image (different hash) starts from gateway 0 even if gateway 0 is dead and the front already found that gateway 2 works
3. **Increment adds 3s per retry** -- so worst case you wait 15s + 18s + 21s before cycling through

### Changes

**`src/lib/ipfsGateways.ts`** -- Reduce detail timeouts aggressively:
- `detail`: 15000 → 5000 (5 seconds)
- `increment`: 3000 → 1500 (1.5s per retry)  
- `max`: 25000 → 12000

**`src/hooks/useIpfsMedia.ts`** -- Add a global "last successful gateway" tracker:
- Track `lastGoodGatewayIndex` at module level (not per-hash)
- When looking up a hash with no cache entry, fall back to `lastGoodGatewayIndex` instead of 0
- When any image loads successfully, update both the per-hash cache AND the global last-good index
- This means: front image loads on gateway 2 → back image immediately starts from gateway 2

**`src/components/simpleassets/IpfsMedia.tsx`** -- Set detail images to `loading="eager"`:
- Detail context images should load eagerly so both front and back start fetching immediately when dialog opens

### Result
- If gateway 0 is slow, front image switches to gateway 2 after 5s
- Back image immediately starts from gateway 2 (not 0), loading in parallel
- Worst case for back image goes from ~45s+ to ~8s

