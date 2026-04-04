import { useState, useEffect, useCallback } from 'react';
import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { getIpfsUrl, extractIpfsHash } from '@/lib/ipfsGateways';

export interface BinderTemplate {
  templateId: string;
  name: string;
  image: string;
  cardid: string;
  quality: string;
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

export function useBinderTemplates(schema: string | null) {
  const [templates, setTemplates] = useState<BinderTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!schema) { setTemplates([]); return; }
    setIsLoading(true);
    try {
      const all: any[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams({
          collection_name: 'gpk.topps',
          schema_name: schema,
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

      const parsed: BinderTemplate[] = all.map((t: any) => {
        const data = t.immutable_data || {};
        return {
          templateId: t.template_id,
          name: data.name || t.name || `Template #${t.template_id}`,
          image: resolveImage(data.img || data.image || data.icon || ''),
          cardid: data.cardid || '',
          quality: data.quality || '',
          schema: t.schema?.schema_name || schema,
        };
      });

      // Deduplicate by cardid:quality – keep only the first (newest) template per combo
      const seen = new Map<string, BinderTemplate>();
      for (const t of parsed) {
        if (t.cardid) {
          const dedupeKey = `${t.cardid}:${t.quality.toLowerCase()}`;
          if (!seen.has(dedupeKey)) {
            seen.set(dedupeKey, t);
          }
        } else {
          // No cardid – keep by templateId
          seen.set(`tid:${t.templateId}`, t);
        }
      }
      const deduped = Array.from(seen.values());

      // Sort by cardid then quality, gold always last
      const variantOrder = ['base', 'prism', 'sketch', 'collector'];
      const isGold = (q: string) => q === 'golden' || q === 'gold';
      deduped.sort((a, b) => {
        const aGold = isGold(a.quality.toLowerCase());
        const bGold = isGold(b.quality.toLowerCase());
        if (aGold !== bGold) return aGold ? 1 : -1;
        const numA = parseInt(a.cardid, 10), numB = parseInt(b.cardid, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) return numA - numB;
          const rankA = variantOrder.indexOf(a.quality.toLowerCase());
          const rankB = variantOrder.indexOf(b.quality.toLowerCase());
          return (rankA === -1 ? 99 : rankA) - (rankB === -1 ? 99 : rankB);
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
