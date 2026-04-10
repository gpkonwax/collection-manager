

## Fix: Magnification lens breaks after ~30 seconds

### Root cause

The `ImageWithLens` component calls `useIpfsMedia` separately from the `IpfsMedia` component that actually renders the `<img>` tag. The second hook's `onLoad` callback is never triggered (no `<img>` element uses it), so its internal timeout keeps firing, rotating through IPFS gateways every 5-8 seconds. After cycling through all 5 gateways (~30s), it sets `failed = true` and `src` becomes `'/placeholder.svg'`. The lens then either shows an empty circle (broken background-image URL) or hides entirely.

### Fix

Remove the second `useIpfsMedia` hook from `ImageWithLens`. Instead, build the resolved URL directly using the cached gateway index, which the already-loaded `IpfsMedia` component has already populated:

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`**:

1. Import `getCachedGatewayIndex` from `useIpfsMedia` and `extractIpfsHash`, `IPFS_GATEWAYS` from `ipfsGateways`.
2. Replace `const { src: resolvedUrl } = useIpfsMedia(url, ...)` with:
   ```typescript
   const hash = url ? extractIpfsHash(url) : null;
   const cachedIdx = getCachedGatewayIndex(hash);
   const resolvedUrl = hash ? `${IPFS_GATEWAYS[cachedIdx]}${hash}` : url;
   ```
3. Remove the `useIpfsMedia` import if no longer used elsewhere in this file (it's still used via `IpfsMedia` internally, but not directly imported here).

This approach uses the gateway that `IpfsMedia` already validated and cached, without running a parallel timeout chain. The URL is stable and won't rotate or fail.

### Files touched
- `src/components/simpleassets/SimpleAssetDetailDialog.tsx` — replace `useIpfsMedia` call with direct cache lookup

