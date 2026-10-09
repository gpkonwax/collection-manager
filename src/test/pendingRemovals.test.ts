import { describe, it, expect } from 'vitest';
import { hideRemoved, pruneRemoved, addPackCap, applyPackCaps, prunePackCaps, hideRemovedAtomicPacks, PACK_CAP_TTL_MS } from '@/lib/pendingRemovals';

describe('optimistic removal after send/burn/bridge', () => {
  it('sent cards disappear immediately', () => {
    expect(hideRemoved([{ id: '1' }, { id: '2' }], new Set(['1']))).toEqual([{ id: '2' }]);
  });

  it('stops hiding an ID once the refetch no longer has it', () => {
    expect([...pruneRemoved(new Set(['1', '2']), ['2', '3'])]).toEqual(['2']);
  });

  it('token pack count drops by the sent quantity right away', () => {
    const caps = addPackCap(new Map(), 'GPKFIVE', 5, 2, 0);
    expect(applyPackCaps([{ symbol: 'GPKFIVE', amount: 5 }], caps, 1)[0].amount).toBe(3);
  });

  it('keeps the cap until the fetched balance drops, then releases it', () => {
    const caps = addPackCap(new Map(), 'GPKFIVE', 5, 2, 0);
    expect(prunePackCaps(caps, [{ symbol: 'GPKFIVE', amount: 5 }], 1).size).toBe(1);
    expect(prunePackCaps(caps, [{ symbol: 'GPKFIVE', amount: 3 }], 1).size).toBe(0);
  });

  it('cap expires so later incoming packs are not hidden forever', () => {
    const caps = addPackCap(new Map(), 'GPKFIVE', 5, 2, 0);
    expect(applyPackCaps([{ symbol: 'GPKFIVE', amount: 5 }], caps, PACK_CAP_TTL_MS + 1)[0].amount).toBe(5);
  });

  it('AtomicAssets pack count decreases and mints stay aligned', () => {
    const [p] = hideRemovedAtomicPacks([{ assetIds: ['a', 'b', 'c'], mints: [1, 2, 3], count: 3 }], new Set(['b']));
    expect(p).toEqual({ assetIds: ['a', 'c'], mints: [1, 3], count: 2 });
  });
});
