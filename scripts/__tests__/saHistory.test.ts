// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fixtures from './fixtures-sa-history.json';
// @ts-expect-error — .mjs source with no types
import { classifyAction, buildTimelines, buildSummary, trimAmount, parseQuantity } from '../lib/saHistory.mjs';

const all = () => true;
const rowsFor = (pred: (a: any) => boolean, isGpk = all) =>
  (fixtures as any[]).filter(pred).flatMap((a) => classifyAction(a, isGpk));
const memo = (m: string) => (a: any) => a.act.data.memo === m;

describe('amount parsing', () => {
  it('trims trailing zeros', () => {
    expect(trimAmount('59.00000000')).toBe('59');
    expect(trimAmount('0.14100000')).toBe('0.141');
    expect(parseQuantity('53.10000000 WAX')).toEqual(['53.1', 'WAX']);
    expect(parseQuantity('nonsense')).toEqual(['', '']);
  });
});

describe('GPK market (gpkmarket111)', () => {
  it('reads a sale with its buyer and price', () => {
    const [r] = rowsFor(memo('Purchased for 59 WAX'));
    expect(r.slice(2, 9)).toEqual(['sale', '100000004445680', '', 'drgqu.wam', '59', 'WAX', 'gpk']);
  });
  it('reads a listing with its asking price', () => {
    const r = rowsFor(memo('130.00000000 WAX'));
    expect(r[0].slice(2, 9)).toEqual(['list', '100000004429831', '2mtaq.wam', 'gpkmarket111', '130', 'WAX', 'gpk']);
  });
  it('reads seller payouts and both fees', () => {
    expect(rowsFor(memo('Payment for sale: 100000004445680'))[0].slice(2, 8)).toEqual(['pay', '100000004445680', 'gpkmarket111', 'j2qau.wam', '53.1', 'WAX']);
    expect(rowsFor(memo('Topps Fee #100000004445680'))[0][9]).toBe('Topps Fee');
    expect(rowsFor(memo('Market Fee #100000004445680')).map((r: any[]) => r[9])).toEqual(['Market Fee', 'Market Fee']);
  });
  it('matches each sale to the seller the market paid', () => {
    const rows = (fixtures as any[]).flatMap((a) => classifyAction(a, all));
    const sale = buildTimelines(rows).get('100000004445680').find((r: any[]) => r[1] === 'sale');
    expect(sale.slice(1, 6)).toEqual(['sale', 'j2qau.wam', 'drgqu.wam', '59', 'WAX']);
  });
});

describe('SimpleMarket', () => {
  it('reads buylog sales with seller, buyer and price', () => {
    const [r] = rowsFor((a) => a.act.name === 'buylog');
    expect(r.slice(2, 9)).toEqual(['sale', '100000004885164', 'g.raw.wam', 'l2naw.wam', '10', 'WAX', 'sm']);
  });
  it('rebuilds early sales from the buyer payment and the biggest payout', () => {
    const rows = rowsFor((a) => a.act.account === 'eosio.token' && /nftid|for assetID: 100000004402442/.test(a.act.data.memo));
    const sale = buildTimelines(rows).get('100000004402442').find((r: any[]) => r[1] === 'sale');
    expect(sale.slice(1, 7)).toEqual(['sale', 'i3dqu.wam', 'hvgqu.wam', '30', 'WAX', 'sm']);
  });
});

describe('Myth.Market', () => {
  it('reads logsale with seller, buyer, price and pack category', () => {
    const [r] = rowsFor((a) => a.act.name === 'logsale');
    expect(r.slice(2, 10)).toEqual(['sale', '100000004644944', 'cg1.o.wam', 'nnequ.wam', '35', 'WAX', 'myth', 'shatner']);
  });
  it('ignores Myth sales of other collections', () => {
    const r = rowsFor((a) => a.act.name === 'logsale', () => false).filter(Boolean);
    // author is "shatner" here, so with no known GPK ids it must be dropped
    expect(r).toEqual([]);
  });
});

describe('ownership moves', () => {
  it('marks offers to atomicbridge as bridging, and reads claims and burns', () => {
    expect(rowsFor((a) => a.act.name === 'offer')[0].slice(2, 6)).toEqual(['bridge', '100000004393807', 'lc4l.wam', 'atomicbridge']);
    expect(rowsFor((a) => a.act.name === 'claim')[0].slice(2, 6)).toEqual(['claim', '100000004393807', '', 'atomicbridge']);
    expect(rowsFor((a) => a.act.name === 'burn')[0].slice(2, 6)).toEqual(['burn', '100000004675487', 'givemekbucks', '']);
  });
  it('drops cards that are not GPK', () => {
    expect(rowsFor((a) => a.act.name === 'burn', () => false)).toEqual([]);
  });
});

describe('summary', () => {
  it('totals sales volume and fees', () => {
    const rows = (fixtures as any[]).flatMap((a) => classifyAction(a, all));
    const s = buildSummary(rows, buildTimelines(rows));
    expect(s.totals.sales).toBe(4); // gpk 59, sm buylog 10, early sm 30, myth 35
    expect(s.volume.WAX).toBe(134);
    expect(s.fees['Topps Fee (WAX)']).toBe(9.44);
  });
});
