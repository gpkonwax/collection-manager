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
  it('puts the lowest original mint first when SA and AA copies carry different category labels', () => {
    const cards = [
      card('sa1', 3636, { cardid: '1', category: 'exotic' }),
      card('sa2', 3637, { cardid: '1', category: 'exotic' }),
      card('aa1', 2101, { cardid: '1', category: 'tigerking', source: 'atomicassets', idata: { bridge_mint: '1537' } }),
    ];
    expect(cards.sort(compareNaturalCards).map((asset) => asset.id)).toEqual(['aa1', 'sa1', 'sa2']);
  });

  it('orders non-numeric duplicate card IDs by original mint rather than asset ID', () => {
    const cards = [
      card('1', 900, { cardid: 'TK', category: 'exotic' }),
      card('2', 12, { cardid: 'TK', category: 'exotic', source: 'atomicassets', idata: { bridge_mint: '999' } }),
      card('3', undefined, { cardid: 'TK', category: 'exotic', source: 'atomicassets', idata: { bridge_mint: '1' } }),
    ];
    expect(cards.sort(compareNaturalCards).map((asset) => asset.id)).toEqual(['2', '1', '3']);
  });

  it('orders duplicate copies with different metadata casing lowest mint first', () => {
    const cards = [
      card('1', 900, { quality: 'Base', side: 'A' }),
      card('2', 12, { quality: 'base', side: 'a', source: 'atomicassets', idata: { bridge_mint: '999' } }),
    ];
    expect(cards.sort(compareNaturalCards).map((asset) => asset.id)).toEqual(['2', '1']);
  });

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

describe('binder stack ordering by original mint', () => {
  it('puts the lowest original mint first across SA and AA copies, unresolved last', () => {
    const cards = [
      card('aa1', 120, { source: 'atomicassets', idata: { bridge_mint: '1' } }),
      card('sa1', 5),
      card('aa2', undefined, { source: 'atomicassets', idata: { bridge_mint: '2' } }),
      card('sa2', 42),
    ];
    expect(cards.sort(compareByOriginalMint).map((asset) => asset.id)).toEqual(['sa1', 'sa2', 'aa1', 'aa2']);
  });

  it('never uses the bridge mint as the sort key', () => {
    const cards = [
      card('aa', 900, { source: 'atomicassets', idata: { bridge_mint: '1' } }),
      card('sa', 7),
    ];
    expect(cards.sort(compareByOriginalMint).map((asset) => asset.id)).toEqual(['sa', 'aa']);
  });
});
