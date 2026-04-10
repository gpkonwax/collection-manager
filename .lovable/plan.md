

## Add CheeseHub Banner Ads to GPK Pack Opener

### What this does
Displays the same reward banners from CheeseHub's `cheesebannad` smart contract in the GPK pack opener. Banners rented on CheeseHub will automatically appear here too, reading from the same on-chain data.

### New files

**`src/hooks/useBannerAds.ts`** -- Hook that reads the `cheesebannad` contract's `bannerads` table using the existing `fetchTableRows` from `waxRpcFallback.ts`. Returns up to 2 `ActiveBanner` objects for the current 24-hour window. Handles:
- Multi-day rental content inheritance (copies IPFS hash from earlier row if current row is empty)
- Exclusive vs shared rental types
- Shared slot rotation (placeholder if second renter is absent)
- Suspended banner filtering
- Polls every 60 seconds

**`src/lib/sanitizeUrl.ts`** -- Simple URL sanitizer that strips `javascript:` and `data:` protocols, allowing only `http://`, `https://`, and relative paths.

**`src/components/BannerAd.tsx`** -- Component that renders the banner ads:
- Uses `useBannerAds()` hook
- Shows IPFS-hosted images with gateway fallback (using existing `IPFS_GATEWAYS` from `ipfsGateways.ts`)
- 2 banners side-by-side; 1 banner centered
- Shared banners rotate every 30 seconds
- Placeholder state when no active banners (links to CheeseHub banner ads page)
- "Ad" badge overlay
- Clicking a banner opens the advertiser's URL in a new tab

### Modified files

**`src/pages/Index.tsx`** -- Import and render `<BannerAd />` in the same position as CheeseHub (below the header, above the main content area). Single line addition.

### Technical details
- Contract: `cheesebannad`, table: `bannerads`, scope: `cheesebannad`
- Table row fields: `time`, `position`, `user`, `ipfs_hash`, `website_url`, `rental_type`, `shared_user`, `shared_ipfs_hash`, `shared_website_url`, `suspended`
- Uses `fetchTableRows` (already in the project) instead of CheeseHub's `fetchTable` -- same RPC call, just different wrapper
- No new dependencies needed; uses existing `@tanstack/react-query`, IPFS gateways, and UI components

