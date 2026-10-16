import type { SaEvent, SaEventKind } from './saHistory';
import type { TradeHistory } from './tradeHistory';

/** Market chatter hidden by default; everything else changes hands or status. */
export const MARKET_ONLY_KINDS: ReadonlySet<string> = new Set(['list', 'cancel', 'refund', 'reprice', 'offer', 'unoffer']);

export type Chain = 'sa' | 'aa';
export type TimelineEvent = Omit<SaEvent, 'kind'> & { kind: SaEventKind | 'bridge-receipt'; chain: Chain };
export interface BridgeReceipt { time: number; account?: string | null }

/** Same-time AA escrow deposits precede the sale they fund; timestamps stay intact. */
function compareHistoryEvents(a: Omit<SaEvent, 'kind'> & { kind: string; chain?: Chain }, b: Omit<SaEvent, 'kind'> & { kind: string; chain?: Chain }): number {
  const escrowRank = (e: typeof a) => e.chain === 'aa' && e.kind === 'transfer' && e.to === 'atomicmarket' ? -1 : 0;
  return a.time - b.time || escrowRank(a) - escrowRank(b);
}

/** Pure: oldest-first events for the left-to-right timeline. */
export function timelineEvents<T extends Omit<SaEvent, 'kind'> & { kind: string }>(events: T[], showAll: boolean): T[] {
  const sorted = [...events].sort(compareHistoryEvents);
  return showAll ? sorted : sorted.filter((e) => !MARKET_ONLY_KINDS.has(e.kind));
}

const SETTLE_WINDOW_MS = 120_000;

/**
 * Pure: SimpleAssets history (original copy) + AtomicHub sales/transfers into
 * one oldest-first stream. An AtomicMarket sale settles as a seller→buyer
 * transfer; that transfer is dropped so each sale appears once.
 */
export function mergeHistory(saEvents: SaEvent[], aa: TradeHistory | null, receipt?: BridgeReceipt): TimelineEvent[] {
  let out: TimelineEvent[] = saEvents.map((e) => ({ ...e, chain: 'sa' }));
  // Pair only this AA copy's mint with its bridge deposit. Custody is not a
  // gift; later sales/current ownership must never supply the mint recipient.
  if (receipt && Number.isFinite(receipt.time) && receipt.time > 0) {
    const deposit = [...saEvents].filter((e) =>
      e.to === 'atomicbridge' && e.from && e.from !== 'atomicbridge' &&
      ['offer', 'transfer', 'bridge'].includes(e.kind) &&
      Math.abs(e.time - receipt.time) <= SETTLE_WINDOW_MS &&
      (!receipt.account || e.from === receipt.account)
    ).sort((a, b) => Math.abs(a.time - receipt.time) - Math.abs(b.time - receipt.time))[0];
    const custody = deposit?.txid ? saEvents.find((e) =>
      e.kind === 'claim' && e.txid === deposit.txid &&
      (e.to === 'atomicbridge' || e.from === 'atomicbridge')
    ) : undefined;
    const recipient = receipt.account || (custody ? deposit?.from : undefined);
    if (recipient && /^[a-z1-5.]{1,12}$/.test(recipient)) {
      out = out.filter((e) => !custody || !(e.kind === 'claim' && e.txid === custody.txid &&
        (e.to === 'atomicbridge' || e.from === 'atomicbridge'))).map((e) =>
        deposit && e.kind === deposit.kind && e.time === deposit.time && e.txid === deposit.txid &&
        e.from === deposit.from && e.to === deposit.to ? { ...e, kind: 'bridge' } : e
      );
      out.push({ time: Math.max(receipt.time, deposit?.time ?? receipt.time), kind: 'bridge-receipt',
        from: 'atomicbridge', to: recipient, amount: '', token: '', market: '',
        txid: deposit?.txid ?? '', chain: 'aa' });
    }
  }
  if (aa) {
    const sales = aa.sales.filter((s) => s.buyer);
    for (const s of aa.sales) {
      out.push({ time: s.time, kind: 'sale', from: s.seller, to: s.buyer ?? '', amount: s.amount, token: s.token, market: 'atomicmarket', txid: '', chain: 'aa' });
    }
    for (const t of aa.transfers) {
      if (out.some((e) => e.kind === 'bridge-receipt' && t.from === e.from && t.to === e.to &&
        Math.abs(t.time - e.time) <= SETTLE_WINDOW_MS)) continue;
      const settles = sales.some((s) =>
        (s.id && new RegExp(`#\\s*${s.id}\\b`).test(t.memo)) ||
        (s.seller === t.from && s.buyer === t.to && Math.abs(s.time - t.time) <= SETTLE_WINDOW_MS));
      if (settles) continue;
      out.push({ time: t.time, kind: 'transfer', from: t.from, to: t.to, amount: '', token: '', market: '', txid: t.txid, chain: 'aa' });
    }
  }
  return out.sort(compareHistoryEvents);
}

export const CLASSIC_KEY = 'gpk-history-classic';
export function readClassicPref(): boolean {
  try { return localStorage.getItem(CLASSIC_KEY) === '1'; } catch { return false; }
}
export function writeClassicPref(v: boolean) {
  try { localStorage.setItem(CLASSIC_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
}

/** Chain a card's pack was opened on: native AtomicAssets copies (no SimpleAssets origin) were opened on AA; everything else on SA. */
export function originChain(isAtomic: boolean, saOriginId?: string): 'sa' | 'aa' {
  return isAtomic && !saOriginId ? 'aa' : 'sa';
}
