import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveReplayMintLabels } from '@/lib/replayMints';
import type { PackHistoryEntry } from '@/lib/packOpenHistory';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

const resolve = vi.fn();
vi.mock('@/lib/saMintResolver', () => ({
  resolveSaMintsForAssets: (...args: unknown[]) => resolve(...args),
  describeMintSource: () => 'saved backup',
}));

const entry = (source: PackHistoryEntry['source'], ids: string[]): PackHistoryEntry => ({
  txId: 'tx', account: 'wallet', source, packName: 'Pack', openedAt: 1, matchers: [],
  cards: ids.map((id) => ({ id, name: 'Card', image: null })),
});
const asset = (id: string, source: SimpleAsset['source'], mintNumber?: number): SimpleAsset => ({
  id, source, mintNumber, owner: 'wallet', author: 'gpk.topps', category: 'series2',
  name: 'Card', image: '', images: [], cardid: '1', quality: 'base', side: 'a',
  idata: {}, mdata: {}, container: [], containerf: [],
});

beforeEach(() => resolve.mockReset().mockResolvedValue(new Map()));

describe('pack history replay mint labels', () => {
  it('uses the same original mint as the grid for a card still owned', async () => {
    expect(await resolveReplayMintLabels(entry('simpleassets', ['1000001']), [asset('1000001', 'simpleassets', 42)])).toEqual(['#42']);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('resolves an old SimpleAsset id even after the card left the wallet', async () => {
    resolve.mockResolvedValue(new Map([['0', { mint: 96 }]]));
    expect(await resolveReplayMintLabels(entry('simpleassets', ['1000001']), [])).toEqual(['#96']);
    expect(resolve).toHaveBeenCalledWith([{ assetId: '0', sassetsId: '1000001' }]);
  });

  it('never substitutes the bridge mint for an unresolved original mint', async () => {
    const bridged = { ...asset('aa1', 'atomicassets'), idata: { bridge_mint: '15', sassets_id: '1000001' } };
    expect(await resolveReplayMintLabels(entry('atomicassets', ['aa1']), [bridged])).toEqual(['#--']);
    expect(resolve).toHaveBeenCalledWith([{ assetId: '0', sassetsId: '1000001' }]);
  });

  it('uses the resolved original mint for bridged AtomicAssets', async () => {
    const bridged = { ...asset('aa1', 'atomicassets', 88), idata: { bridge_mint: '15' } };
    expect(await resolveReplayMintLabels(entry('atomicassets', ['aa1']), [bridged])).toEqual(['#88']);
  });
});