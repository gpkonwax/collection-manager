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

const CONTRACT_ACCOUNT = 'cheesebannad';
const SECONDS_PER_DAY = 86400;

function resolveActiveBanner(rows: BannerAdRow[], position: number): ActiveBanner | null {
  const now = Math.floor(Date.now() / 1000);

  const positionRows = rows
    .filter(r => r.position === position)
    .sort((a, b) => b.time - a.time);

  for (const row of positionRows) {
    // Skip if not currently active (contract uses 24h window from row.time)
    if (row.time > now || row.time + SECONDS_PER_DAY <= now) continue;
    // Skip unrented slots (owned by contract account)
    if (row.user === CONTRACT_ACCOUNT) continue;
    // Skip suspended
    if (row.suspended === 1) continue;

    // Resolve ipfs_hash
    let ipfsHash = row.ipfs_hash;
    if (!ipfsHash) {
      const fallback = positionRows.find(
        r => r.time < row.time && r.ipfs_hash && r.user === row.user
      );
      if (fallback) ipfsHash = fallback.ipfs_hash;
      else continue;
    }

    const isShared = row.rental_type === 1;
    const banner: ActiveBanner = {
      position,
      user: row.user,
      ipfsHash,
      websiteUrl: row.website_url,
      isShared,
    };

    if (isShared && row.shared_user) {
      let sharedIpfs = row.shared_ipfs_hash;
      if (!sharedIpfs) {
        const earlierShared = positionRows.find(
          r => r.time < row.time && r.shared_ipfs_hash && r.shared_user === row.shared_user
        );
        if (earlierShared) sharedIpfs = earlierShared.shared_ipfs_hash;
      }
      if (sharedIpfs) {
        banner.sharedUser = row.shared_user;
        banner.sharedIpfsHash = sharedIpfs;
        banner.sharedWebsiteUrl = row.shared_website_url;
      }
    }

    return banner;
  }

  return null;
}

async function fetchBannerAds(): Promise<ActiveBanner[]> {
  const result = await fetchTableRows<BannerAdRow>({
    code: 'cheesebannad',
    scope: 'cheesebannad',
    table: 'bannerads',
    limit: 60,
    reverse: true,
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
