// Scan WAX for accounts holding GPK assets.
// Sources:
//  - SimpleAssets: contract `gpk.topps`, table `sassets` — one scope per holder.
//  - AtomicAssets: collection `cheesenftwax` bridged GPK schemas (series1/2/exotic).

import { waxRpcCall, WAX_RPC_ENDPOINTS } from './waxRpcFallback';
import { fetchWithFallback } from './fetchWithFallback';
import { ATOMIC_API } from './waxConfig';

export interface Holder {
  account: string;
  sa: number;
  aa: number;
  total: number;
}

export interface ScanProgress {
  saScanned: number;
  aaScanned: number;
  phase: 'idle' | 'scanning' | 'done' | 'error';
}

const BRIDGED_SCHEMAS = ['series1', 'series2', 'exotic'];

interface TableByScopeRow {
  code: string;
  scope: string;
  table: string;
  payer: string;
  count: number;
}
interface TableByScopeResponse {
  rows: TableByScopeRow[];
  more: string;
}

async function getTableByScope(lowerBound: string, timeout = 10000): Promise<TableByScopeResponse> {
  return waxRpcCall<TableByScopeResponse>(
    '/v1/chain/get_table_by_scope',
    { code: 'gpk.topps', table: 'sassets', limit: 1000, lower_bound: lowerBound },
    timeout,
  );
}

export async function scanGpkTopps(
  signal: AbortSignal,
  onCount?: (n: number) => void,
): Promise<Map<string, number>> {
  const holders = new Map<string, number>();
  let lower = '';
  // Safety cap — WAX has millions of accounts, but gpk.topps holders should be < 20k scopes.
  for (let i = 0; i < 100; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const res = await getTableByScope(lower);
    for (const r of res.rows) {
      if (r.count > 0) holders.set(r.scope, (holders.get(r.scope) || 0) + r.count);
    }
    onCount?.(holders.size);
    if (!res.more) break;
    // `more` is the next lower_bound key.
    if (res.more === lower) break;
    lower = res.more;
  }
  return holders;
}

interface AaAccountRow {
  account: string;
  assets: string; // number-as-string
}
interface AaAccountsResponse {
  success: boolean;
  data: AaAccountRow[];
}

async function getAaAccountsPage(page: number, timeout = 15000): Promise<AaAccountRow[]> {
  const schemaParams = BRIDGED_SCHEMAS.map((s) => `schema_name=${encodeURIComponent(s)}`).join('&');
  const path = `/atomicassets/v1/accounts?collection_name=cheesenftwax&${schemaParams}&limit=1000&page=${page}&order=desc&sort=assets`;
  const res = await fetchWithFallback(ATOMIC_API.baseUrls, path, {}, timeout);
  const body = (await res.json()) as AaAccountsResponse;
  return body?.data || [];
}

export async function scanBridgedAa(
  signal: AbortSignal,
  onCount?: (n: number) => void,
): Promise<Map<string, number>> {
  const holders = new Map<string, number>();
  for (let page = 1; page <= 50; page++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const rows = await getAaAccountsPage(page);
    for (const r of rows) {
      const n = parseInt(r.assets, 10) || 0;
      if (n > 0) holders.set(r.account, (holders.get(r.account) || 0) + n);
    }
    onCount?.(holders.size);
    if (rows.length < 1000) break;
  }
  return holders;
}

// Session cache
let cached: { holders: Holder[]; at: number } | null = null;
export function getCachedHolders(): { holders: Holder[]; at: number } | null {
  return cached;
}
export function clearCachedHolders() { cached = null; }

export async function fetchTopGpkHolders(opts: {
  signal: AbortSignal;
  onProgress?: (p: { saScanned: number; aaScanned: number }) => void;
  limit?: number;
}): Promise<Holder[]> {
  const { signal, onProgress } = opts;
  const limit = opts.limit ?? 500;
  const progress = { saScanned: 0, aaScanned: 0 };
  const emit = () => onProgress?.({ ...progress });

  // Only scan SimpleAssets on gpk.topps — the list is explicitly gpk.topps holders,
  // not bridged AtomicAssets (cheesenftwax) holders.
  const saMap = await scanGpkTopps(signal, (n) => { progress.saScanned = n; emit(); });

  const ranked: Holder[] = Array.from(saMap.entries())
    .map(([account, sa]) => ({ account, sa, aa: 0, total: sa }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  cached = { holders: ranked, at: Date.now() };
  return ranked;
}

// silence unused import warning if tree-shaken; keep endpoint list reachable
export const _endpointCount = WAX_RPC_ENDPOINTS.length;
