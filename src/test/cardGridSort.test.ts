import { describe, expect, it } from 'vitest';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import { compareNaturalCards, compareByOriginalMint } from '@/lib/cardGridSort';

const card = (id: string, mintNumber?: number, overrides: Partial<SimpleAsset> = {}): SimpleAsset => ({
  id, owner: 'collector', author: 'gpk.topps', category: 'series2', name: 'Card',
  image: '', images: [], cardid: '2', side: 'a', quality: 'base',
  idata: {}, mdata: {}, container: [], containerf: [], source: 'simpleassets',
  mintNumber, ...overrides,
});

describe('natural grid ordering', () => {
  it('sorts duplicate copies across both contracts by original mint, unresolved copies last', () => {
    const cards = [
      card('1', 1524),
      card('2', undefined, { source: 'atomicassets', idata: { bridge_mint: '1' } }),
      card('3', 115, { source: 'atomicassets', idata: { bridge_mint: '3000' } }),
      card('4', 24),
    ];
    expect(cards.sort(compareNaturalCards).map((asset) => asset.id)).toEqual(['4', '3', '1', '2']);
  });

  it('preserves card ID, side, and variant priority before comparing mints', () => {
    const cards = [
      card('1', 1, { cardid: '3' }),
      card('2', 1, { side: 'b' }),
      card('3', 1, { quality: 'prism' }),
      card('4', 900),
    ];
    expect(cards.sort(compareNaturalCards).map((asset) => asset.id)).toEqual(['4', '3', '2', '1']);
  });

  it('does not reorder different series with the same card ID by mint', () => {
    const cards = [card('1', 100, { category: 'series1' }), card('2', 1, { category: 'series2' })];
    expect(cards.sort(compareNaturalCards).map((asset) => asset.id)).toEqual(['1', '2']);
  });

  it('sorts by displayed mint for native AtomicAssets and SimpleAssets metadata', () => {
    const cards = [card('1', undefined, { source: 'atomicassets', category: 'foodfightb', idata: { bridge_mint: '80' } }),
      card('2', undefined, { source: 'simpleassets', category: 'foodfightb', idata: { mint: '12' } })];
    expect(cards.sort(compareNaturalCards).map((asset) => asset.id)).toEqual(['2', '1']);
  });
});