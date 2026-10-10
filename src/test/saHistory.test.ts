import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseSaEvent, SA_HISTORY_BASE } from '@/lib/saHistory';

const TX = 'b'.repeat(64);

describe('saHistory reader', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('parses a stored sale row and rejects malformed rows', () => {
    expect(parseSaEvent([1590000000000, 'sale', 'seller.wam', 'buyer.wam', '12.5', 'WAX', 'gpk', TX]))
      .toEqual({ time: 1590000000000, kind: 'sale', from: 'seller.wam', to: 'buyer.wam', amount: '12.5', token: 'WAX', market: 'gpk', txid: TX });
    expect(parseSaEvent([1590000000000, 'pay', 'a', 'b', '', '', 'gpk', ''])).toBeNull();
    expect(parseSaEvent([0, 'sale', 'a', 'b'])).toBeNull();
    expect(parseSaEvent([1, 'sale', 'NOT_AN_ACCOUNT', 'b'])).toBeNull();
  });

  it('reads the shard named by the last three digits of the id, oldest first', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `${SA_HISTORY_BASE}index.json`) return new Response(JSON.stringify({ complete: false, upTo: '2020-09-01T00:00:00', shards: { '042': {} } }));
      if (url === `${SA_HISTORY_BASE}042.json`) return new Response(JSON.stringify({ '100000000000042': [
        [2000, 'transfer', 'b.wam', 'c.wam', '', '', '', ''],
        [1000, 'sale', 'a.wam', 'b.wam', '3', 'WAX', 'myth', TX],
      ] }));
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { getSaCardHistory } = await import('@/lib/saHistory');
    const h = await getSaCardHistory('100000000000042');
    expect(h?.complete).toBe(false);
    expect(h?.upTo).toBe('2020-09-01T00:00:00');
    expect(h?.events.map((e) => e.kind)).toEqual(['sale', 'transfer']);
    // Shard not listed in the index → empty, without fetching it.
    expect((await getSaCardHistory('100000000000777'))?.events).toEqual([]);
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('777.json'))).toBe(false);
  });

  it('returns null when the history has not been published yet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const { getSaCardHistory } = await import('@/lib/saHistory');
    expect(await getSaCardHistory('123')).toBeNull();
  });
});
