
Root cause looks clear: the last update made image reliability worse because the app now shares a global “last good gateway” across all media, and that shared index can drift to a weak endpoint like `cloudflare-ipfs.com`. I can see this in the session replay: cards were being assigned Cloudflare URLs even though the primary gateway list was reordered to AtomicHub first. With the tighter 4s timeout, once the session gets biased toward a bad gateway, many binder placeholders and owned cards start from the wrong host and fail much more often.

## Plan

### 1. Fix the gateway-selection strategy
Update `src/hooks/useIpfsMedia.ts` so new images do not inherit a risky global gateway choice.

- Remove or heavily restrict `lastGoodGatewayIndex` as the default for new hashes
- Start new hashes from a stable preferred gateway order instead of whichever gateway happened to succeed last for some unrelated asset
- Keep per-hash success caching, because that is still useful
- Make gateway advancement use functional state safely so retries cannot get out of sync during rapid errors/timeouts

This is the main regression fix.

### 2. Separate “preferred default” from “per-hash success”
Update `src/lib/ipfsGateways.ts` to support a safer default strategy.

- Keep AtomicHub gateways at the top
- Push unreliable gateways like Cloudflare to the absolute end or remove them from normal rotation if needed
- Add a helper for the initial/default gateway index instead of always reusing the last globally successful one

### 3. Stop binder templates from hardwiring a fragile first URL
Update `src/hooks/useBinderTemplates.ts`.

Right now binder templates resolve to a concrete gateway URL up front via `getIpfsUrl(...)`. I’ll make sure binder cards still benefit cleanly from the central media rotation logic and don’t get “stuck” with a bad starting URL pattern.

### 4. Verify owned asset image resolution stays consistent
Review and adjust the same image resolution pattern in:

- `src/hooks/useSimpleAssets.ts`
- `src/hooks/useGpkAtomicAssets.ts`
- `src/components/simpleassets/SimpleAssetDetailDialog.tsx`

Goal: all card surfaces should use the same safer IPFS entry behavior, especially detail view and lens view.

### 5. Restore more forgiving timeout behavior
The memory says the intended timeouts were looser than the current values. I’ll rebalance them so binder scrolling does not fail so aggressively under normal gateway latency.

Likely changes:
- raise card/detail timeout back toward the previous 5–6s range
- keep retry rotation, but avoid failing too early during peak IPFS slowness

### 6. Validation
After the fix, I’ll verify:

- binder view loads across multiple pages without widespread placeholders
- owned/collected cards load consistently too
- new images start on AtomicHub gateways again, not Cloudflare
- placeholders remain only for genuinely missing cards, not transient gateway failures

## Files likely affected
- `src/hooks/useIpfsMedia.ts`
- `src/lib/ipfsGateways.ts`
- `src/hooks/useBinderTemplates.ts`
- `src/hooks/useSimpleAssets.ts`
- `src/hooks/useGpkAtomicAssets.ts`
- `src/components/simpleassets/SimpleAssetDetailDialog.tsx`

## Technical note
The strongest clue is the replay showing image `src` values on `cloudflare-ipfs.com` after the recent gateway reorder. That means the current cache/rotation logic is overriding the intended safe default and poisoning new loads session-wide. Fixing that behavior is more important than just reordering the gateway list again.
