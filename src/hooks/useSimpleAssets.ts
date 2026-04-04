import { useState, useEffect, useCallback } from 'react';
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { getIpfsUrl, extractIpfsHash } from '@/lib/ipfsGateways';
import { getGpkVariantRank, normalizeGpkVariant } from '@/lib/gpkVariant';

export interface SimpleAsset {
  id: string;
  owner: string;
  author: string;
  category: string;
  name: string;
  image: string;
  images: string[];
  cardid: string;
  quality: string;
  idata: Record<string, unknown>;
  mdata: Record<string, unknown>;
  container: unknown[];
  containerf: unknown[];
  source: 'simpleassets' | 'atomicassets';
}

interface RawSAsset {
  id: string;
  owner: string;
  author: string;
  category: string;
  idata: string;
  mdata: string;
  container: unknown[];
  containerf: unknown[];
}

function parseJsonSafe(str: string): Record<string, unknown> {
  try { return JSON.parse(str) || {}; } catch { return {}; }
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

function resolveAllImages(data: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const key of FRONT_KEYS) {
    const raw = data[key] as string | undefined;
    if (raw) { const url = resolveRawImage(raw); if (url && !seen.has(url)) { seen.add(url); urls.push(url); } }
  }
  for (const key of BACK_KEYS) {
    const raw = data[key] as string | undefined;
    if (raw) { const url = resolveRawImage(raw); if (url && !seen.has(url)) { seen.add(url); urls.push(url); } }
  }
  return urls.length > 0 ? urls : ['/placeholder.svg'];
}

export function useSimpleAssets(account: string | null) {
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!account) { setAssets([]); return; }
    setIsLoading(true);
    setError(null);
    try {
      const allRows: RawSAsset[] = [];
      let lowerBound = '';
      let hasMore = true;
      while (hasMore) {
        const result = await fetchTableRows<RawSAsset>({
          code: 'simpleassets', scope: account, table: 'sassets',
          limit: 100, lower_bound: lowerBound || undefined,
        });
        allRows.push(...result.rows);
        hasMore = result.more;
        if (hasMore && result.rows.length > 0) {
          const lastId = result.rows[result.rows.length - 1].id;
          lowerBound = String(BigInt(lastId) + 1n);
        }
      }
      const parsed: SimpleAsset[] = allRows
        .filter((row) => row.author === 'gpk.topps')
        .map((row) => {
          const idata = parseJsonSafe(row.idata);
          const mdata = parseJsonSafe(row.mdata);
          const combined = { ...idata, ...mdata };
          const name = (combined.name as string) || `Asset #${row.id}`;
          const images = resolveAllImages(combined);
          return {
            id: row.id, owner: row.owner, author: row.author, category: row.category,
            name, image: images[0], images,
            cardid: String(combined.cardid ?? ''),
            quality: normalizeGpkVariant(combined.variant, combined.quality),
            idata, mdata,
            container: row.container || [], containerf: row.containerf || [],
            source: 'simpleassets' as const,
          };
        });
      parsed.sort((a, b) => {
        const numA = parseInt(a.cardid, 10), numB = parseInt(b.cardid, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) return numA - numB;
          return getGpkVariantRank(a.quality) - getGpkVariantRank(b.quality);
        }
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        return Number(BigInt(a.id) - BigInt(b.id));
      });
      setAssets(parsed);
    } catch (err) {
      console.error('[SimpleAssets] Failed to fetch:', err);
      setError((err as Error).message);
    } finally { setIsLoading(false); }
  }, [account]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);
  return { assets, isLoading, error, refetch: fetchAssets };
}
