import { useState, useEffect, useCallback } from 'react';
import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { getIpfsUrl, extractIpfsHash } from '@/lib/ipfsGateways';
import { getGpkVariantRank, normalizeGpkVariant } from '@/lib/gpkVariant';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface AtomicAssetRaw {
  asset_id: string;
  owner: string;
  collection: { collection_name: string };
  schema: { schema_name: string };
  template?: {
    template_id: string;
    immutable_data?: Record<string, string>;
    max_supply?: string;
    issued_supply?: string;
  };
  template_mint?: string;
  immutable_data: Record<string, string>;
  mutable_data: Record<string, string>;
  data: Record<string, string>;
  name: string;
}

function resolveRawImage(raw: string): string | null {
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  const hash = extractIpfsHash(raw);
  if (hash) return getIpfsUrl(hash);
  if (raw.startsWith('Qm') || raw.startsWith('bafy') || raw.startsWith('bafk')) return getIpfsUrl(raw);
  return raw || null;
}

const FRONT_KEYS = ['img', 'image', 'icon'];
const BACK_KEYS = ['backimg', 'back', 'img2', 'image2', 'backimage'];

function resolveAllImages(data: Record<string, string>): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const key of FRONT_KEYS) {
    const raw = data[key];
    if (raw) { const url = resolveRawImage(raw); if (url && !seen.has(url)) { seen.add(url); urls.push(url); } }
  }
  for (const key of BACK_KEYS) {
    const raw = data[key];
    if (raw) { const url = resolveRawImage(raw); if (url && !seen.has(url)) { seen.add(url); urls.push(url); } }
  }
  return urls.length > 0 ? urls : [`${import.meta.env.BASE_URL}card-fallback.svg`];
}

export function useGpkAtomicAssets(account: string | null) {
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!account) { setAssets([]); return; }
    setIsLoading(true);
    setError(null);
    try {
      const allAssets: AtomicAssetRaw[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams({
          owner: account, collection_name: 'gpk.topps',
          limit: '100', page: String(page), order: 'asc', sort: 'asset_id',
        });
        const path = `${ATOMIC_API.paths.assets}?${params}`;
        const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 15000);
        const json = await response.json();
        if (!json.success || !json.data) break;
        allAssets.push(...json.data);
        hasMore = json.data.length === 100;
        page++;
      }
      const parsed: SimpleAsset[] = allAssets.map((raw) => {
        const templateData = raw.template?.immutable_data || {};
        const combined = { ...templateData, ...raw.immutable_data, ...raw.mutable_data, ...raw.data };
        const name = combined.name || raw.name || `Asset #${raw.asset_id}`;
        const images = resolveAllImages(combined);
        const schemaName = raw.schema?.schema_name || '';
        return {
          id: raw.asset_id, owner: raw.owner, author: 'gpk.topps',
          category: schemaName,
          name, image: images[0], images,
          cardid: String(combined.cardid ?? ''),
          quality: normalizeGpkVariant(combined.variant),
          side: String(combined.quality ?? '').toLowerCase(),
          idata: { ...templateData, ...raw.immutable_data, _template_id: raw.template?.template_id || '', mint: raw.template_mint || '', maxsupply: raw.template?.issued_supply || '' } as Record<string, unknown>,
          mdata: raw.mutable_data as Record<string, unknown>,
          container: [], containerf: [],
          source: 'atomicassets' as const,
        };
      });
      parsed.sort((a, b) => {
        const numA = parseInt(a.cardid, 10), numB = parseInt(b.cardid, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB;
          const sideA = a.side || '', sideB = b.side || '';
          if (sideA !== sideB) return sideA.localeCompare(sideB);
          return getGpkVariantRank(a.quality) - getGpkVariantRank(b.quality);
        }
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        return Number(BigInt(a.id) - BigInt(b.id));
      });
      setAssets(parsed);
    } catch (err) {
      console.error('[GpkAtomicAssets] Failed to fetch:', err);
      setError((err as Error).message);
    } finally { setIsLoading(false); }
  }, [account]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);
  return { assets, isLoading, error, refetch: fetchAssets };
}
