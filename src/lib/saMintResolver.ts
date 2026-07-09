/**
 * Resolves the true original SimpleAssets mint number and total for bridged
 * GPK AtomicAssets, using AtomicHub's own endpoint (the same one their explorer
 * calls):
 *
 *   GET https://nft-data.api.atomichub.io/v1/simpleassets/mints?asset_ids=<sa_id,...>
 *   -> { success, data: [{ asset_id, mint, total, burned }] }
 *
 * `asset_id` in the response is the ORIGINAL SimpleAssets id (`sassets_id`
 * carried in the bridged AA immutable_data), not the AA asset_id. We join back
 * to AA asset_id via that field.
 */
const ENDPOINT = 'https://nft-data.api.atomichub.io/v1/simpleassets/mints';
const CACHE_TTL = 30 * 60 * 1000;
const CACHE_KEY_PREFIX = 'gpk_sa_mint_v2_';
const BATCH_SIZE = 100;
const CONCURRENCY = 3;

export interface SaMintInfo {
  mint: number;
  total: number;
  burned: number;
}

interface CacheEntry { ts: number; data: SaMintInfo }

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<SaMintInfo | null>>();

function readSession(saId: string): SaMintInfo | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + saId);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw) as CacheEntry;
    if (Date.now() - ts > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY_PREFIX + saId);
      return null;
    }
    return data;
  } catch { return null; }
}

function writeSession(saId: string, data: SaMintInfo) {
  try {
    sessionStorage.setItem(CACHE_KEY_PREFIX + saId, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota */ }
}

async function fetchBatch(saIds: string[]): Promise<Record<string, SaMintInfo>> {
  const url = `${ENDPOINT}?asset_ids=${saIds.join(',')}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.success || !Array.isArray(json.data)) return {};
    const out: Record<string, SaMintInfo> = {};
    for (const row of json.data) {
      if (!row?.asset_id) continue;
      const info: SaMintInfo = {
        mint: Number(row.mint),
        total: Number(row.total),
        burned: Number(row.burned ?? 0),
      };
      if (!Number.isFinite(info.mint) || !Number.isFinite(info.total)) continue;
      out[String(row.asset_id)] = info;
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve SA mint info for a list of AA assets, each identified by its AA
 * asset_id + original sassets_id. Returns a map keyed by AA asset_id.
 */
export async function resolveSaMintsForAssets(
  assets: { assetId: string; sassetsId: string }[],
): Promise<Map<string, SaMintInfo>> {
  const result = new Map<string, SaMintInfo>();
  if (assets.length === 0) return result;

  // Dedupe sassets_id → collect AA asset_ids that share it (should be 1:1).
  const saToAssetIds = new Map<string, string[]>();
  for (const a of assets) {
    if (!a.sassetsId) continue;
    const list = saToAssetIds.get(a.sassetsId) ?? [];
    list.push(a.assetId);
    saToAssetIds.set(a.sassetsId, list);
  }

  const need: string[] = [];
  for (const saId of saToAssetIds.keys()) {
    // memory
    const mem = memory.get(saId);
    if (mem && Date.now() - mem.ts < CACHE_TTL) {
      for (const aid of saToAssetIds.get(saId)!) result.set(aid, mem.data);
      continue;
    }
    // session
    const sess = readSession(saId);
    if (sess) {
      memory.set(saId, { ts: Date.now(), data: sess });
      for (const aid of saToAssetIds.get(saId)!) result.set(aid, sess);
      continue;
    }
    need.push(saId);
  }

  if (need.length === 0) return result;

  // Batch
  const batches: string[][] = [];
  for (let i = 0; i < need.length; i += BATCH_SIZE) {
    batches.push(need.slice(i, i + BATCH_SIZE));
  }

  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const idx = cursor++;
      const batch = batches[idx];
      const key = batch.join(',');
      let promise = inflight.get(key);
      if (!promise) {
        promise = (async () => {
          try {
            const rows = await fetchBatch(batch);
            for (const saId of batch) {
              const info = rows[saId];
              if (!info) continue;
              memory.set(saId, { ts: Date.now(), data: info });
              writeSession(saId, info);
            }
            return null;
          } catch (err) {
            console.warn('[saMintResolver] batch failed:', err);
            return null;
          } finally {
            inflight.delete(key);
          }
        })();
        inflight.set(key, promise);
      }
      await promise;
      // fill result from memory
      for (const saId of batch) {
        const mem = memory.get(saId);
        if (!mem) continue;
        for (const aid of saToAssetIds.get(saId) ?? []) result.set(aid, mem.data);
      }
    }
  }
  const workers = Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker());
  await Promise.all(workers);
  return result;
}
