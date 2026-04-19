
The user wants failed card images to auto-retry until they load, instead of showing the placeholder permanently.

Looking at `useIpfsMedia.ts`:
- It rotates through all gateways in `IPFS_GATEWAYS` (likely ~6-8 gateways)
- Once `triedCount + 1 >= IPFS_GATEWAYS.length`, sets `failed = true` and stops
- After failure, `src` becomes `/placeholder.svg` permanently

The fix: instead of giving up after one full rotation, keep retrying with backoff until success. Need to be careful not to hammer gateways infinitely or burn CPU.

## Plan: Auto-retry failed card images

### Change to `src/hooks/useIpfsMedia.ts`

Instead of permanently failing after one full gateway rotation, restart the rotation with exponential backoff:

1. Add a `retryRound` counter (starts at 0).
2. When `triedCount + 1 >= IPFS_GATEWAYS.length`:
   - Don't set `failed = true` permanently.
   - Schedule a delayed retry: `setTimeout(() => { resetTriedCount, increment retryRound, restart from gateway 0 }, backoffMs)`.
   - Backoff: `Math.min(2000 * 2^retryRound, 30000)` — 2s, 4s, 8s, 16s, capped at 30s.
3. Cap `retryRound` at e.g. 10 to avoid truly infinite loops on permanently-broken hashes (after that, show placeholder).
4. Only retry while the component is mounted and `enabled` is true (skip when offscreen).
5. Clear retry timer on unmount and on URL change.
6. During the backoff wait, keep showing placeholder but `failed` stays false so the UI doesn't lock in a "broken" look — or briefly show placeholder with a subtle loading state. Simplest: show placeholder while waiting, then resume loading.

### Why this approach
- IPFS failures are usually transient (gateway hiccup, slow pin propagation). Auto-retry recovers them without user action.
- Exponential backoff prevents hammering already-overloaded gateways.
- 10-round cap (~5 minutes total wait) prevents runaway retries on truly missing hashes.

### Files affected
- **EDIT** `src/hooks/useIpfsMedia.ts` — convert terminal `failed = true` into a delayed retry with bounded rounds.

### Validation
Refresh the page; cards that initially fail should reload themselves within a few seconds without manual interaction.
