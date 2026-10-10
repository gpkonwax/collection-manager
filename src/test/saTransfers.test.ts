import { describe, it, expect } from 'vitest';
import { findIncoming, parseSavedRow } from '@/lib/saTransfers';

const act = (from: string, to: string, ids: string[], ts = '2021-06-09T02:37:47.500') => ({
  '@timestamp': ts, trx_id: 'a'.repeat(64), act: { account: 'simpleassets', name: 'transfer', data: { from, to, assetids: ids, memo: 'm' } },
});

describe('saTransfers', () => {
  it('finds the transfer that delivered a card to its owner', () => {
    const r = findIncoming([act('x.wam', 'other', ['1']), act('dk2au.wam', 'yaor4.wam', ['5', '7'])], '7', 'yaor4.wam');
    expect(r).toMatchObject({ from: 'dk2au.wam', to: 'yaor4.wam', time: Date.parse('2021-06-09T02:37:47.500Z') });
    expect(findIncoming([act('yaor4.wam', 'b.wam', ['7'])], '7', 'yaor4.wam')).toBeNull();
  });
  it('rejects malformed saved rows', () => {
    expect(parseSavedRow([1600000000000, 'a.wam', 'b.wam', 'm', ''])).toMatchObject({ from: 'a.wam', to: 'b.wam', memo: 'm' });
    expect(parseSavedRow([0, 'a', 'b'])).toBeNull();
  });
});
