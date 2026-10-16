import { afterEach, describe, expect, it, vi } from 'vitest';
import { bundledWaxUsd, saleUsd, utcDay } from '@/lib/waxUsd';
import { originChain } from '@/lib/historyTimeline';

afterEach(() => vi.unstubAllGlobals());

describe('sale USD value', () => {
  it('uses the WAX price of the sale\'s UTC day', async () => {
    const t = Date.UTC(2021, 0, 16, 12);
    const rate = bundledWaxUsd(t)!;
    expect(rate).toBeGreaterThan(0);
    expect(await saleUsd(2350, 'WAX', t)).toBeCloseTo(2350 * rate, 8);
  });

  it('splits days on the UTC boundary', () => {
    expect(utcDay(Date.UTC(2021, 0, 16, 23, 59, 59))).toBe('2021-01-16');
    expect(utcDay(Date.UTC(2021, 0, 17, 0, 0, 0))).toBe('2021-01-17');
  });

  it('reads CheeseHub waxUsd for days after the bundled table', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ waxUsd: 0.005, prices: {} }))));
    expect(await saleUsd(100, 'WAX', Date.UTC(2026, 9, 20))).toBeCloseTo(0.5, 8);
  });

  it('gives no USD when no price exists for the day', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    expect(await saleUsd(100, 'WAX', Date.UTC(2027, 0, 1))).toBeUndefined();
    expect(await saleUsd(100, 'WAX', Date.UTC(2019, 0, 1))).toBeUndefined();
  });
});

describe('pack-opened chain', () => {
  it('native AtomicAssets cards were opened on AA', () => expect(originChain(true, undefined)).toBe('aa'));
  it('bridged AA copies were opened on SA', () => expect(originChain(true, '100000004395407')).toBe('sa'));
  it('SimpleAssets cards were opened on SA', () => expect(originChain(false)).toBe('sa'));
});
