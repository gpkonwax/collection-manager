import { describe, it, expect, beforeEach } from 'vitest';
import { mergeHistory, timelineEvents, readClassicPref, writeClassicPref } from '@/lib/historyTimeline';
import { tokenDecimal, type TradeHistory } from '@/lib/tradeHistory';
import type { SaEvent } from '@/lib/saHistory';

const ev = (time: number, kind: SaEvent['kind']): SaEvent => ({ time, kind, from: 'a', to: 'b', amount: '', token: '', market: '', txid: '' });

describe('history timeline', () => {
  const events = [ev(3, 'sale'), ev(1, 'list'), ev(2, 'cancel'), ev(4, 'transfer'), ev(5, 'offer'), ev(6, 'claim'), ev(7, 'bridge')];
  it('defaults to ownership milestones, oldest first', () => {
    expect(timelineEvents(events, false).map((e) => e.kind)).toEqual(['sale', 'transfer', 'claim', 'bridge']);
  });
  it('shows listings and cancellations when toggled', () => {
    expect(timelineEvents(events, true).map((e) => e.time)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('puts a bridged card\'s SimpleAssets life before its AtomicAssets life, each sale once', () => {
    const aa: TradeHistory = {
      sales: [{ id: '77', time: 5000, price: '6.19 WAX', seller: 'x.wam', buyer: 'y.wam', amount: '6.19', token: 'WAX' }],
      transfers: [
        { id: 't1', time: 5001, from: 'x.wam', to: 'y.wam', memo: 'AtomicMarket Purchased Sale - ID # 77', txid: 'a' },
        { id: 't2', time: 9000, from: 'y.wam', to: 'z.wam', memo: '', txid: 'b' },
      ],
    };
    const merged = mergeHistory([ev(1000, 'sale'), ev(2000, 'bridge')], aa);
    expect(merged.map((e) => `${e.chain}:${e.kind}`)).toEqual(['sa:sale', 'sa:bridge', 'aa:sale', 'aa:transfer']);
    expect(merged[2]).toMatchObject({ amount: '6.19', token: 'WAX', from: 'x.wam', to: 'y.wam' });
  });

  it('converts raw token amounts to plain decimals', () => {
    expect(tokenDecimal('619000000', 8)).toBe('6.19');
    expect(tokenDecimal('300000000', 8)).toBe('3');
  });

  it('places same-transaction AtomicMarket escrow before the sale, preserving actual timestamps', () => {
    const time = 1664896669500;
    const aa: TradeHistory = {
      sales: [{ id: '92217954', time, price: '199 WAX', amount: '199', token: 'WAX', seller: 'guz22.wam', buyer: 'le1qu.wam' }],
      transfers: [
        { id: 'delivery', time, from: 'atomicmarket', to: 'le1qu.wam', memo: 'AtomicMarket Purchased Sale - ID # 92217954', txid: 'sale-tx' },
        { id: 'escrow', time, from: 'guz22.wam', to: 'atomicmarket', memo: 'Accepted Offer ID: 95573477', txid: 'sale-tx' },
      ],
    };
    const result = timelineEvents(mergeHistory([], aa), false);
    expect(result.map((e) => [e.kind, e.from, e.to, e.time])).toEqual([
      ['transfer', 'guz22.wam', 'atomicmarket', time],
      ['sale', 'guz22.wam', 'le1qu.wam', time],
    ]);
    expect(result[1].amount).toBe('199');
    expect(timelineEvents([...result].reverse(), true)).toEqual(result);
  });

  it('never moves a later escrow transfer ahead of an earlier sale', () => {
    const result = mergeHistory([], {
      sales: [{ id: '1', time: 1000, price: '199 WAX', amount: '199', token: 'WAX', seller: 'guz22.wam', buyer: 'le1qu.wam' }],
      transfers: [{ id: 'next', time: 2000, from: 'le1qu.wam', to: 'atomicmarket', memo: '', txid: 'next-tx' }],
    });
    expect(result.map((e) => [e.kind, e.time])).toEqual([['sale', 1000], ['transfer', 2000]]);
  });

  describe('bridge receipt pairing', () => {
    const time = Date.UTC(2021, 0, 16);
    const deposit: SaEvent = { ...ev(time, 'offer'), from: 'ymxqu.wam', to: 'atomicbridge', txid: '5076c492' };
    const claim: SaEvent = { ...ev(time, 'claim'), from: '', to: 'atomicbridge', txid: deposit.txid };
    const aa: TradeHistory = {
      sales: [{ id: '1', time: time + 86400000, price: '2,350 WAX', amount: '2350', token: 'WAX', seller: 'ymxqu.wam', buyer: 'guydgnjzgage' }],
      transfers: [],
    };
    it('connects the SA deposit to an AA receipt and then the sale, without a gift claim', () => {
      const result = timelineEvents(mergeHistory([deposit, claim], aa, { time, account: 'ymxqu.wam' }), false);
      expect(result.map((e) => [e.chain, e.kind, e.from, e.to])).toEqual([
        ['sa', 'bridge', 'ymxqu.wam', 'atomicbridge'],
        ['aa', 'bridge-receipt', 'atomicbridge', 'ymxqu.wam'],
        ['aa', 'sale', 'ymxqu.wam', 'guydgnjzgage'],
      ]);
      expect(result[2].amount).toBe('2350');
    });
    it('uses a same-transaction bridge claim as offline evidence when the mint recipient is unavailable', () => {
      expect(mergeHistory([deposit, claim], null, { time })[1]).toMatchObject({ kind: 'bridge-receipt', chain: 'aa', to: 'ymxqu.wam' });
    });
    it('never guesses a receipt from a sale or an unpaired deposit', () => {
      expect(mergeHistory([deposit], aa, { time }).some((e) => e.kind === 'bridge-receipt')).toBe(false);
    });
    it('leaves unrelated gift claims and older bridge cycles intact', () => {
      const older = { ...claim, time: time - 86400000, txid: 'older' };
      const gift = { ...claim, to: 'other.wam', txid: 'gift' };
      const result = mergeHistory([older, deposit, claim, gift], aa, { time, account: 'ymxqu.wam' });
      expect(result.filter((e) => e.kind === 'claim').map((e) => e.txid)).toEqual(['older', 'gift']);
    });
    it('does not replace custody with a mismatched mint recipient', () => {
      const result = mergeHistory([deposit, claim], aa, { time, account: 'other.wam' });
      expect(result.find((e) => e.kind === 'claim')).toMatchObject({ to: 'atomicbridge' });
      expect(result.find((e) => e.kind === 'bridge-receipt')).toMatchObject({ to: 'other.wam', txid: '' });
    });
    it('deduplicates the AA delivery when it is already indexed as a transfer', () => {
      const result = mergeHistory([deposit, claim], { sales: [], transfers: [{ id: 'mint', time, from: 'atomicbridge', to: 'ymxqu.wam', memo: '', txid: deposit.txid }] }, { time, account: 'ymxqu.wam' });
      expect(result.map((e) => e.kind)).toEqual(['bridge', 'bridge-receipt']);
    });
    it('does not change ordinary gifts or add a receipt without this copy’s mint time', () => {
      expect(mergeHistory([deposit, claim], aa).map((e) => e.kind)).toEqual(['offer', 'claim', 'sale']);
      expect(mergeHistory([deposit, claim], aa, { time: NaN, account: 'ymxqu.wam' }).map((e) => e.kind)).toEqual(['offer', 'claim', 'sale']);
    });
  });

  describe('classic list preference', () => {
    beforeEach(() => localStorage.clear());
    it('is off by default and remembered when ticked', () => {
      expect(readClassicPref()).toBe(false);
      writeClassicPref(true);
      expect(readClassicPref()).toBe(true);
    });
  });
});

import { perRowFor } from '@/components/simpleassets/TradeHistorySection';
describe('snake layout', () => {
  it('always fits 5 cards (180px each, 28px arrows) in the 1100px modal row, at least one', () => {
    expect(perRowFor(1036)).toBe(5);
    expect(perRowFor(1012)).toBe(5);
    expect(perRowFor(196)).toBe(1);
    expect(perRowFor(100)).toBe(1);
  });
});
