import { useState, useEffect, useCallback } from 'react';
import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { getIpfsUrl, extractIpfsHash } from '@/lib/ipfsGateways';

export type PackOpenMode = 'transfer' | 'unbox_nft';

export interface PackConfig {
  contract: string;
  cards: number;
  openMode: PackOpenMode;
  /** For unbox_nft mode: the contract to transfer to and call unbox on */
  transferTo?: string;
  transferMemo?: string;
  collectionName?: string;
  /** Temporarily disable opening this pack type */
  disabled?: boolean;
  disabledReason?: string;
}

export interface AtomicPack {
  templateId: string;
  name: string;
  image: string;
  description: string;
  count: number;
  assetIds: string[];
  mints: number[];
  unpackContract: string;
  cardsPerPack: number;
  openMode: PackOpenMode;
  packConfig: PackConfig;
}

interface AtomicAssetRaw {
  asset_id: string;
  template?: { template_id: string; immutable_data: Record<string, string> };
  template_mint?: string;
  data: Record<string, string>;
  name: string;
}

const PACK_CONFIG: Record<string, PackConfig> = {
  '13778':  { contract: 'gpkcrashpack', cards: 5, openMode: 'transfer', disabled: true, disabledReason: 'Oracle unreliable — opening temporarily disabled' },
  '48479':  { contract: 'burnieunpack', cards: 2, openMode: 'transfer', disabled: true, disabledReason: 'Opening temporarily disabled' },
  '51437':  { contract: 'burnieunpack', cards: 5, openMode: 'transfer', disabled: true, disabledReason: 'Opening temporarily disabled' },
  '53187':  { contract: 'atomicpacksx', cards: 3, openMode: 'transfer', disabled: true, disabledReason: 'Opening temporarily disabled' },
  '59072':  { contract: 'atomicpacksx', cards: 3, openMode: 'transfer' },
  '59489':  { contract: 'unbox.nft', cards: 3, openMode: 'unbox_nft', transferTo: 'unbox.nft', transferMemo: 'open pack', collectionName: 'gpk.topps' },
  '59490':  { contract: 'unbox.nft', cards: 3, openMode: 'unbox_nft', transferTo: 'unbox.nft', transferMemo: 'open pack', collectionName: 'gpk.topps' },
  '59491':  { contract: 'unbox.nft', cards: 3, openMode: 'unbox_nft', transferTo: 'unbox.nft', transferMemo: 'open pack', collectionName: 'gpk.topps' },
  '59492':  { contract: 'unbox.nft', cards: 3, openMode: 'unbox_nft', transferTo: 'unbox.nft', transferMemo: 'open pack', collectionName: 'gpk.topps' },
};

/** Fallback metadata for packs when user owns 0 (so we can still show the artwork) */
const PACK_DEFAULTS: Record<string, { name: string; image: string; description: string }> = {
  '13778':  { name: 'GPK Pack - Crash Gordon', image: 'Qmf3d8Dj1E5RM4nyqcQVw2s2adSxBUkuBc4FiDh76vVE5n', description: 'Contains 5 digital cards from the "Crash Gordon" series' },
  '48479':  { name: 'Bernventures Pack', image: 'QmZFv6fGryvQsU2k1dDY5fkJNvTakKxBwDyj8RDfEEmTvj', description: 'Bernventures Pack' },
  '51437':  { name: 'Mitten Pack', image: 'QmTMWkmXo5o3ddn9XZ15zuh9Gz9LJDpDoox48crJkj8Mnp', description: 'Mitten Pack' },
  '53187':  { name: 'GameStonk! Pack', image: 'QmUkRt94GkTDUa2tTgTCDAm7xne2xYTpzSQizw5mJPf61y/back.jpg', description: 'GameStonk! Pack' },
  '59072':  { name: 'Food Fight! Pack', image: 'QmYiXshxX23h4J68Z8HUGVbVZmCwrrjEi3TKA41jW6hcSH/pack.png', description: 'Food Fight! Pack' },
  '59489':  { name: 'Food Fight! WinterCon Day 1', image: 'QmUt1n6b5re5FhuP7dFj73BS57MGNBYPP3uZeTnvYDtiyN/FoodFightPackArt_WinterCon.png', description: 'WinterCon 2021 Day 1 Pack' },
  '59490':  { name: 'Food Fight! WinterCon Day 2', image: 'QmUt1n6b5re5FhuP7dFj73BS57MGNBYPP3uZeTnvYDtiyN/FoodFightPackArt_WinterCon.png', description: 'WinterCon 2021 Day 2 Pack' },
  '59491':  { name: 'Food Fight! WinterCon Day 3', image: 'QmUt1n6b5re5FhuP7dFj73BS57MGNBYPP3uZeTnvYDtiyN/FoodFightPackArt_WinterCon.png', description: 'WinterCon 2021 Day 3 Pack' },
  '59492':  { name: 'Food Fight! WinterCon Day 4', image: 'QmUt1n6b5re5FhuP7dFj73BS57MGNBYPP3uZeTnvYDtiyN/FoodFightPackArt_WinterCon.png', description: 'WinterCon 2021 Day 4 Pack' },
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
        const mints = assets.map((a) => parseInt(a.template_mint || '0', 10));
        // Sort by mint number and keep assetIds in sync
        const sorted = assets.map((a, i) => ({ asset: a, mint: mints[i] })).sort((a, b) => a.mint - b.mint);
        result.push({
          templateId: tid,
          name: combined.name || `Pack #${tid}`,
          image: resolveImage(combined.img || combined.image),
          description: combined.description || '',
          count: sorted.length,
          assetIds: sorted.map((s) => s.asset.asset_id),
          mints: sorted.map((s) => s.mint),
          unpackContract: config.contract,
          cardsPerPack: config.cards,
          openMode: config.openMode,
          packConfig: config,
        });
      }

      // Add placeholder entries for packs the user doesn't own (count: 0)
      for (const [tid, config] of Object.entries(PACK_CONFIG)) {
        if (grouped.has(tid)) continue;
        const defaults = PACK_DEFAULTS[tid];
        result.push({
          templateId: tid,
          name: defaults?.name || `Pack #${tid}`,
          image: defaults ? resolveImage(defaults.image) : '/placeholder.svg',
          description: defaults?.description || '',
          count: 0,
          assetIds: [],
          mints: [],
          unpackContract: config.contract,
          cardsPerPack: config.cards,
          openMode: config.openMode,
          packConfig: config,
        });
      }

      // Custom sort order matching unified pack display
      const SORT_ORDER: Record<string, number> = {
        '48479': 1,   // Bernventures
        '53187': 2,   // GameStonk
        '13778': 3,   // Crash Gordon
        '59072': 4,   // Food Fight! Pack
        '59489': 5,   // Food Fight! WinterCon Day 1
        '59490': 6,   // Food Fight! WinterCon Day 2
        '59491': 7,   // Food Fight! WinterCon Day 3
        '59492': 8,   // Food Fight! WinterCon Day 4
        '51437': 9,   // Mittens
      };
      result.sort((a, b) => {
        const orderA = SORT_ORDER[a.templateId] ?? 999;
        const orderB = SORT_ORDER[b.templateId] ?? 999;
        return orderA - orderB || a.name.localeCompare(b.name);
      });

      setPacks(result);
    } catch (e) {
      console.warn('[GpkAtomicPacks] Fetch failed:', e);
      setPacks([]);
    } finally { setIsLoading(false); }
  }, [accountName]);

  useEffect(() => { fetchPacks(); }, [fetchPacks]);
  return { packs, isLoading, refetch: fetchPacks };
}
