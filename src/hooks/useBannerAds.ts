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

  // Filter to this position, sorted newest-first
  const positionRows = rows
    .filter(r => r.position === position)
    .sort((a, b) => b.time - a.time);

  // Walk newest-first, only consider today's rentals
  for (const row of positionRows) {
    if (row.time >= end) continue;       // future row
    if (row.time < start) continue;      // expired (not today)
    if (row.suspended === 1) continue;   // suspended

    // Resolve ipfs_hash: use row's own, or search earlier rows for same user, or any earlier row
    let ipfsHash = row.ipfs_hash;
    if (!ipfsHash) {
      // Try same-user fallback first
      const sameUser = positionRows.find(r => r.time < row.time && r.ipfs_hash && r.user === row.user);
      if (sameUser) {
        ipfsHash = sameUser.ipfs_hash;
      } else {
        // Skip this row entirely — it's a placeholder with no content
        continue;
      }
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
