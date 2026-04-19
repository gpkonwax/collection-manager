import { useState, useEffect, useCallback } from 'react';
import { getIpfsUrl, extractIpfsHash } from '@/lib/ipfsGateways';
import { getGpkVariantRank, normalizeGpkVariant } from '@/lib/gpkVariant';
import { getTemplatesBySchema } from '@/lib/templateDataCache';

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
    'returning', 'error', 'originalart', 'relic', 'promo',
    'collector', 'golden',
  ]),
};

const EXTRA_SCHEMAS: Record<string, string[]> = {};

function getNumericCardId(cardid: string): number | null {
  const normalized = cardid.trim();
  if (!/^\d+$/.test(normalized)) return null;
  return Number.parseInt(normalized, 10);
}

function getBinderSideRank(side: string): number {
  const normalized = side.trim().toLowerCase();
  if (!normalized) return 0;
  if (/^[a-z]$/.test(normalized)) return normalized.charCodeAt(0) - 96;
  const numeric = Number.parseInt(normalized, 10);
  return Number.isNaN(numeric) ? Number.MAX_SAFE_INTEGER : numeric;
}

export function useBinderTemplates(schema: string | null) {
  const [templates, setTemplates] = useState<BinderTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!schema) { setTemplates([]); return; }
    setIsLoading(true);
    try {
      const schemasToFetch = [schema, ...(EXTRA_SCHEMAS[schema] || [])];
      const allRaw: any[] = [];

      for (const s of schemasToFetch) {
        const cached = await getTemplatesBySchema(s);
        allRaw.push(...cached);
      }

      const parsed: BinderTemplate[] = allRaw.map((t: any) => {
        const data = t.immutable_data || {};
        return {
          templateId: t.template_id,
          name: data.name || `Template #${t.template_id}`,
          image: resolveImage(data.img || data.image || data.icon || ''),
          cardid: String(data.cardid ?? ''),
          quality: String(data.quality ?? '').toLowerCase(),
          variant: normalizeGpkVariant(data.variant),
          schema: t.schema_name || schema,
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

        const numA = getNumericCardId(a.cardid);
        const numB = getNumericCardId(b.cardid);
        if (numA !== null && numB !== null && numA !== numB) return numA - numB;
        if (numA !== null && numB === null) return -1;
        if (numA === null && numB !== null) return 1;

        const sideRankDiff = getBinderSideRank(a.quality) - getBinderSideRank(b.quality);
        if (sideRankDiff !== 0) return sideRankDiff;

        const variantRankDiff = getGpkVariantRank(a.variant) - getGpkVariantRank(b.variant);
        if (variantRankDiff !== 0) return variantRankDiff;

        const nameDiff = a.name.localeCompare(b.name);
        if (nameDiff !== 0) return nameDiff;

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
