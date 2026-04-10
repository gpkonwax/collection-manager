import { useQuery } from '@tanstack/react-query';
import { fetchTableRows } from '@/lib/waxRpcFallback';

interface BannerAdRow {
  time: string;       // e.g. "2024-01-15T00:00:00"
  position: number;   // 0 or 1
  user: string;
  ipfs_hash: string;
  website_url: string;
  rental_type: string; // "exclusive" or "shared"
  shared_user: string;
  shared_ipfs_hash: string;
  shared_website_url: string;
  suspended: number;   // 0 or 1
}

export interface ActiveBanner {
  position: number;
  user: string;
  ipfsHash: string;
  websiteUrl: string;
  isShared: boolean;
  // For shared slots, the second renter
  sharedUser?: string;
  sharedIpfsHash?: string;
  sharedWebsiteUrl?: string;
}

function getCurrentDayStart(): string {
  const now = new Date();
  return now.toISOString().split('T')[0] + 'T00:00:00';
}

/**
 * Find the active banner for a position by looking at all rows for that position
 * up to and including today. Multi-day rentals inherit content from earlier rows.
 */
function resolveActiveBanner(rows: BannerAdRow[], position: number): ActiveBanner | null {
  const today = getCurrentDayStart();
  
  // Filter rows for this position, sorted by time descending
  const positionRows = rows
    .filter(r => r.position === position)
    .sort((a, b) => b.time.localeCompare(a.time));

  // Find the current or most recent row for today or earlier
  const currentRow = positionRows.find(r => r.time <= today || r.time.split('T')[0] === today.split('T')[0]);
  if (!currentRow) return null;

  // Skip suspended banners
  if (currentRow.suspended === 1) return null;

  // Resolve IPFS hash — inherit from earlier row if empty
  let ipfsHash = currentRow.ipfs_hash;
  if (!ipfsHash) {
    const earlierRow = positionRows.find(r => r.time < currentRow.time && r.ipfs_hash && r.user === currentRow.user);
    if (earlierRow) ipfsHash = earlierRow.ipfs_hash;
  }

  if (!ipfsHash) return null;

  const isShared = currentRow.rental_type === 'shared';

  const banner: ActiveBanner = {
    position,
    user: currentRow.user,
    ipfsHash,
    websiteUrl: currentRow.website_url,
    isShared,
  };

  if (isShared && currentRow.shared_user) {
    let sharedIpfs = currentRow.shared_ipfs_hash;
    if (!sharedIpfs) {
      const earlierShared = positionRows.find(
        r => r.time < currentRow.time && r.shared_ipfs_hash && r.shared_user === currentRow.shared_user
      );
      if (earlierShared) sharedIpfs = earlierShared.shared_ipfs_hash;
    }
    if (sharedIpfs) {
      banner.sharedUser = currentRow.shared_user;
      banner.sharedIpfsHash = sharedIpfs;
      banner.sharedWebsiteUrl = currentRow.shared_website_url;
    }
  }

  return banner;
}

async function fetchBannerAds(): Promise<ActiveBanner[]> {
  const result = await fetchTableRows<BannerAdRow>({
    code: 'cheesebannad',
    scope: 'cheesebannad',
    table: 'bannerads',
    limit: 100,
  });

  const banners: ActiveBanner[] = [];
  
  for (const position of [0, 1]) {
    const banner = resolveActiveBanner(result.rows, position);
    if (banner) banners.push(banner);
  }

  return banners;
}

export function useBannerAds() {
  return useQuery({
    queryKey: ['bannerAds'],
    queryFn: fetchBannerAds,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
