// @vitest-environment node
import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
// @ts-expect-error — .mjs source with no types
import { parsePackTransaction, parsePoolTransfer, parsePackMintLog, parseBridgeMintLog, mergeRows, writeStore, loadStore, hyperionMs } from '../lib/provenance.mjs';

const createlog = (assetid: string, owner = 'dk2au.wam', author = 'gpk.topps') => ({
  '@timestamp': '2020-05-12T13:54:55.500',
  act: { account: 'simpleassets', name: 'createlog', data: { author, owner, category: 'series1', assetid } },
});

describe('provenance parsers', () => {
  it('reads Hyperion timestamps as UTC', () => {
    expect(hyperionMs('2020-05-12T13:54:55.500')).toBe(Date.UTC(2020, 4, 12, 13, 54, 55, 500));
  });
  it('records every gpk.topps card in a pack transaction with the pack size', () => {
    const rows = parsePackTransaction([
      { act: { account: 'gpk.topps', name: 'getcards', data: {} } },
      createlog('100000004390402'), createlog('100000004390403'), createlog('100000004390403'),
      createlog('100000009999999', 'x.wam', 'someone.else'),
    ], 'dk2au.wam');
    expect(rows).toEqual([
      { id: '100000004390402', o: 'dk2au.wam', t: 1589291695500, p: 'series1', n: 2 },
      { id: '100000004390403', o: 'dk2au.wam', t: 1589291695500, p: 'series1', n: 2 },
    ]);
  });
  it('returns nothing for an empty (pruned-node) transaction', () => {
    expect(parsePackTransaction([], 'a.wam')).toEqual([]);
  });
  it('reads pool pack openings by memo, using the card mint time', () => {
    const rows = parsePoolTransfer({ sender_name: 'gpkpools1111', recipient_name: 'omur2.wam', memo: 'Food Fight! Pack Opening',
      assets: [{ asset_id: '1', minted_at_time: '1614101548500' }, { asset_id: '2', minted_at_time: '1614101548500' }] });
    expect(rows).toEqual([
      { id: '1', o: 'omur2.wam', t: 1614101548500, p: 'Food Fight!', n: 2 },
      { id: '2', o: 'omur2.wam', t: 1614101548500, p: 'Food Fight!', n: 2 },
    ]);
    expect(parsePoolTransfer({ sender_name: 'gpkpools1111', recipient_name: 'a.wam', memo: 'refund', assets: [{ asset_id: '1' }] })).toEqual([]);
    expect(parsePoolTransfer({ sender_name: 'other', recipient_name: 'a.wam', memo: 'X Pack Opening', assets: [{ asset_id: '1' }] })).toEqual([]);
  });
  it('only trusts mints made by pack contracts', () => {
    expect(parsePackMintLog({ name: 'logmint', created_at_time: '1598641202000', data: { authorized_minter: 'gpkcrashpack', new_asset_owner: 'superherokog' } }))
      .toEqual({ o: 'superherokog', t: 1598641202000 });
    expect(parsePackMintLog({ name: 'logmint', data: { authorized_minter: 'air.atomic', new_asset_owner: 'air.atomic' } })).toBeNull();
    expect(parseBridgeMintLog({ name: 'logmint', data: { new_asset_owner: '3ngqu.wam' } })).toBe('3ngqu.wam');
  });
  it('never overwrites a recorded opener, but fills in a bridger', () => {
    const m = new Map([['5', { o: 'first.wam', t: 1 }]]);
    mergeRows(m, [{ id: '5', o: 'second.wam', b: 'br.wam' }]);
    expect(m.get('5')).toEqual({ o: 'first.wam', t: 1, b: 'br.wam' });
  });
  it('round-trips the sharded store with cursors', async () => {
    const dir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'prov-')), 'provenance');
    const entries = new Map([['100000004390402', { o: 'dk2au.wam' }], ['1099515153402', { o: 'b.wam' }]]);
    const idx = await writeStore(dir, { entries, cursors: { sa: { after: 'x', trx: [] } }, complete: { pool: true } });
    expect(idx.shards['402'].count).toBe(2);
    const back = await loadStore(dir);
    expect(back.entries.get('1099515153402')).toEqual({ o: 'b.wam' });
    expect(back.cursors.sa.after).toBe('x');
    expect(back.complete.pool).toBe(true);
  });
});
