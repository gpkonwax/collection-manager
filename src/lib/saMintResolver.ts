import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';

/**
 * GPK cards on AtomicAssets are bridged 1:1 from the original SimpleAssets
 * contract. Each bridged AA asset carries the original SA id in the schema
 * field `sassets_id`. The `template_mint` returned by the AA API is the
 * *bridge order*, not the card's original mint number.
 *
 * To recover the real SA mint number for a bridged asset, we fetch every
 * asset for its template, sort them ascending by `sassets_id` (lower =
 * earlier SA mint), and take the 1-based position of the target asset.
 *
 * This mirrors the behavior AtomicHub adopted on 2026-07-09.
 */

interface AssetLite {
  asset_id: string;
  immutable_data?: Record<string, string>;
  data?: Record<string, string>;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const CACHE_KEY_PREFIX = 'gpk_sa_mint_v1_';

interface TemplateMintMap {
  /** asset_id -> 1-based SA mint number */
  positions: Record<string, number>;
  /** total number of bridged assets for this template */
  total: number;
}

const memory = new Map<string, { ts: number; data: TemplateMintMap }>();
const inflight = new Map<string, Promise<TemplateMintMap | null>>();

function loadFromSession(templateId: string): TemplateMintMap | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + templateId);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY_PREFIX + templateId);
      return null;
    }
    return data as TemplateMintMap;
  } catch {
    return null;
  }
}

function saveToSession(templateId: string, data: TemplateMintMap) {
  try {
    sessionStorage.setItem(
      CACHE_KEY_PREFIX + templateId,
      JSON.stringify({ ts: Date.now(), data }),
    );
  } catch {
    // quota exceeded; memory cache still applies
  }
}

async function fetchTemplateAssets(templateId: string): Promise<AssetLite[]> {
  const all: AssetLite[] = [];
  let page = 1;
  const limit = 1000;
  // Cap at 20 pages (20k assets) as a safety net — GPK templates are far smaller.
  while (page <= 20) {
    const params = new URLSearchParams({
      collection_name: 'gpk.topps',
      template_id: templateId,
      limit: String(limit),
      page: String(page),
      order: 'asc',
      sort: 'asset_id',
    });
    const path = `${ATOMIC_API.paths.assets}?${params}`;
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 15000);
    const json = await response.json();
    if (!json.success || !Array.isArray(json.data)) break;
    all.push(...json.data);
    if (json.data.length < limit) break;
    page++;
  }
  return all;
}

/**
 * Resolve the SA mint map for a single template. Returns null if the
 * template's assets carry no `sassets_id` (native AA, not bridged).
 */
export async function resolveSaMintForTemplate(
  templateId: string,
): Promise<TemplateMintMap | null> {
  if (!templateId) return null;

  // 1. Memory
  const mem = memory.get(templateId);
  if (mem && Date.now() - mem.ts < CACHE_TTL) return mem.data;

  // 2. Session storage
  const session = loadFromSession(templateId);
  if (session) {
    memory.set(templateId, { ts: Date.now(), data: session });
    return session;
  }

  // 3. Deduplicated fetch
  const existing = inflight.get(templateId);
  if (existing) return existing;

  const promise = (async (): Promise<TemplateMintMap | null> => {
    try {
      const assets = await fetchTemplateAssets(templateId);
      if (assets.length === 0) return null;

      const withSassetsId = assets
        .map((a) => {
          const raw = a.immutable_data?.sassets_id ?? a.data?.sassets_id ?? '';
          if (!raw) return null;
          try {
            return { asset_id: a.asset_id, sassets_id: BigInt(String(raw)) };
          } catch {
            return null;
          }
        })
        .filter((x): x is { asset_id: string; sassets_id: bigint } => x !== null);

      // No sassets_id at all → not a bridged template, keep AA mint order.
      if (withSassetsId.length === 0) return null;

      withSassetsId.sort((a, b) => (a.sassets_id < b.sassets_id ? -1 : a.sassets_id > b.sassets_id ? 1 : 0));

      const positions: Record<string, number> = {};
      withSassetsId.forEach((item, idx) => {
        positions[item.asset_id] = idx + 1;
      });

      const data: TemplateMintMap = { positions, total: withSassetsId.length };
      memory.set(templateId, { ts: Date.now(), data });
      saveToSession(templateId, data);
      return data;
    } catch (err) {
      console.warn(`[saMintResolver] Failed to resolve template ${templateId}:`, err);
      return null;
    } finally {
      inflight.delete(templateId);
    }
  })();

  inflight.set(templateId, promise);
  return promise;
}

/**
 * Resolve SA mint maps for many templates in parallel, with bounded concurrency.
 */
export async function resolveSaMintForTemplates(
  templateIds: string[],
  concurrency = 5,
): Promise<Map<string, TemplateMintMap>> {
  const unique = Array.from(new Set(templateIds.filter(Boolean)));
  const result = new Map<string, TemplateMintMap>();
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      const idx = cursor++;
      const tid = unique[idx];
      const map = await resolveSaMintForTemplate(tid);
      if (map) result.set(tid, map);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, () => worker());
  await Promise.all(workers);
  return result;
}
