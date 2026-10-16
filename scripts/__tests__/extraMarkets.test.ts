// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fixtures from './fixtures-extra-markets.json';
// @ts-expect-error — shared .mjs scanner
import { classifyAction, buildTimelines, canRefreshHistory } from '../lib/saHistory.mjs';

const ID = '100000004472192';
const TX = 'a'.repeat(64);
const action = (seq: number, account: string, name: string, data: Record<string, unknown>, tx = TX) => ({
  '@timestamp': '2020-11-22T12:00:00.000', global_sequence: seq, trx_id: tx, act: { account, name, data },
});
const classify = (a: unknown) => classifyAction(a, () => true);
const move = (seq: number, from: string, to: string, memo: string) => action(seq, 'simpleassets', 'transfer', { from, to, assetids: [ID], memo });

describe('historical marketplaces', () => {
  it('reconstructs the 97 WAX WAXStash sale, not the 95.06 WAX seller payout', () => {
    const rows = [
      move(1, 'intqi.wam', 'waxstashsale', '97'),
      action(2, 'eosio.token', 'transfer', { from: 'gz52k.wam', to: 'waxstashsale', quantity: '97.00000000 WAX', memo: `Id:${ID} Author:gpk.topps` }),
      move(3, 'waxstashsale', 'gz52k.wam', `PURCHASED ASSET# ${ID}`),
      action(4, 'eosio.token', 'transfer', { from: 'waxstashsale', to: 'intqi.wam', quantity: '95.06000000 WAX', memo: `SOLD ASSET# ${ID}` }),
    ].flatMap(classify);
    // Prior broad scan stored the identical delivery as a plain transfer.
    rows.push([rows[2][0], 3, 'transfer', ID, 'waxstashsale', 'gz52k.wam', '', '', '', `PURCHASED ASSET# ${ID}`, TX]);
    const timeline = buildTimelines(rows).get(ID);
    expect(timeline.map((r: unknown[]) => r[1])).toEqual(['list', 'sale']);
    expect(timeline[1].slice(1, 7)).toEqual(['sale', 'intqi.wam', 'gz52k.wam', '97', 'WAX', 'waxstash']);
  });

  it('never substitutes an ask or an unrelated transaction for a WAXStash purchase price', () => {
    const rows = [move(1, 'intqi.wam', 'waxstashsale', '97'), move(3, 'waxstashsale', 'gz52k.wam', `PURCHASED ASSET# ${ID}`),
      action(2, 'eosio.token', 'transfer', { from: 'gz52k.wam', to: 'waxstashsale', quantity: '100.00000000 WAX', memo: `Id:${ID} Author:gpk.topps` }, 'b'.repeat(64))].flatMap(classify);
    expect(buildTimelines(rows).get(ID)[1].slice(4, 6)).toEqual(['', '']);
  });

  it('reconstructs the verified Collectables.io purchase and seller from one transaction', () => {
    const rows = fixtures.filter((a) => a.trx_id === fixtures[0].trx_id).flatMap(classify);
    const timeline = buildTimelines(rows).get('100000004996366');
    expect(timeline).toHaveLength(1);
    expect(timeline[0].slice(1, 7)).toEqual(['sale', '33kaw.wam', 'twmqw.wam', '20', 'WAX', 'cio']);
  });

  it('does not infer a sale from a Collectables.io withdrawal alone', () => {
    const rows = fixtures.filter((a) => a.act.name !== 'buy').flatMap(classify);
    expect(buildTimelines(rows).get('100000004996366').some((r: unknown[]) => r[1] === 'sale')).toBe(false);
  });

  it('does not attribute a bundle total to each card', () => {
    const acts = fixtures.filter((a) => a.trx_id === fixtures[0].trx_id).map((a) =>
      a.act.name === 'withdraw' ? { ...a, act: { ...a.act, data: { ...a.act.data, assets: [{ id: ID, contract: 'simpleassets' }, { id: '100000004996366', contract: 'simpleassets' }] } } } : a);
    expect(buildTimelines(acts.flatMap(classify)).get(ID)[0].slice(4, 6)).toEqual(['', '']);
  });

  it('reads the verified auction win as 30 WAX and expired auctions as cancellations', () => {
    const rows = fixtures.filter((a) => a.act.account === 'simpleassets' && JSON.stringify(a).includes('gpk.market')).flatMap(classify);
    const timeline = buildTimelines(rows).get('100000004398714');
    expect(timeline.find((r: unknown[]) => r[1] === 'sale').slice(3, 7)).toEqual(['cm2au.wam', '30', 'WAX', 'gpkauction']);
    expect(rows.some((r: unknown[]) => r[2] === 'cancel')).toBe(true);
  });

  it('allows partial market rescans to resume after the initial backfill but not before', () => {
    expect(canRefreshHistory({ complete: true })).toBe(true);
    expect(canRefreshHistory({ complete: false, initialBackfillComplete: true })).toBe(true);
    expect(canRefreshHistory({ complete: false })).toBe(false);
  });
});