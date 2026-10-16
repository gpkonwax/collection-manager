import type { SaEvent, SaEventKind } from './saHistory';
import type { TradeHistory } from './tradeHistory';

/** Market chatter hidden by default; everything else changes hands or status. */
export const MARKET_ONLY_KINDS: ReadonlySet<SaEventKind> = new Set(['list', 'cancel', 'refund', 'reprice', 'offer', 'unoffer']);

export type Chain = 'sa' | 'aa';
export type TimelineEvent = SaEvent & { chain: Chain };

/** Pure: oldest-first events for the left-to-right timeline. */
export function timelineEvents<T extends SaEvent>(events: T[], showAll: boolean): T[] {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  return showAll ? sorted : sorted.filter((e) => !MARKET_ONLY_KINDS.has(e.kind));
}

const SETTLE_WINDOW_MS = 120_000;

/**
 * Pure: SimpleAssets history (original copy) + AtomicHub sales/transfers into
 * one oldest-first stream. An AtomicMarket sale settles as a seller→buyer
 * transfer; that transfer is dropped so each sale appears once.
 */
export function mergeHistory(saEvents: SaEvent[], aa: TradeHistory | null): TimelineEvent[] {
  const out: TimelineEvent[] = saEvents.map((e) => ({ ...e, chain: 'sa' }));
  if (aa) {
    const sales = aa.sales.filter((s) => s.buyer);
    for (const s of aa.sales) {
      out.push({ time: s.time, kind: 'sale', from: s.seller, to: s.buyer ?? '', amount: s.amount, token: s.token, market: 'atomicmarket', txid: '', chain: 'aa' });
    }
    for (const t of aa.transfers) {
      const settles = sales.some((s) =>
        (s.id && t.memo.includes(`#${s.id}`)) ||
        (s.seller === t.from && s.buyer === t.to && Math.abs(s.time - t.time) <= SETTLE_WINDOW_MS));
      if (settles) continue;
      out.push({ time: t.time, kind: 'transfer', from: t.from, to: t.to, amount: '', token: '', market: '', txid: t.txid, chain: 'aa' });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

export const CLASSIC_KEY = 'gpk-history-classic';
export function readClassicPref(): boolean {
  try { return localStorage.getItem(CLASSIC_KEY) === '1'; } catch { return false; }
}
export function writeClassicPref(v: boolean) {
  try { localStorage.setItem(CLASSIC_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
}
