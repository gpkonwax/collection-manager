/**
 * Active Wallets — accounts that moved, bought, sold, or opened gpk.topps
 * cards in the last 90 days. Fetched live from the AtomicAssets / AtomicMarket
 * APIs on demand and cached for the session.
 *
 * Sources:
 *   - transfers feed (covers user-to-user trades AND pack openings, since an
 *     opening mints cards to the opener)
 *   - settled market sales (buyer + seller)
 */
import { ATOMIC_API } from './waxConfig';
import { fetchWithFallback, buildApiUrl } from './fetchWithFallback';

export interface ActiveWallet {
  account: string;
  lastActive: number; // ms epoch
  activityCount: number;
}

const WINDOW_DAYS = 90;
const PAGE_LIMIT = 100;
const MAX_PAGES_PER_FEED = 5;
const FETCH_TIMEOUT_MS = 8_000;

// System / escrow accounts that appear in feeds but aren't people.
const EXCLUDED_ACCOUNTS = new Set([
  'atomicmarket',
  'atomicpacksx',
  'atomicdropsx',
  'atomicassets',
  'eosio',
  'eosio.ram',
  'eosio.null',
  'nfthivedrops',
  'nft.hive',
  'gpk.topps',
]);

let cached: { wallets: ActiveWallet[]; at: number } | null = null;

export function getCachedActiveWallets(): { wallets: ActiveWallet[]; at: number } | null {
  return cached;
}

export function clearCachedActiveWallets(): void {
  cached = null;
}

function isPerson(account: string | undefined | null): account is string {
  return !!account && !EXCLUDED_ACCOUNTS.has(account);
}

function record(
  map: Map<string, ActiveWallet>,
  account: string | undefined | null,
  timeMs: number,
): void {
  if (!isPerson(account)) return;
  if (!Number.isFinite(timeMs) || timeMs <= 0) return;
  const existing = map.get(account);
  if (existing) {
    existing.activityCount += 1;
    if (timeMs > existing.lastActive) existing.lastActive = timeMs;
  } else {
    map.set(account, { account, lastActive: timeMs, activityCount: 1 });
  }
}

interface TransferRow {
  sender_name?: string;
  recipient_name?: string;
  created_at_time?: string;
}

interface SaleRow {
  buyer?: string;
  seller?: string;
  updated_at_time?: string;
  created_at_time?: string;
}

async function fetchTransfers(afterMs: number, map: Map<string, ActiveWallet>): Promise<void> {
  for (let page = 1; page <= MAX_PAGES_PER_FEED; page++) {
    const path = buildApiUrl('/atomicassets/v1/transfers', {
      collection_name: 'gpk.topps',
      after: String(afterMs),
      sort: 'created',
      order: 'desc',
      page: String(page),
      limit: String(PAGE_LIMIT),
    });
    const res = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, FETCH_TIMEOUT_MS);
    const data = (await res.json()) as { data?: TransferRow[] };
    const rows = data?.data ?? [];
    for (const row of rows) {
      const t = Number(row.created_at_time ?? 0);
      record(map, row.sender_name, t);
      record(map, row.recipient_name, t);
    }
    if (rows.length < PAGE_LIMIT) break;
  }
}

async function fetchSales(afterMs: number, map: Map<string, ActiveWallet>): Promise<void> {
  for (let page = 1; page <= MAX_PAGES_PER_FEED; page++) {
    const path = buildApiUrl('/atomicmarket/v1/sales', {
      collection_name: 'gpk.topps',
      state: '3', // settled
      after: String(afterMs),
      sort: 'updated',
      order: 'desc',
      page: String(page),
      limit: String(PAGE_LIMIT),
    });
    const res = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, FETCH_TIMEOUT_MS);
    const data = (await res.json()) as { data?: SaleRow[] };
    const rows = data?.data ?? [];
    for (const row of rows) {
      const t = Number(row.updated_at_time ?? row.created_at_time ?? 0);
      record(map, row.buyer, t);
      record(map, row.seller, t);
    }
    if (rows.length < PAGE_LIMIT) break;
  }
}

export async function fetchActiveWallets(opts: {
  signal: AbortSignal;
}): Promise<{ wallets: ActiveWallet[] }> {
  const { signal } = opts;
  const afterMs = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const map = new Map<string, ActiveWallet>();

  // Transfers are the primary signal; sales are best-effort (some mirrors
  // don't serve atomicmarket). A sales failure must not kill the whole list.
  await fetchTransfers(afterMs, map);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  try {
    await fetchSales(afterMs, map);
  } catch (e) {
    console.warn('Active wallets: market sales feed unavailable, continuing without it', e);
  }
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  const wallets = [...map.values()].sort((a, b) => b.lastActive - a.lastActive);
  cached = { wallets, at: Date.now() };
  return { wallets };
}

export function formatLastActive(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return minutes <= 1 ? '1m ago' : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1h ago' : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? '1d ago' : `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1mo ago' : `${months}mo ago`;
}
