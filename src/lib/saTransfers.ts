/**
 * SimpleAssets ownership history.
 *  - Saved: manifests/sa-transfers.json, recorded twice daily from tracking start
 *    Legacy fallback until the sa-history branch is published (records ZIP, then raw GitHub).
 *  - Live: the transfer that delivered a card to its current owner, read from the
 *    full-history node (pruned nodes would wrongly report "none").
 */
import { GITHUB_RAW_MIRROR_URL } from './dataMirror';
import { getLoadedRecords } from './recordsZip';
import { isOfflineBundle } from './offlineBundle';

export interface SaTransfer { time: number; from: string; to: string; memo: string; txid: string }
export interface SaTransferStore { cursor?: string | null; assets?: Record<string, unknown[]> }

const FULL_NODE = 'https://wax.eosdac.io';
const PAGE = 100;
const MAX_PAGES = 5;
const TIMEOUT_MS = 10000;
const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;

const hyperionMs = (ts: unknown) =>
  typeof ts === 'string' && ts ? Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts}Z`) : NaN;

export function parseSavedRow(raw: unknown): SaTransfer | null {
  if (!Array.isArray(raw)) return null;
  const [time, from, to, memo, txid] = raw;
  if (typeof time !== 'number' || !Number.isFinite(time) || time <= 0) return null;
  if (typeof from !== 'string' || !ACCOUNT_RE.test(from) || typeof to !== 'string' || !ACCOUNT_RE.test(to)) return null;
  return { time, from, to, memo: typeof memo === 'string' ? memo : '', txid: typeof txid === 'string' && /^[0-9a-f]{64}$/.test(txid) ? txid : '' };
}

let mirrorStore: Promise<SaTransferStore | null> | null = null;
async function fetchMirrorStore(): Promise<SaTransferStore | null> {
  if (isOfflineBundle()) return null;
  for (const base of [GITHUB_RAW_MIRROR_URL]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base}manifests/sa-transfers.json`, { signal: controller.signal });
      if (res.ok) return (await res.json()) as SaTransferStore;
    } catch { /* next */ } finally { clearTimeout(timer); }
  }
  return null;
}

/** Saved transfers for a card, newest first. Empty when none recorded or not available. */
export async function getSavedSaTransfers(id: string): Promise<SaTransfer[]> {
  if (!/^\d+$/.test(id)) return [];
  let store = getLoadedRecords()?.saTransfers ?? null;
  if (!store) {
    mirrorStore ??= fetchMirrorStore().then((s) => { if (!s) mirrorStore = null; return s; });
    store = await mirrorStore;
  }
  const rows = store?.assets?.[id];
  if (!Array.isArray(rows)) return [];
  return rows.map(parseSavedRow).filter((r): r is SaTransfer => !!r).sort((a, b) => b.time - a.time);
}

/** Pure: newest action in a page that moved `id` to `owner`. */
export function findIncoming(actions: unknown[], id: string, owner: string): SaTransfer | null {
  for (const a of actions as Record<string, any>[]) {
    if (a?.act?.account !== 'simpleassets' || a?.act?.name !== 'transfer') continue;
    const d = a.act.data ?? {};
    if (d.to !== owner || !Array.isArray(d.assetids) || !d.assetids.map(String).includes(id)) continue;
    const time = hyperionMs(a['@timestamp'] ?? a.timestamp);
    if (!Number.isFinite(time) || typeof d.from !== 'string') continue;
    return { time, from: d.from, to: owner, memo: typeof d.memo === 'string' ? d.memo : '', txid: typeof a.trx_id === 'string' ? a.trx_id : '' };
  }
  return null;
}

/** found: the transfer; none: owner's full history has none; unknown: searched the newest pages only. */
export type IncomingResult = { kind: 'found'; transfer: SaTransfer } | { kind: 'none' } | { kind: 'unknown' };

const incomingCache = new Map<string, IncomingResult>();

export async function fetchIncomingSaTransfer(id: string, owner: string): Promise<IncomingResult> {
  if (!/^\d+$/.test(id) || !ACCOUNT_RE.test(owner)) return { kind: 'unknown' };
  const key = `${id}:${owner}`;
  const hit = incomingCache.get(key);
  if (hit) return hit;
  let result: IncomingResult = { kind: 'unknown' };
  for (let page = 0; page < MAX_PAGES; page++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let actions: unknown[];
    try {
      const res = await fetch(
        `${FULL_NODE}/v2/history/get_actions?account=${owner}&filter=simpleassets:transfer&sort=desc&limit=${PAGE}&skip=${page * PAGE}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json?.actions)) throw new Error('Invalid history response');
      actions = json.actions;
    } finally { clearTimeout(timer); }
    const found = findIncoming(actions, id, owner);
    if (found) { result = { kind: 'found', transfer: found }; break; }
    if (actions.length < PAGE) { result = { kind: 'none' }; break; }
  }
  incomingCache.set(key, result);
  return result;
}
