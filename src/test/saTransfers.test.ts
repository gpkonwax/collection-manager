import { describe, it, expect } from 'vitest';
import { findIncoming, parseSavedRow } from '@/lib/saTransfers';
import { extractGpkTransfers, mergeTransfers } from '../../scripts/lib/saTransfers.mjs';

const act = (from: string, to: string, ids: string[], ts = '2021-06-09T02:37:47.500') => ({
  '@timestamp': ts, trx_id: 'a'.repeat(64), act: { account: 'simpleassets', name: 'transfer', data: { from, to, assetids: ids, memo: 'm' } },
});

describe('saTransfers', () => {
  it('finds the transfer that delivered a card to its owner', () => {
    const r = findIncoming([act('x.wam', 'other', ['1']), act('dk2au.wam', 'yaor4.wam', ['5', '7'])], '7', 'yaor4.wam');
    expect(r).toMatchObject({ from: 'dk2au.wam', to: 'yaor4.wam', time: Date.parse('2021-06-09T02:37:47.500Z') });
    expect(findIncoming([act('yaor4.wam', 'b.wam', ['7'])], '7', 'yaor4.wam')).toBeNull();
  });
  it('keeps only GPK cards and de-dupes on merge', () => {
    const rows = extractGpkTransfers([act('a.wam', 'b.wam', ['1', '2'])], (id: string) => id === '2');
    expect(rows).toHaveLength(1);
    const store = { assets: {} as Record<string, unknown[]>, count: 0 };
    expect(mergeTransfers(store, rows)).toBe(1);
    expect(mergeTransfers(store, rows)).toBe(0);
    expect(parseSavedRow(store.assets['2'][0])).toMatchObject({ from: 'a.wam', to: 'b.wam', memo: 'm' });
    expect(parseSavedRow([0, 'a', 'b'])).toBeNull();
  });
});
