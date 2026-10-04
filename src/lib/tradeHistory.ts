import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';

// Live, on-demand trading history for AtomicAssets cards. Not stored in the
// records ZIP: it changes with every trade, so it is always read fresh.

export interface SaleRecord { id: string; time: number; price: string; seller: string; buyer: string | null }
export interface TransferRecord { id: string; time: number; from: string; to: string; memo: string; txid: string }
export interface TradeHistory { sales: SaleRecord[]; transfers: TransferRecord[] }

const LIMIT = 100;
const cache = new Map<string, TradeHistory>();
const inflight = new Map<string, Promise<TradeHistory>>();

async function getData(path: string): Promise<Record<string, unknown>[]> {
  const res = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 8000);
  const json = await res.json();
  if (!json?.success || !Array.isArray(json.data)) throw new Error('Invalid history response');
  return json.data;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function formatTokenAmount(amount: string, precision: number, symbol: string): string {
  if (!/^\d+$/.test(amount) || !Number.isInteger(precision) || precision < 0) return '';
  const padded = amount.padStart(precision + 1, '0');
  const whole = padded.slice(0, padded.length - precision);
  const frac = precision ? padded.slice(-precision).replace(/0+$/, '') : '';
  return `${Number(whole).toLocaleString('en-GB')}${frac ? `.${frac}` : ''} ${symbol}`.trim();
}

export function parseSale(raw: Record<string, unknown>): SaleRecord | null {
  const price = raw.price as Record<string, unknown> | undefined;
  const amount = str(price?.amount) || str(raw.listing_price);
  const precision = Number(price?.token_precision ?? 8);
  const symbol = str(price?.token_symbol) || str(raw.listing_symbol);
  const time = Number(raw.updated_at_time);
  const seller = str(raw.seller);
  if (!seller || !Number.isFinite(time) || time <= 0) return null;
  return { id: str(raw.sale_id), time, price: formatTokenAmount(amount, precision, symbol), seller, buyer: str(raw.buyer) || null };
}

export function parseTransfer(raw: Record<string, unknown>): TransferRecord | null {
  const time = Number(raw.created_at_time);
  const from = str(raw.sender_name);
  const to = str(raw.recipient_name);
  if (!from || !to || !Number.isFinite(time) || time <= 0) return null;
  return { id: str(raw.transfer_id), time, from, to, memo: str(raw.memo), txid: str(raw.txid) };
}

export function fetchTradeHistory(assetId: string): Promise<TradeHistory> {
  if (!/^\d+$/.test(assetId)) return Promise.resolve({ sales: [], transfers: [] });
  const hit = cache.get(assetId);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(assetId);
  if (pending) return pending;
  const request = Promise.all([
    getData(`/atomicmarket/v1/sales?asset_id=${assetId}&state=3&sort=updated&order=desc&limit=${LIMIT}`),
    getData(`/atomicassets/v1/transfers?asset_id=${assetId}&sort=created&order=desc&limit=${LIMIT}`),
  ]).then(([sales, transfers]) => {
    const result: TradeHistory = {
      sales: sales.map(parseSale).filter((s): s is SaleRecord => !!s),
      transfers: transfers.map(parseTransfer).filter((t): t is TransferRecord => !!t),
    };
    cache.set(assetId, result);
    return result;
  }).finally(() => inflight.delete(assetId));
  inflight.set(assetId, request);
  return request;
}

export const HISTORY_LIMIT = LIMIT;
