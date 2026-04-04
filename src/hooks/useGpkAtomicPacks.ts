import { useState, useEffect, useCallback } from 'react';
import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { getIpfsUrl, extractIpfsHash } from '@/lib/ipfsGateways';

export interface AtomicPack {
  templateId: string;
  name: string;
  image: string;
  description: string;
  count: number;
  assetIds: string[];
  unpackContract: string;
  cardsPerPack: number;
}

interface AtomicAssetRaw {
  asset_id: string;
  template?: { template_id: string; immutable_data: Record<string, string> };
  data: Record<string, string>;
  name: string;
}

const PACK_CONFIG: Record<string, { contract: string; cards: number }> = {
  '13778':  { contract: 'gpkcrashpack', cards: 5 },
  '48479':  { contract: 'burnieunpack', cards: 2 },
  '51437':  { contract: 'burnieunpack', cards: 5 },
  '53187':  { contract: 'burnieunpack', cards: 5 },
  '59072':  { contract: 'burnieunpack', cards: 3 },
  '59489':  { contract: 'burnieunpack', cards: 3 },
  '59490':  { contract: 'burnieunpack', cards: 3 },
  '59491':  { contract: 'burnieunpack', cards: 3 },
  '59492':  { contract: 'burnieunpack', cards: 3 },
};

function resolveImage(raw: string | undefined): string {
  if (!raw) return '/placeholder.svg';
  if (raw.startsWith('http')) return raw;
  const hash = extractIpfsHash(raw);
  if (hash) return getIpfsUrl(hash);
  if (raw.startsWith('Qm') || raw.startsWith('bafy') || raw.startsWith('bafk')) return getIpfsUrl(raw);
  return raw || '/placeholder.svg';
}

export function useGpkAtomicPacks(accountName: string | null) {
  const [packs, setPacks] = useState<AtomicPack[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPacks = useCallback(async () => {
    if (!accountName) { setPacks([]); return; }
    setIsLoading(true);
    try {
      const allAssets: AtomicAssetRaw[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams({
          owner: accountName, collection_name: 'gpk.topps',
          schema_name: 'packs', limit: '100', page: String(page),
        });
        const path = `${ATOMIC_API.paths.assets}?${params}`;
        const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 15000);
        const json = await response.json();
        if (!json.success || !json.data) break;
        allAssets.push(...json.data);
        hasMore = json.data.length === 100;
        page++;
      }
      const grouped = new Map<string, { assets: AtomicAssetRaw[]; template: AtomicAssetRaw['template'] }>();
      for (const asset of allAssets) {
        const tid = asset.template?.template_id;
        if (!tid || !PACK_CONFIG[tid]) continue;
        const existing = grouped.get(tid);
        if (existing) { existing.assets.push(asset); }
        else { grouped.set(tid, { assets: [asset], template: asset.template }); }
      }
      const result: AtomicPack[] = [];
      for (const [tid, { assets, template }] of grouped) {
        const config = PACK_CONFIG[tid];
        if (!config) continue;
        const idata = template?.immutable_data || {};
        const data = assets[0]?.data || {};
        const combined = { ...idata, ...data };
        result.push({
          templateId: tid,
          name: combined.name || `Pack #${tid}`,
          image: resolveImage(combined.img || combined.image),
          description: combined.description || '',
          count: assets.length,
          assetIds: assets.map((a) => a.asset_id),
          unpackContract: config.contract,
          cardsPerPack: config.cards,
        });
      }
      setPacks(result);
    } catch (e) {
      console.warn('[GpkAtomicPacks] Fetch failed:', e);
      setPacks([]);
    } finally { setIsLoading(false); }
  }, [accountName]);

  useEffect(() => { fetchPacks(); }, [fetchPacks]);
  return { packs, isLoading, refetch: fetchPacks };
}
