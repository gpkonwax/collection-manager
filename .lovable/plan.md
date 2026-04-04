

## Sync Project with Original CHEESEHub — Full Parity Plan

### 1. Update `ipfsGateways.ts`
Add `IMAGE_LOAD_TIMEOUT` config object and `isVideoUrl()` helper function from the original.

### 2. Update `templateCache.ts`
Add `batchGetOrFetch()`, `clearTemplateCache()`, and `getCacheStats()` functions. Inline the batch fetch logic since `services/atomicApi.ts` doesn't exist in this project.

### 3. Update `fetchWithFallback.ts`
Add the `buildApiUrl` helper utility function.

### 4. Update `waxRpcFallback.ts`
Add Hyperion API support:
- `HYPERION_ENDPOINTS` array
- `HyperionToken` interface
- `fetchAllTokenBalances()`
- `fetchSingleTokenBalance()`
- `fetchAllTokenBalancesViaRpc()`

### 5. Update `useWaxTransaction.ts`
Add `executeRawTransaction` method that returns the full transaction result object.

### 6. Update `WaxContext.tsx`
Add all missing transaction functions from the original:
- `transferCheese`, `transferToken`
- `transferNFTs`, `burnNFTs`
- `claimDrop`, `claimFreeDrop`
- `joinDao`, `leaveDao`

### 7. Create `IpfsImage` component
Reusable component with IPFS gateway cycling on error. Replace raw `<img>` tags in:
- `PackRevealDialog.tsx`
- `AtomicPackRevealDialog.tsx`
- `PackBrowserDialog.tsx`
- `GpkPackCard.tsx`
- `AtomicPackCard.tsx`

Refactor `SimpleAssetCard.tsx` and `SimpleAssetDetailDialog.tsx` to also use it, removing duplicated fallback logic.

### 8. Wrap `Index.tsx` in Layout
Create a `Layout` component (header/footer) matching the original, and wrap the page content.

