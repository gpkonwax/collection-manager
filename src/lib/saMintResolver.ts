/**
 * Resolves the true original SimpleAssets mint number and total for GPK cards
 * (plain SimpleAssets, and bridged AtomicAssets via their `sassets_id`).
 *
 * Lookup order, per SA id:
 *   1. memory / session cache
 *   2. Self-hosted mint backup on the gpk-data mirror
 *      (`manifests/mints/<last 3 digits>.json`, built monthly by
 *      scripts/build-mint-manifest.mjs). In the offline bundle the same shards
 *      ship as `<shard>.js` files loaded with <script> tags (file:// blocks fetch).
 *   3. Live AtomicHub endpoint (the same one their explorer calls):
 *        GET https://nft-data.api.atomichub.io/v1/simpleassets/mints?asset_ids=<sa_id,...>
 *        -> { success, data: [{ asset_id, mint, total, burned }] }
 *      Browsers are currently CORS-blocked there, so this tier fails quietly
 *      until AtomicHub opens access. Once a live call succeeds in a session,
 *      every lookup also asks live so new mints and totals override the backup.
 *
 * `asset_id` in the response is the ORIGINAL SimpleAssets id. Results are
 * returned keyed by the caller's asset id (AA asset_id for bridged cards).
 */
import { getDataMirrorBases } from './dataMirror';
import { isOfflineBundle } from './offlineBundle';

const ENDPOINT = 'https://nft-data.api.atomichub.io/v1/simpleassets/mints';
const CACHE_TTL = 30 * 60 * 1000;
const CACHE_KEY_PREFIX = 'gpk_sa_mint_v3_';
const BATCH_SIZE = 100;
const CONCURRENCY = 3;
const SHARD_TIMEOUT_MS = 8000;
export const MINT_BACKUP_DIR = 'manifests/mints/';

export type SaMintSource = 'backup' | 'live';

export interface SaMintInfo {
  mint: number;
  total: number;
  burned: number;
  source?: SaMintSource;
  /** ISO time the backup snapshot was built (source === 'backup'). */
  backupDate?: string;
}

interface CacheEntry { ts: number; data: SaMintInfo }
type ShardRow = [number, number, number];
type Shard = Record<string, ShardRow>;
interface MintIndex { generatedAt?: string; shards?: Record<string, unknown> }

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<void>>();
const shardCache = new Map<string, Promise<Shard | null>>();
let indexPromise: Promise<MintIndex | null> | null = null;
let liveWorks = false;

export function shardOf(saId: string): string {
  return String(saId).slice(-3).padStart(3, '0');
}

/** Human label for the ribbon tooltip. */
export function describeMintSource(source?: string, backupDate?: string): string {
  if (source === 'live') return 'Mint number — live from AtomicHub';
  if (source === 'backup') {
    const d = backupDate ? new Date(backupDate) : null;
    const when = d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    return when ? `Mint number — saved backup (${when})` : 'Mint number — saved backup';
  }
  return 'On-chain mint number';
}

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

function remember(saId: string, data: SaMintInfo) {
  memory.set(saId, { ts: Date.now(), data });
  try {
    sessionStorage.setItem(CACHE_KEY_PREFIX + saId, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota */ }
}

// ---------- backup tier ----------

declare global {
  interface Window { __GPK_MINTS__?: Record<string, unknown> }
}

/** Offline bundle: load `<file>.js`, which assigns window.__GPK_MINTS__[key]. */
function loadOfflineScript<T>(key: string, file: string): Promise<T | null> {
  return new Promise((resolve) => {
    const store = (window.__GPK_MINTS__ ??= {});
    if (key in store) { resolve(store[key] as T); return; }
    const s = document.createElement('script');
    s.src = `./${MINT_BACKUP_DIR}${file}`;
    s.async = true;
    s.onload = () => resolve((store[key] as T) ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

async function fetchMirrorJson<T>(file: string): Promise<T | null> {
  for (const base of getDataMirrorBases()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SHARD_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}${MINT_BACKUP_DIR}${file}`, { signal: controller.signal });
      if (res.ok) return (await res.json()) as T;
    } catch { /* try next base */ } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function loadIndex(): Promise<MintIndex | null> {
  if (!indexPromise) {
    indexPromise = (isOfflineBundle()
      ? loadOfflineScript<MintIndex>('index', 'index.js')
      : fetchMirrorJson<MintIndex>('index.json')
    ).catch(() => null);
  }
  return indexPromise;
}

function loadShard(key: string): Promise<Shard | null> {
  let p = shardCache.get(key);
  if (!p) {
    p = (async () => {
      const index = await loadIndex();
      // A published index that doesn't list this shard means "no cards here".
      if (index?.shards && !(key in index.shards)) return {};
      return isOfflineBundle()
        ? loadOfflineScript<Shard>(key, `${key}.js`)
        : fetchMirrorJson<Shard>(`${key}.json`);
    })().catch(() => null);
    // Don't pin a failed (null) shard forever — allow a retry on the next call.
    p.then((v) => { if (v === null) shardCache.delete(key); });
    shardCache.set(key, p);
  }
  return p;
}

async function resolveFromBackup(saIds: string[]): Promise<Map<string, SaMintInfo>> {
  const out = new Map<string, SaMintInfo>();
  if (saIds.length === 0) return out;
  const byShard = new Map<string, string[]>();
  for (const id of saIds) {
    const k = shardOf(id);
    const list = byShard.get(k) ?? [];
    list.push(id);
    byShard.set(k, list);
  }
  const index = await loadIndex();
  await Promise.all([...byShard].map(async ([k, ids]) => {
    const shard = await loadShard(k);
    if (!shard) return;
    for (const id of ids) {
      const row = shard[id];
      if (!Array.isArray(row)) continue;
      const [mint, total, burned] = row.map(Number);
      if (!Number.isFinite(mint) || !Number.isFinite(total)) continue;
      out.set(id, { mint, total, burned: Number.isFinite(burned) ? burned : 0, source: 'backup', backupDate: index?.generatedAt });
    }
  }));
  return out;
}

// ---------- live tier ----------

async function fetchBatch(saIds: string[]): Promise<Record<string, SaMintInfo>> {
  const url = `${ENDPOINT}?asset_ids=${saIds.join(',')}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.success || !Array.isArray(json.data)) return {};
    liveWorks = true;
    const out: Record<string, SaMintInfo> = {};
    for (const row of json.data) {
      if (!row?.asset_id) continue;
      const info: SaMintInfo = {
        mint: Number(row.mint),
        total: Number(row.total),
        burned: Number(row.burned ?? 0),
        source: 'live',
      };
      if (!Number.isFinite(info.mint) || !Number.isFinite(info.total)) continue;
      out[String(row.asset_id)] = info;
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveLive(saIds: string[]): Promise<Map<string, SaMintInfo>> {
  const out = new Map<string, SaMintInfo>();
  if (saIds.length === 0 || isOfflineBundle()) return out;
  const batches: string[][] = [];
  for (let i = 0; i < saIds.length; i += BATCH_SIZE) batches.push(saIds.slice(i, i + BATCH_SIZE));
  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const batch = batches[cursor++];
      const key = batch.join(',');
      let promise = inflight.get(key);
      if (!promise) {
        promise = (async () => {
          try {
            const rows = await fetchBatch(batch);
            for (const [id, info] of Object.entries(rows)) out.set(id, info);
          } catch {
            // Expected while AtomicHub blocks browsers (CORS) — backup covers it.
          } finally {
            inflight.delete(key);
          }
        })();
        inflight.set(key, promise);
      }
      await promise;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker()));
  return out;
}

/**
 * Resolve SA mint info for a list of assets, each identified by its asset id
 * + original sassets_id (equal for plain SimpleAssets). Returns a map keyed by
 * the caller's asset id.
 */
export async function resolveSaMintsForAssets(
  assets: { assetId: string; sassetsId: string }[],
): Promise<Map<string, SaMintInfo>> {
  const result = new Map<string, SaMintInfo>();
  if (assets.length === 0) return result;

  const saToAssetIds = new Map<string, string[]>();
  for (const a of assets) {
    if (!a.sassetsId) continue;
    const list = saToAssetIds.get(a.sassetsId) ?? [];
    list.push(a.assetId);
    saToAssetIds.set(a.sassetsId, list);
  }
  const put = (saId: string, info: SaMintInfo) => {
    for (const aid of saToAssetIds.get(saId) ?? []) result.set(aid, info);
  };

  const need: string[] = [];
  for (const saId of saToAssetIds.keys()) {
    const mem = memory.get(saId);
    if (mem && Date.now() - mem.ts < CACHE_TTL) { put(saId, mem.data); continue; }
    const sess = readSession(saId);
    if (sess) { memory.set(saId, { ts: Date.now(), data: sess }); put(saId, sess); continue; }
    need.push(saId);
  }
  if (need.length === 0) return result;

  const backup = await resolveFromBackup(need);
  for (const [saId, info] of backup) { remember(saId, info); put(saId, info); }

  // Live: anything the backup lacks, or everything once live is known to work.
  const liveIds = liveWorks ? need : need.filter((id) => !backup.has(id));
  const live = await resolveLive(liveIds);
  for (const [saId, info] of live) {
    const prev = backup.get(saId);
    // Live wins unless it somehow reports an older (smaller) total.
    const chosen = prev && prev.total > info.total ? prev : info;
    remember(saId, chosen);
    put(saId, chosen);
  }
  return result;
}

/** Test-only: reset module caches. */
export function __resetSaMintResolverForTests(): void {
  memory.clear();
  inflight.clear();
  shardCache.clear();
  indexPromise = null;
  liveWorks = false;
}
