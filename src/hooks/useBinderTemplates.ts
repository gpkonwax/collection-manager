import { useState, useEffect, useCallback } from 'react';
import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { getIpfsUrl, extractIpfsHash } from '@/lib/ipfsGateways';
import { getGpkVariantRank, normalizeGpkVariant } from '@/lib/gpkVariant';

export interface BinderTemplate {
  templateId: string;
  name: string;
  image: string;
  cardid: string;
  quality: string;
  variant: string;
  schema: string;
}

function resolveImage(raw: string): string {
  if (!raw) return '/placeholder.svg';
  if (raw.startsWith('http')) return raw;
  const hash = extractIpfsHash(raw);
  if (hash) return getIpfsUrl(hash);
  if (raw.startsWith('Qm') || raw.startsWith('bafy') || raw.startsWith('bafk')) return getIpfsUrl(raw);
  return '/placeholder.svg';
}

const ALLOWED_SCHEMA_VARIANTS: Record<string, Set<string>> = {
  series1: new Set(['base', 'prism', 'sketch', 'collector', 'golden']),
  series2: new Set([
    'base', 'raw', 'prism', 'slime', 'gum', 'vhs', 'sketch',
    'tiger stripe', 'tiger claw',
    'returning', 'error', 'originalart', 'relic', 'promo',
    'collector', 'golden',
  ]),
};

// series2 binder also needs exotic schema templates (tiger stripe/claw live there)
const EXTRA_SCHEMAS: Record<string, string[]> = {
  series2: ['exotic'],
};

export function useBinderTemplates(schema: string | null) {
  const [templates, setTemplates] = useState<BinderTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!schema) { setTemplates([]); return; }
    setIsLoading(true);
    try {
      const schemasToFetch = [schema, ...(EXTRA_SCHEMAS[schema] || [])];
      const all: any[] = [];

      for (const s of schemasToFetch) {
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const params = new URLSearchParams({
            collection_name: 'gpk.topps',
            schema_name: s,
            limit: '100',
            page: String(page),
            order: 'asc',
            sort: 'created',
          });
          const path = `${ATOMIC_API.paths.templates}?${params}`;
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 15000);
          const json = await response.json();
          if (!json.success || !json.data) break;
          all.push(...json.data);
          hasMore = json.data.length === 100;
          page++;
        }
      }

      // Diagnostic: log exotic schema templates to verify cardids
      const exoticTemplates = all.filter((t: any) => (t.schema?.schema_name || '') === 'exotic');
      if (exoticTemplates.length > 0) {
        console.log('[BinderTemplates] Exotic schema templates sample:', exoticTemplates.slice(0, 5).map((t: any) => ({
          templateId: t.template_id,
          name: t.immutable_data?.name,
          cardid: t.immutable_data?.cardid,
          variant: t.immutable_data?.variant,
          quality: t.immutable_data?.quality,
          schema: t.schema?.schema_name,
        })));
      }

      const parsed: BinderTemplate[] = all.map((t: any) => {
        const data = t.immutable_data || {};
        return {
          templateId: t.template_id,
          name: data.name || t.name || `Template #${t.template_id}`,
          image: resolveImage(data.img || data.image || data.icon || ''),
          cardid: String(data.cardid ?? ''),
          quality: String(data.quality ?? '').toLowerCase(),
          variant: normalizeGpkVariant(data.variant),
          schema: t.schema?.schema_name || schema,
        };
      });

      const allowedVariants = ALLOWED_SCHEMA_VARIANTS[schema];
      const filteredParsed = allowedVariants
        ? parsed.filter((template) => allowedVariants.has(template.variant))
        : parsed;

      const seen = new Map<string, BinderTemplate>();
      for (const t of filteredParsed) {
        if (t.cardid) {
          const dedupeKey = `${t.cardid}:${t.quality}:${t.variant}`;
          if (!seen.has(dedupeKey)) {
            seen.set(dedupeKey, t);
          }
        } else {
          seen.set(`tid:${t.templateId}`, t);
        }
      }
      const deduped = Array.from(seen.values());

      // Sort: regular variants first (base, prism, sketch), then collector, then golden
      const isSpecial = (v: string) => v === 'collector' || v === 'golden';
      const specialRank = (v: string) => v === 'collector' ? 0 : v === 'golden' ? 1 : -1;
      deduped.sort((a, b) => {
        const aSpec = isSpecial(a.variant);
        const bSpec = isSpecial(b.variant);
        if (aSpec !== bSpec) return aSpec ? 1 : -1;
        if (aSpec && bSpec) {
          const sr = specialRank(a.variant) - specialRank(b.variant);
          if (sr !== 0) return sr;
        }
        const numA = parseInt(a.cardid, 10), numB = parseInt(b.cardid, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) return numA - numB;
          if (a.quality !== b.quality) return a.quality.localeCompare(b.quality);
          return getGpkVariantRank(a.variant) - getGpkVariantRank(b.variant);
        }
        return a.templateId.localeCompare(b.templateId);
      });

      setTemplates(deduped);
    } catch (err) {
      console.error('[BinderTemplates] Failed to fetch:', err);
    } finally {
      setIsLoading(false);
    }
  }, [schema]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  return { templates, isLoading };
}
