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
