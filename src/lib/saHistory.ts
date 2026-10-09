/**
 * Full GPK SimpleAssets history per card (sales, listings, transfers, gifts,
 * burns, bridging), built by scripts/backfill-sa-history.mjs and published on
 * the repo's "sa-history" branch as by-asset/NNN.json (last 3 digits of the id).
 * Read from raw GitHub only — the data and image mirrors never carry records.
 */
import { GITHUB_RAW_MIRROR_URL } from './dataMirror';
import { isOfflineBundle } from './offlineBundle';

export const SA_HISTORY_BASE = GITHUB_RAW_MIRROR_URL.replace(/\/main\/$/, '/sa-history/by-asset/');

export type SaEventKind =
  | 'sale' | 'list' | 'cancel' | 'refund' | 'reprice' | 'transfer' | 'offer'
  | 'unoffer' | 'claim' | 'burn' | 'bridge' | 'unbridge';

export interface SaEvent {
  time: number; kind: SaEventKind; from: string; to: string;
  amount: string; token: string; market: string; txid: string;
}
export interface SaHistoryIndex { complete: boolean; upTo: string | null; shards: Record<string, unknown> }
export interface SaCardHistory { events: SaEvent[]; complete: boolean; upTo: string | null }

const KINDS = new Set<SaEventKind>(['sale', 'list', 'cancel', 'refund', 'reprice', 'transfer', 'offer', 'unoffer', 'claim', 'burn', 'bridge', 'unbridge']);
const ACCOUNT_RE = /^[a-z1-5.]{0,12}$/;
const TIMEOUT_MS = 10000;
export const MARKET_NAMES: Record<string, string> = { gpk: 'GPK market', sm: 'SimpleMarket', myth: 'Myth.Market', cio: 'Collectables.io' };

/** Pure: one stored row → event, or null when malformed. */
export function parseSaEvent(raw: unknown): SaEvent | null {
  if (!Array.isArray(raw)) return null;
  const [time, kind, from, to, amount, token, market, txid] = raw;
  if (typeof time !== 'number' || !Number.isFinite(time) || time <= 0) return null;
  if (typeof kind !== 'string' || !KINDS.has(kind as SaEventKind)) return null;
  if (typeof from !== 'string' || !ACCOUNT_RE.test(from) || typeof to !== 'string' || !ACCOUNT_RE.test(to)) return null;
  return {
    time, kind: kind as SaEventKind, from, to,
    amount: typeof amount === 'string' && /^\d+(\.\d+)?$/.test(amount) ? amount : '',
    token: typeof token === 'string' && /^[A-Z][A-Z0-9]{0,6}$/.test(token) ? token : '',
    market: typeof market === 'string' ? market : '',
    txid: typeof txid === 'string' && /^[0-9a-f]{64}$/.test(txid) ? txid : '',
  };
}

async function getJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally { clearTimeout(timer); }
}

let indexPromise: Promise<SaHistoryIndex | null> | null = null;
const shardCache = new Map<string, Promise<Record<string, unknown[]> | null>>();

/**
 * Card history, oldest first. null = the history isn't published yet (caller
 * falls back to older records). Throws on network failure so the UI can offer a retry.
 */
export async function getSaCardHistory(id: string): Promise<SaCardHistory | null> {
  if (!/^\d+$/.test(id) || isOfflineBundle()) return null;
  indexPromise ??= getJson<SaHistoryIndex>(`${SA_HISTORY_BASE}index.json`).catch((e) => { indexPromise = null; throw e; });
  const index = await indexPromise;
  if (!index) return null;
  const key = id.slice(-3).padStart(3, '0');
  const meta = { complete: !!index.complete, upTo: index.upTo ?? null };
  if (index.shards && !(key in index.shards)) return { events: [], ...meta };
  let p = shardCache.get(key);
  if (!p) {
    p = getJson<Record<string, unknown[]>>(`${SA_HISTORY_BASE}${key}.json`);
    p.catch(() => shardCache.delete(key));
    shardCache.set(key, p);
  }
  const shard = await p;
  const rows = shard?.[id];
  const events = Array.isArray(rows) ? rows.map(parseSaEvent).filter((e): e is SaEvent => !!e).sort((a, b) => a.time - b.time) : [];
  return { events, ...meta };
}
