import { useState, useEffect, useMemo } from 'react';
import { normalizeGpkVariant } from '@/lib/gpkVariant';
import { getAllTemplates } from '@/lib/templateDataCache';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import type { GpkPack } from '@/hooks/useGpkPacks';
import type { AtomicPack } from '@/hooks/useGpkAtomicPacks';

export interface CompletionEntry {
  owned: number;
  total: number;
  percent: number;
}

// Schemas to count per category
const CATEGORY_SCHEMAS: Record<string, string[]> = {
  series1: ['series1'],
  series2: ['series2'],
  exotic: ['exotic'],
  crashgordon: ['crashgordon'],
  bernventures: ['bernventures'],
  mittens: ['mittens'],
  gamestonk: ['gamestonk'],
  foodfightb: ['foodfightb'],
  bonus: ['bonus'],
  originalart: ['originalart'],
  promo: ['promo'],
};

// Allowed variants per schema (same as binder filtering)
const ALLOWED_SCHEMA_VARIANTS: Record<string, Set<string>> = {
  series1: new Set(['base', 'prism', 'sketch', 'collector', 'golden']),
  series2: new Set([
    'base', 'raw', 'prism', 'slime', 'gum', 'vhs', 'sketch',
    'returning', 'error', 'originalart', 'relic', 'promo',
    'collector', 'golden',
  ]),
};

// SA pack symbols per category
const SA_PACK_CATEGORIES: Record<string, string[]> = {
  series1: ['GPKFIVE', 'GPKMEGA'],
  series2: ['GPKTWOA', 'GPKTWOB', 'GPKTWOC'],
  exotic: ['EXOFIVE', 'EXOMEGA'],
};

// AA pack template IDs per category
const AA_PACK_CATEGORIES: Record<string, string[]> = {
  crashgordon: ['13778'],
  bernventures: ['48479'],
  mittens: ['51437'],
  gamestonk: ['53187'],
  foodfightb: ['59072', '59489', '59490', '59491', '59492'],
};

// Schema mapping for user assets (legacy schema names)
const SCHEMA_TO_CATEGORY: Record<string, string> = {
  exotic: 'exotic',
  five: 'series1',
};

async function fetchTemplateTotals(): Promise<Record<string, number>> {
  const allTemplates = await getAllTemplates();
  const totals: Record<string, number> = {};

  for (const [category, schemas] of Object.entries(CATEGORY_SCHEMAS)) {
    let count = 0;
    const allowedVariants = ALLOWED_SCHEMA_VARIANTS[category];
    const schemaSet = new Set(schemas);

    for (const t of allTemplates) {
      if (!schemaSet.has(t.schema_name)) continue;
      const variant = normalizeGpkVariant(t.immutable_data.variant);
      if (allowedVariants && !allowedVariants.has(variant)) continue;
      count++;
    }

    totals[category] = count;
  }

  return totals;
}

export function useCollectionCompletion(
  assets: SimpleAsset[],
  packs: GpkPack[],
  atomicPacks: AtomicPack[],
  accountName: string | null
) {
  const [templateTotals, setTemplateTotals] = useState<Record<string, number>>({});
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsFetching(true);
    fetchTemplateTotals().then((totals) => {
      if (!cancelled) {
        setTemplateTotals(totals);
        setIsFetching(false);
      }
    }).catch(() => {
      if (!cancelled) setIsFetching(false);
    });
    return () => { cancelled = true; };
  }, []);

  const completion = useMemo<Record<string, CompletionEntry>>(() => {
    if (!accountName || Object.keys(templateTotals).length === 0) return {};

    const ownedPerCategory: Record<string, Set<string>> = {};
    for (const cat of Object.keys(CATEGORY_SCHEMAS)) {
      ownedPerCategory[cat] = new Set();
    }

    for (const asset of assets) {
      const cat = SCHEMA_TO_CATEGORY[asset.category] || asset.category;
      if (!ownedPerCategory[cat]) continue;
      const templateId = (asset.idata as Record<string, unknown>)?._template_id as string;
      const key = templateId
        ? `tid:${templateId}`
        : `${asset.cardid}:${asset.side}:${asset.quality}`;
      ownedPerCategory[cat].add(key);
    }

    const result: Record<string, CompletionEntry> = {};
    let overallOwned = 0;
    let overallTotal = 0;

    for (const [cat, totalTemplates] of Object.entries(templateTotals)) {
      const ownedCards = ownedPerCategory[cat]?.size ?? 0;

      const saPackSymbols = SA_PACK_CATEGORIES[cat] || [];
      const aaPackTemplates = AA_PACK_CATEGORIES[cat] || [];
      const totalPacks = saPackSymbols.length + aaPackTemplates.length;

      let ownedPacks = 0;
      for (const sym of saPackSymbols) {
        const pack = packs.find((p) => p.symbol === sym);
        if (pack && pack.amount > 0) ownedPacks++;
      }
      for (const tid of aaPackTemplates) {
        const pack = atomicPacks.find((p) => p.templateId === tid);
        if (pack && pack.count > 0) ownedPacks++;
      }

      const total = totalTemplates + totalPacks;
      const owned = Math.min(ownedCards + ownedPacks, total);
      const percent = total > 0 ? Math.round((owned / total) * 100) : 0;

      result[cat] = { owned, total, percent };
      overallOwned += owned;
      overallTotal += total;
    }

    result.overall = {
      owned: overallOwned,
      total: overallTotal,
      percent: overallTotal > 0 ? Math.round((overallOwned / overallTotal) * 100) : 0,
    };

    return result;
  }, [assets, packs, atomicPacks, accountName, templateTotals]);

  return { completion, isFetching };
}
