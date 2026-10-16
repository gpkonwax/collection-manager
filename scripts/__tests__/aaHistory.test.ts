// @vitest-environment node
import { describe, it, expect } from 'vitest';
// @ts-expect-error — shared .mjs scanner
import { classifyAaAction, classifyAhSale, classifyAhTransfer, unboxAssocId, buildAaCards, canRefreshHistory, PACK_RULES, UNBOX_PACKS, POOL } from '../lib/aaHistory.mjs';
import * as app from '../../src/lib/aaHistory';

const TX = 'b'.repeat(64);
const act = (seq: number, name: string, data: Record<string, unknown>, ts = '2026-04-11T00:26:10.500', tx = TX) => ({
  '@timestamp': ts, global_sequence: seq, trx_id: tx, act: { account: 'atomicassets', name, data: { collection_name: 'gpk.topps', ...data } },
});

describe('AtomicAssets history scanner', () => {
  it('turns a logmint into a mint row with minter, recipient and schema:template', () => {
    const rows = classifyAaAction(act(1, 'logmint', { asset_id: '1099984984103', authorized_minter: 'premint.nft', new_asset_owner: 'guydgnjzgage', schema_name: 'foodfightb', template_id: 59094 }));
    expect(rows).toEqual([[Date.parse('2026-04-11T00:26:10.500Z'), 1, 'mint', '1099984984103', 'premint.nft', 'guydgnjzgage', '', '', '', TX, 'foodfightb:59094']]);
  });

  it('ignores other collections', () => {
    expect(classifyAaAction({ ...act(1, 'logmint', { asset_id: '1', new_asset_owner: 'a' }), act: { account: 'atomicassets', name: 'logmint', data: { collection_name: 'other', asset_id: '1', new_asset_owner: 'abc' } } })).toEqual([]);
  });

  it('prices only settled market records that have a buyer', () => {
    const sale = { sale_id: '42', updated_at_time: '1790009466000', seller: 'sellr.wam', buyer: 'buyr.wam', price: { amount: '235000000000', token_precision: 8, token_symbol: 'WAX' }, assets: [{ asset_id: '1099795623168', collection: { collection_name: 'gpk.topps' } }] };
    expect(classifyAhSale(sale, 'sale')[0].slice(4, 8)).toEqual(['sellr.wam', 'buyr.wam', '2350', 'WAX']);
    // A listing with no buyer is never a sale.
    expect(classifyAhSale({ ...sale, buyer: null }, 'sale')).toEqual([]);
  });

  it('keeps AtomicHub transfers of gpk.topps assets only', () => {
    const t = { created_at_time: '1594155222000', sender_name: 'lc4l.wam', recipient_name: 'atomicbridge', memo: 'swap', txid: TX, assets: [{ asset_id: '1099511631922', collection: { collection_name: 'gpk.topps' } }, { asset_id: '9', collection: { collection_name: 'x' } }] };
    expect(classifyAhTransfer(t)[0][3]).toBe('1099511631922');
  });

  it('finds the WinterCon pack claimed in an unbox transaction', () => {
    expect(unboxAssocId([{ act: { account: 'unbox.nft', name: 'claim', data: { from: 'guydgnjzgage', collection_name: 'gpk.topps', assoc_id: '1099518259839' } } }])).toBe('1099518259839');
    expect(unboxAssocId([])).toBe('');
  });

  it('records an unbox.nft opening with the exact WinterCon pack', () => {
    const rows = classifyAaAction(act(1, 'logmint', { asset_id: '1099984984103', authorized_minter: 'premint.nft', new_asset_owner: 'guydgnjzgage', schema_name: 'foodfightb', template_id: 59094 }));
    const cards = buildAaCards(rows, {}, { [TX]: '59490' });
    expect(cards.get('1099984984103').m).toEqual(['open', Date.parse('2026-04-11T00:26:10.500Z'), 'guydgnjzgage', 'premint.nft', '59490', TX]);
  });

  it('never treats a bridge mint as a pack opening', () => {
    const rows = classifyAaAction(act(1, 'logmint', { asset_id: '7', authorized_minter: 'atomicbridge', new_asset_owner: 'ajgqu.wam', schema_name: 'exotic', template_id: 720 }));
    expect(buildAaCards(rows).get('7')?.m).toBeUndefined();
  });

  it('a pool mint opens when the pool delivers it, to the recipient', () => {
    const mint = classifyAaAction(act(1, 'logmint', { asset_id: '8', authorized_minter: POOL, new_asset_owner: POOL, schema_name: 'gamestonk', template_id: 53142 }, '2021-02-10T00:03:16.500'));
    const delivery = classifyAaAction(act(2, 'logtransfer', { from: POOL, to: 'opener.wam', asset_ids: ['8'], memo: '' }, '2021-02-11T10:00:00.000', 'c'.repeat(64)));
    expect(buildAaCards([...mint, ...delivery]).get('8').m).toEqual(['open', Date.parse('2021-02-11T10:00:00.000Z'), 'opener.wam', POOL, '53187', 'c'.repeat(64)]);
  });

  it('a Crash Gordon card before the notify account is matched to gpkcrashpack', () => {
    const cmint = [1598634832000, 5, 'cmint', '', 'gpkcrashpack', 'humqk.wam', '', '', '', TX, 'crashgordon:13755'];
    const cards = buildAaCards([cmint], { 1099511932076: ['13755', 'crashgordon', 1598634832000, 0, '', '', 'humqk.wam'] });
    expect(cards.get('1099511932076').m).toEqual(['open', 1598634832000, 'humqk.wam', 'gpkcrashpack', '13778', TX]);
  });

  it('a non-pack mint is a plain mint, not an opening', () => {
    const rows = classifyAaAction(act(1, 'logmint', { asset_id: '9', authorized_minter: 'gpk.topps', new_asset_owner: 'fan.wam', schema_name: 'promo', template_id: 1 }));
    expect(buildAaCards(rows).get('9').m[0]).toBe('mint');
  });

  it('records a burn', () => {
    const rows = classifyAaAction(act(1, 'logburnasset', { asset_id: '10', asset_owner: 'burner.wam' }));
    expect(buildAaCards(rows).get('10').b[1]).toBe('burner.wam');
  });

  it('only refreshes after the initial backfill', () => {
    expect(canRefreshHistory({})).toBe(false);
    expect(canRefreshHistory({ initialBackfillComplete: true })).toBe(true);
  });

  it('app and scanner use the same pack rules', () => {
    expect(app.PACK_RULES).toEqual(PACK_RULES);
    expect([...app.UNBOX_PACKS].sort()).toEqual([...UNBOX_PACKS].sort());
    expect(app.POOL).toBe(POOL);
  });
});
