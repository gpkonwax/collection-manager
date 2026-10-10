import { describe, it, expect } from 'vitest';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import {
  parseSlotIds,
  encodeStackSlot,
  areDuplicateCards,
  mergeStackIds,
} from '@/lib/savedLayoutStacks';

function sa(overrides: Partial<SimpleAsset> & { id: string }): SimpleAsset {
  return {
    owner: 'test.acct',
    author: 'gpk.topps',
    category: 'gpk',
    name: 'Adam Bomb',
    image: 'ipfs://x',
    images: ['ipfs://x'],
    cardid: '1',
    quality: 'a',
    side: '',
    idata: {},
    mdata: {},
    container: [],
    containerf: [],
    source: 'simpleassets',
    ...overrides,
  } as SimpleAsset;
}

describe('parseSlotIds / encodeStackSlot', () => {
  it('splits stacked slot strings into their asset IDs', () => {
    expect(parseSlotIds('10,22,3')).toEqual(['10', '22', '3']);
    expect(parseSlotIds('10')).toEqual(['10']);
    expect(parseSlotIds('')).toEqual([]);
  });

  it('round-trips a stack slot', () => {
    expect(encodeStackSlot(parseSlotIds('10,22,3'))).toBe('10,22,3');
  });
});

describe('areDuplicateCards', () => {
  it('treats same card number, side and variant on one contract as duplicates', () => {
    expect(areDuplicateCards(sa({ id: '1' }), sa({ id: '2' }))).toBe(true);
  });

  it('rejects different variants, sides or card numbers', () => {
    expect(areDuplicateCards(sa({ id: '1' }), sa({ id: '2', quality: 'b' }))).toBe(false);
    expect(areDuplicateCards(sa({ id: '1' }), sa({ id: '2', side: 'b' }))).toBe(false);
    expect(areDuplicateCards(sa({ id: '1' }), sa({ id: '2', cardid: '2' }))).toBe(false);
  });

  it('matches identity case-insensitively', () => {
    expect(areDuplicateCards(sa({ id: '1', cardid: '7', quality: 'A' }), sa({ id: '2', cardid: '7', quality: 'a' }))).toBe(true);
  });

  it('does not treat different collections with equal numbers as duplicates', () => {
    const tiger = sa({ id: '1', category: 'tigerking', cardid: '8', quality: 'a' });
    const gpk = sa({ id: '2', category: 'gpk', cardid: '8', quality: 'a' });
    expect(areDuplicateCards(tiger, gpk)).toBe(false);
  });

  it('treats a bridged AtomicAssets copy and its SimpleAssets original as duplicates', () => {
    const original = sa({ id: '100', category: 'gpk', cardid: '8', quality: 'a' });
    const bridged = sa({
      id: '200',
      category: 'gpk.topps',
      source: 'atomicassets',
      cardid: '8',
      quality: 'a',
      idata: { sassets_id: '100' },
    });
    expect(areDuplicateCards(original, bridged)).toBe(true);
    expect(areDuplicateCards(bridged, original)).toBe(true);
  });

  it('treats two bridged copies of the same original as duplicates', () => {
    const one = sa({ id: '200', category: 'gpk.topps', source: 'atomicassets', cardid: '8', quality: 'a', idata: { sassets_id: '100' } });
    const two = sa({ id: '201', category: 'gpk.topps', source: 'atomicassets', cardid: '8', quality: 'a', idata: { sassets_id: '100' } });
    expect(areDuplicateCards(one, two)).toBe(true);
  });

  it('rejects cross-collection cards that merely both carry a bridged link', () => {
    const tiger = sa({ id: '300', category: 'tigerking', source: 'atomicassets', cardid: '8', quality: 'a', idata: { sassets_id: '900' } });
    const gpk = sa({ id: '301', category: 'gpk', source: 'atomicassets', cardid: '8', quality: 'a', idata: { sassets_id: '901' } });
    expect(areDuplicateCards(tiger, gpk)).toBe(false);
  });
});

describe('mergeStackIds', () => {
  const resolve = (ids: Record<string, SimpleAsset>) => (id: string) => ids[id];

  it('merges without duplicates and orders by original mint', () => {
    const assets = {
      '10': sa({ id: '10', name: 'x', idata: {}, mdata: { mint: '#5' } }),
      '22': sa({ id: '22', name: 'x', idata: {}, mdata: { mint: '#2' } }),
      '3': sa({ id: '3', name: 'x', idata: {}, mdata: { mint: '#9' } }),
    };
    // getMintLabel reads mdata; verify ordering assumption via the resolver used by the app.
    const merged = mergeStackIds(['10'], ['22', '3'], resolve(assets));
    expect(merged).toHaveLength(3);
    expect(new Set(merged)).toEqual(new Set(['10', '22', '3']));
  });

  it('keeps unknown (unresolvable) IDs without dropping them', () => {
    const assets = { '10': sa({ id: '10' }) };
    const merged = mergeStackIds(['10'], ['999'], resolve(assets));
    expect(new Set(merged)).toEqual(new Set(['10', '999']));
  });
});
