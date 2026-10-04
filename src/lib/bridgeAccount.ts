import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';

// Account that received the AtomicAssets copy when a card was bridged, read
// from the asset's `logmint` log (the current owner changes after trades).
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();
const WAX_ACCOUNT = /^[a-z1-5.]{1,12}$/;

interface AssetLog { name?: string; data?: { new_asset_owner?: unknown } }

export function getCachedBridgeAccount(assetId: string): string | null | undefined {
  return cache.get(assetId);
}

export function fetchBridgeAccount(assetId: string): Promise<string | null> {
  if (!/^\d+$/.test(assetId)) return Promise.resolve(null);
  if (cache.has(assetId)) return Promise.resolve(cache.get(assetId) ?? null);
  const pending = inflight.get(assetId);
  if (pending) return pending;
  const path = `${ATOMIC_API.paths.assets}/${assetId}/logs?action_whitelist=logmint&page=1&limit=10&order=asc`;
  const request = fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 8000)
    .then((res) => res.json())
    .then((json: { success?: boolean; data?: AssetLog[] }) => {
      if (!json?.success || !Array.isArray(json.data)) throw new Error('Invalid logs response');
      const mint = json.data.find((log) => log?.name === 'logmint');
      const owner = mint?.data?.new_asset_owner;
      const account = typeof owner === 'string' && WAX_ACCOUNT.test(owner) ? owner : null;
      cache.set(assetId, account); // only definitive answers are cached
      return account;
    })
    .finally(() => inflight.delete(assetId));
  inflight.set(assetId, request);
  return request;
}
