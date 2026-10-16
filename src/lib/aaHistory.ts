/**
 * Our own copy of GPK AtomicAssets card history (mints/pack openings,
 * transfers, burns, settled sales), built by scripts/backfill-aa-history.mjs
 * and published on the "aa-history" branch as by-asset/NNN.json. Read order:
 * a loaded gpk-aa-history.zip, then raw GitHub; live AtomicHub fills in
 * anything newer (merged by the caller).
 */
import { GITHUB_RAW_MIRROR_URL } from './dataMirror';
import { isOfflineBundle } from './offlineBundle';
import { createHistoryZip } from './saHistoryZip';
import { ATOMIC_API } from './waxConfig';
import { fetchWithFallback } from './fetchWithFallback';
import { HYPERION_ENDPOINTS } from './waxRpcFallback';
import type { SaleRecord, TradeHistory, TransferRecord } from './tradeHistory';

export const AA_HISTORY_BASE = GITHUB_RAW_MIRROR_URL.replace(/\/main\/$/, '/aa-history/by-asset/');
export const AA_HISTORY_ZIP_NAME = 'gpk-aa-history.zip';
export const AA_HISTORY_ZIP_URL = `https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/${AA_HISTORY_ZIP_NAME}`;

const aaZip = createHistoryZip<Record<string, unknown>>('aa-history', AA_HISTORY_ZIP_NAME);
export const subscribeAaHistoryZip = aaZip.subscribe;
export const getLoadedAaHistory = aaZip.get;
export const clearAaHistoryZip = aaZip.clear;
export const loadAaHistoryZip = aaZip.load;

/** Same rules as scripts/lib/aaHistory.mjs (kept in step by a test). */
export const POOL = 'gpkpools1111';
export const UNBOX_MINTER = 'premint.nft';
export const BRIDGE = 'atomicbridge';
export const PACK_RULES: Record<string, string> = {
  'gpkcrashpack:crashgordon': '13778',
  'burnieunpack:bernventures': '48479',
  'burnieunpack:mittens': '51437',
  'gpkpools1111:gamestonk': '53187',
  'gpkpools1111:foodfightb': '59072',
};
export const UNBOX_PACKS = new Set(['59489', '59490', '59491', '59492']);

export interface AaOpening { kind: 'open' | 'mint'; time: number; account: string; minter: string; packTemplate: string; txid: string }
export interface AaBurn { time: number; owner: string; txid: string }
export interface AaCardRecord { opening: AaOpening | null; transfers: TransferRecord[]; sales: SaleRecord[]; burn: AaBurn | null }
export interface AaCardHistory extends AaCardRecord { complete: boolean; upTo: string | null }

const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;
const TX_RE = /^[0-9a-f]{64}$/;
const acct = (v: unknown) => (typeof v === 'string' && ACCOUNT_RE.test(v) ? v : '');
const txOf = (v: unknown) => (typeof v === 'string' && TX_RE.test(v) ? v : '');
const msOf = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const fmtPrice = (amount: string, token: string) => `${Number(amount).toLocaleString('en-GB', { maximumFractionDigits: 8 })} ${token}`.trim();

/** Pure: one stored card record → typed record (malformed parts dropped). */
export function parseAaCard(raw: unknown): AaCardRecord {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  let opening: AaOpening | null = null;
  if (Array.isArray(r.m) && (r.m[0] === 'open' || r.m[0] === 'mint') && msOf(r.m[1]) && acct(r.m[2])) {
    opening = { kind: r.m[0], time: r.m[1] as number, account: r.m[2] as string, minter: acct(r.m[3]), packTemplate: /^\d+$/.test(String(r.m[4] ?? '')) ? String(r.m[4]) : '', txid: txOf(r.m[5]) };
  }
  const transfers: TransferRecord[] = (Array.isArray(r.t) ? r.t : []).flatMap((t) => {
    if (!Array.isArray(t) || !msOf(t[0]) || !acct(t[1]) || !acct(t[2])) return [];
    return [{ id: '', time: t[0], from: t[1], to: t[2], memo: typeof t[3] === 'string' ? t[3] : '', txid: txOf(t[4]) }];
  });
  const sales: SaleRecord[] = (Array.isArray(r.s) ? r.s : []).flatMap((s) => {
    if (!Array.isArray(s) || !msOf(s[0]) || !acct(s[1]) || !acct(s[2]) || !/^\d+(\.\d+)?$/.test(String(s[3])) || !/^[A-Z][A-Z0-9]{0,6}$/.test(String(s[4]))) return [];
    const kind = s[6] === 'auction' || s[6] === 'offer' ? `${s[6]}:` : '';
    return [{ id: `${kind}${String(s[5] ?? '')}`, time: s[0], price: fmtPrice(String(s[3]), String(s[4])), seller: s[1], buyer: s[2], amount: String(s[3]), token: String(s[4]) }];
  });
  const burn = Array.isArray(r.b) && msOf(r.b[0]) && acct(r.b[1]) ? { time: r.b[0] as number, owner: r.b[1] as string, txid: txOf(r.b[2]) } : null;
  return { opening, transfers, sales, burn };
}

/** Pure: stored + live AtomicHub history, each sale and transfer once. */
export function combineAaHistory(stored: AaCardRecord | null, live: TradeHistory | null): TradeHistory | null {
  if (!stored && !live) return null;
  const sales = new Map<string, SaleRecord>();
  for (const s of [...(stored?.sales ?? []), ...(live?.sales ?? [])]) sales.set(s.id || `${s.time}|${s.seller}|${s.buyer}`, s);
  const transfers = new Map<string, TransferRecord>();
  for (const t of [...(stored?.transfers ?? []), ...(live?.transfers ?? [])]) {
    const k = t.txid ? `${t.txid}|${t.from}|${t.to}` : `${t.time}|${t.from}|${t.to}`;
    const old = transfers.get(k);
    transfers.set(k, old && !t.id ? old : t);
  }
  return {
    sales: [...sales.values()].sort((a, b) => b.time - a.time),
    transfers: [...transfers.values()].sort((a, b) => b.time - a.time),
  };
}

/** Pure: pack opening from a mint record (minter + schema rules); null for bridge copies. */
export function openingFromMint(
  mint: { time: number; owner: string; minter: string; txid: string },
  schema: string,
  transfers: TransferRecord[],
  unboxPack = '',
): AaOpening | null {
  if (mint.minter === BRIDGE) return null;
  if (mint.owner === POOL && PACK_RULES[`${POOL}:${schema}`]) {
    const delivery = [...transfers].sort((a, b) => a.time - b.time).find((t) => t.from === POOL);
    return delivery ? { kind: 'open', time: delivery.time, account: delivery.to, minter: mint.minter, packTemplate: PACK_RULES[`${POOL}:${schema}`], txid: delivery.txid } : null;
  }
  if (mint.minter === UNBOX_MINTER) return { kind: 'open', time: mint.time, account: mint.owner, minter: mint.minter, packTemplate: UNBOX_PACKS.has(unboxPack) ? unboxPack : '', txid: mint.txid };
  const pack = PACK_RULES[`${mint.minter}:${schema}`];
  return { kind: pack ? 'open' : 'mint', time: mint.time, account: mint.owner, minter: mint.minter, packTemplate: pack ?? '', txid: mint.txid };
}

async function getJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally { clearTimeout(timer); }
}

let indexPromise: Promise<{ complete?: boolean; upTo?: string | null; shards?: Record<string, unknown> } | null> | null = null;
const shardCache = new Map<string, Promise<Record<string, unknown> | null>>();

/** Stored card history; null = not published yet. Throws on network failure. */
export async function getAaCardHistory(id: string): Promise<AaCardHistory | null> {
  if (!/^\d+$/.test(id)) return null;
  const key = id.slice(-3).padStart(3, '0');
  const loaded = getLoadedAaHistory();
  if (loaded) return { ...parseAaCard(aaZip.shard(key)?.[id]), complete: loaded.complete, upTo: loaded.upTo };
  if (isOfflineBundle()) return null;
  indexPromise ??= getJson<{ complete?: boolean; upTo?: string | null; shards?: Record<string, unknown> }>(`${AA_HISTORY_BASE}index.json`).catch((e) => { indexPromise = null; throw e; });
  const index = await indexPromise;
  if (!index) return null;
  const meta = { complete: !!index.complete, upTo: index.upTo ?? null };
  if (index.shards && !(key in index.shards)) return { ...parseAaCard(null), ...meta };
  let p = shardCache.get(key);
  if (!p) {
    p = getJson<Record<string, unknown>>(`${AA_HISTORY_BASE}${key}.json`);
    p.catch(() => shardCache.delete(key));
    shardCache.set(key, p);
  }
  return { ...parseAaCard((await p)?.[id]), ...meta };
}

// ---------- live fallback for cards our copy doesn't cover yet ----------
const liveCache = new Map<string, Promise<AaOpening | null>>();

async function ahData(path: string): Promise<Record<string, unknown>[]> {
  const res = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 8000);
  const json = await res.json();
  if (!json?.success || !Array.isArray(json.data)) throw new Error('Invalid AtomicHub response');
  return json.data;
}

async function unboxPackOf(txid: string): Promise<string> {
  for (const base of HYPERION_ENDPOINTS) {
    try {
      const res = await fetch(`${base}/v2/history/get_transaction?id=${txid}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const body = await res.json();
      if (!Array.isArray(body?.actions) || !body.actions.length) continue;
      const claim = body.actions.find((a: { act?: { account?: string; name?: string; data?: { assoc_id?: unknown } } }) => a?.act?.account === 'unbox.nft' && a.act.name === 'claim');
      const assoc = String(claim?.act?.data?.assoc_id ?? '');
      if (!/^\d+$/.test(assoc)) return '';
      const [pack] = await ahData(`/atomicassets/v1/assets/${assoc}`).catch(async () => (await ahData(`/atomicassets/v1/assets?ids=${assoc}`)));
      return String((pack as { template?: { template_id?: unknown } })?.template?.template_id ?? '');
    } catch { /* next node */ }
  }
  return '';
}

/** Live: this card's mint log from AtomicHub, turned into an opening. null when unknown. */
export function fetchLiveAaOpening(id: string, schema: string, transfers: TransferRecord[]): Promise<AaOpening | null> {
  const hit = liveCache.get(id);
  if (hit) return hit;
  const p = (async () => {
    const res = await fetchWithFallback(ATOMIC_API.baseUrls, `/atomicassets/v1/assets/${id}/logs?order=asc&limit=1`, undefined, 8000);
    const json = await res.json();
    const log = Array.isArray(json?.data) ? json.data[0] : null;
    if (!log || log.name !== 'logmint') return null;
    const mint = { time: Number(log.created_at_time), owner: acct(log.data?.new_asset_owner), minter: acct(log.data?.authorized_minter), txid: txOf(log.txid) };
    if (!msOf(mint.time) || !mint.owner) return null;
    const unboxPack = mint.minter === UNBOX_MINTER && mint.txid ? await unboxPackOf(mint.txid) : '';
    return openingFromMint(mint, schema, transfers, unboxPack);
  })();
  p.catch(() => liveCache.delete(id));
  liveCache.set(id, p);
  return p;
}
