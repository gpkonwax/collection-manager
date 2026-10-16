import { afterEach, describe, expect, it, vi } from 'vitest';
import { bundledWaxUsd, utcDay } from '@/lib/waxUsd';
import { originChain } from '@/lib/historyTimeline';

const HISTORY_URL = 'https://raw.githubusercontent.com/cheesehubwax/cheesehub/token-price-data/data/wax-usd-history.json';

afterEach(() => vi.unstubAllGlobals());

/** Fresh module state per test: the CheeseHub index is cached per session. */
async function loadSaleUsd() {
  vi.resetModules();
  return (await import('@/lib/waxUsd')).saleUsd;
}

describe('sale USD value', () => {
  it('prices a WAX sale from CheeseHub\'s consolidated index on the sale\'s UTC day', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url === HISTORY_URL
        ? new Response(JSON.stringify({ '2021-01-16': 0.043, '2021-01-17': 0.05 }))
        : new Response('', { status: 404 })));
    const saleUsd = await loadSaleUsd();
    expect(await saleUsd(2350, 'WAX', Date.UTC(2021, 0, 16, 12))).toBeCloseTo(2350 * 0.043, 8);
    expect(await saleUsd(100, 'WAX', Date.UTC(2021, 0, 17, 1))).toBeCloseTo(5, 8);
  });

  it('fetches the consolidated index only once per session', async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ '2021-01-16': 0.043, '2021-01-17': 0.05 })));
    vi.stubGlobal('fetch', spy);
    const saleUsd = await loadSaleUsd();
    await saleUsd(1, 'WAX', Date.UTC(2021, 0, 16));
    await saleUsd(1, 'WAX', Date.UTC(2021, 0, 17));
    expect(spy.mock.calls.filter(([url]) => url === HISTORY_URL)).toHaveLength(1);
  });

  it('falls back to the bundled table when CheeseHub is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const saleUsd = await loadSaleUsd();
    const t = Date.UTC(2021, 0, 16, 12);
    const rate = bundledWaxUsd(t)!;
    expect(rate).toBeGreaterThan(0);
    expect(await saleUsd(2350, 'WAX', t)).toBeCloseTo(2350 * rate, 8);
  });

  it('splits days on the UTC boundary', () => {
    expect(utcDay(Date.UTC(2021, 0, 16, 23, 59, 59))).toBe('2021-01-16');
    expect(utcDay(Date.UTC(2021, 0, 17, 0, 0, 0))).toBe('2021-01-17');
  });

  it('reads CheeseHub day files for dates the index and bundled table do not cover', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url === HISTORY_URL
        ? new Response('', { status: 404 })
        : new Response(JSON.stringify({ waxUsd: 0.005, prices: {} }))));
    const saleUsd = await loadSaleUsd();
    expect(await saleUsd(100, 'WAX', Date.UTC(2026, 9, 20))).toBeCloseTo(0.5, 8);
  });

  it('gives no USD when no price exists for the day', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const saleUsd = await loadSaleUsd();
    expect(await saleUsd(100, 'WAX', Date.UTC(2027, 0, 1))).toBeUndefined();
    expect(await saleUsd(100, 'WAX', Date.UTC(2018, 0, 1))).toBeUndefined();
  });
});

describe('pack-opened chain', () => {
  it('native AtomicAssets cards were opened on AA', () => expect(originChain(true, undefined)).toBe('aa'));
  it('bridged AA copies were opened on SA', () => expect(originChain(true, '100000004395407')).toBe('sa'));
  it('SimpleAssets cards were opened on SA', () => expect(originChain(false)).toBe('sa'));
});
