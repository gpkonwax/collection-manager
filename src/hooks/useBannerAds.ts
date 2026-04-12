import { useQuery } from '@tanstack/react-query';
import { fetchTableRows } from '@/lib/waxRpcFallback';

interface BannerAdRow {
  time: number;
  position: number;
  user: string;
  ipfs_hash: string;
  website_url: string;
  rental_type: number;
  shared_user: string;
  shared_ipfs_hash: string;
  shared_website_url: string;
  suspended: number;
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

function resolveBannerFromGroup(rows: BannerAdRow[], allRows: BannerAdRow[], position: number): ActiveBanner | null {
  const row = rows.find(r => r.position === position);
  if (!row) return null;
  if (row.user === CONTRACT_ACCOUNT) return null;
  if (row.suspended === 1) return null;

  let ipfsHash = row.ipfs_hash;
  if (!ipfsHash) {
    const fallback = allRows
      .filter(r => r.position === position && r.user === row.user && r.ipfs_hash && r.time < row.time)
      .sort((a, b) => b.time - a.time)[0];
    if (fallback) ipfsHash = fallback.ipfs_hash;
    else return null;
  }

  const isShared = row.rental_type === 1;
  const banner: ActiveBanner = { position, user: row.user, ipfsHash, websiteUrl: row.website_url, isShared };

  if (isShared && row.shared_user) {
    let sharedIpfs = row.shared_ipfs_hash;
    if (!sharedIpfs) {
      const earlierShared = allRows
        .filter(r => r.position === position && r.shared_user === row.shared_user && r.shared_ipfs_hash && r.time < row.time)
        .sort((a, b) => b.time - a.time)[0];
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

async function fetchBannerAds(): Promise<ActiveBanner[]> {
  const result = await fetchTableRows<BannerAdRow>({
    code: CONTRACT_ACCOUNT,
    scope: CONTRACT_ACCOUNT,
    table: 'bannerads',
    limit: 60,
    reverse: true,
  });

  const nowSec = Math.floor(Date.now() / 1000);

  // Group rows by time
  const groups = new Map<number, BannerAdRow[]>();
  for (const row of result.rows) {
    const existing = groups.get(row.time);
    if (existing) existing.push(row);
    else groups.set(row.time, [row]);
  }

  // Find the most recent group where time <= now
  const currentGroupTime = Array.from(groups.keys())
    .filter(t => t <= nowSec)
    .sort((a, b) => b - a)[0];

  if (!currentGroupTime) return [];

  const currentGroup = groups.get(currentGroupTime)!;
  const banners: ActiveBanner[] = [];

  for (const position of [1, 2]) {
    const banner = resolveBannerFromGroup(currentGroup, result.rows, position);
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
