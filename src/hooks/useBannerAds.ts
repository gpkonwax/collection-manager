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
  time: number;
  position: number;
  user: string;
  ipfsHash: string;
  websiteUrl: string;
  rentalType: 'exclusive' | 'shared';
  displayMode: 'full' | 'shared';
  sharedUser?: string;
  sharedIpfsHash?: string;
  sharedWebsiteUrl?: string;
}

const CONTRACT_ACCOUNT = 'cheesebannad';
const SECONDS_PER_DAY = 86400;

/**
 * Content inheritance: for rows where user != contract but ipfs_hash is empty,
 * copy content from the most recent earlier row with the same user + position.
 */
function applyContentInheritance(rows: BannerAdRow[]): void {
  // rows must be sorted ascending by time
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.user === CONTRACT_ACCOUNT) continue;
    if (row.ipfs_hash) continue;

    // Find the most recent earlier row with same user + position that has content
    for (let j = i - 1; j >= 0; j--) {
      const donor = rows[j];
      if (donor.user === row.user && donor.position === row.position && donor.ipfs_hash) {
        row.ipfs_hash = donor.ipfs_hash;
        row.website_url = donor.website_url || row.website_url;
        row.rental_type = donor.rental_type;
        row.shared_user = donor.shared_user || row.shared_user;
        row.shared_ipfs_hash = donor.shared_ipfs_hash || row.shared_ipfs_hash;
        row.shared_website_url = donor.shared_website_url || row.shared_website_url;
        break;
      }
    }
  }
}

async function fetchBannerAds(): Promise<ActiveBanner[]> {
  const result = await fetchTableRows<BannerAdRow>({
    code: CONTRACT_ACCOUNT,
    scope: CONTRACT_ACCOUNT,
    table: 'bannerads',
    limit: 100,
  });

  const nowSec = Math.floor(Date.now() / 1000);

  // Sort ascending by time for content inheritance
  const rows = [...result.rows].sort((a, b) => a.time - b.time);

  // Apply content inheritance before filtering
  applyContentInheritance(rows);

  // Filter to current 24h window
  const activeRows = rows.filter(row => {
    if (nowSec < row.time) return false;
    if (nowSec >= row.time + SECONDS_PER_DAY) return false;
    if (row.user === CONTRACT_ACCOUNT) return false;
    if (!row.ipfs_hash) return false;
    if (row.suspended === 1) return false;
    return true;
  });

  // Group by position, take the most recent row per position
  const byPosition = new Map<number, BannerAdRow>();
  for (const row of activeRows) {
    const existing = byPosition.get(row.position);
    if (!existing || row.time > existing.time) {
      byPosition.set(row.position, row);
    }
  }

  const banners: ActiveBanner[] = [];

  for (const [position, row] of byPosition) {
    const isShared = row.rental_type === 1;
    const rentalType = isShared ? 'shared' : 'exclusive';

    // Primary banner
    banners.push({
      time: row.time,
      position,
      user: row.user,
      ipfsHash: row.ipfs_hash,
      websiteUrl: row.website_url,
      rentalType,
      displayMode: isShared ? 'shared' : 'full',
    });

    // For shared rentals, emit secondary banner or placeholder
    if (isShared) {
      if (row.shared_user && row.shared_user !== CONTRACT_ACCOUNT && row.shared_ipfs_hash) {
        banners.push({
          time: row.time,
          position,
          user: row.shared_user,
          ipfsHash: row.shared_ipfs_hash,
          websiteUrl: row.shared_website_url,
          rentalType,
          displayMode: 'shared',
        });
      } else {
        // Half-rented: emit placeholder for the vacant shared half
        banners.push({
          time: row.time,
          position,
          user: '__placeholder__',
          ipfsHash: '',
          websiteUrl: 'https://cheesehubwax.github.io/cheesehub/bannerads',
          rentalType,
          displayMode: 'shared',
        });
      }
    }
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
