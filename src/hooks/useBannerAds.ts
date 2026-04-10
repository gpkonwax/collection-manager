import { useQuery } from '@tanstack/react-query';
import { fetchTableRows } from '@/lib/waxRpcFallback';

interface BannerAdRow {
  time: number;        // unix timestamp e.g. 1775656800
  position: number;    // 1 or 2
  user: string;
  ipfs_hash: string;
  website_url: string;
  rental_type: number; // 0=exclusive, 1=shared
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
  sharedUser?: string;
  sharedIpfsHash?: string;
  sharedWebsiteUrl?: string;
}

function getDayBounds(): { start: number; end: number } {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    start: Math.floor(dayStart.getTime() / 1000),
    end: Math.floor(dayStart.getTime() / 1000) + 86400,
  };
}

function resolveActiveBanner(rows: BannerAdRow[], position: number): ActiveBanner | null {
  const { start, end } = getDayBounds();

  const positionRows = rows
    .filter(r => r.position === position)
    .sort((a, b) => b.time - a.time);

  // Find row for today or most recent before today
  const currentRow = positionRows.find(r => (r.time >= start && r.time < end) || r.time < start);
  if (!currentRow) return null;
  if (currentRow.suspended === 1) return null;

  let ipfsHash = currentRow.ipfs_hash;
  if (!ipfsHash) {
    const earlierRow = positionRows.find(r => r.time < currentRow.time && r.ipfs_hash && r.user === currentRow.user);
    if (earlierRow) ipfsHash = earlierRow.ipfs_hash;
  }
  if (!ipfsHash) return null;

  const isShared = currentRow.rental_type === 1;

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
    limit: 200,
  });

  const banners: ActiveBanner[] = [];
  for (const position of [1, 2]) {
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
