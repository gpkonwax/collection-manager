import { describe, expect, it } from 'vitest';
import { isExpressTrade, parseExpressTradeGift } from '@/lib/expressTrade';

describe('WAX ExpressTrade', () => {
  it('reads the gift memo and recipient from trade::creategift', () => {
    const g = parseExpressTradeGift([
      { act: { account: 'trade', name: 'enabletoken', data: {} } },
      { act: { account: 'simpleassets', name: 'transfer', data: { from: 'fvdau.wam', to: 'trade', memo: '' } } },
      { act: { account: 'trade', name: 'creategift', data: { account_to: 'kreau.wam', memo: 'Fulfilling your eBay purchase.  Positive feedback would be appreciated.' } } },
    ]);
    expect(g).toEqual({ to: 'kreau.wam', memo: 'Fulfilling your eBay purchase. Positive feedback would be appreciated.' });
  });
  it('returns null without a creategift action', () => {
    expect(parseExpressTradeGift([{ act: { account: 'simpleassets', name: 'transfer', data: {} } }])).toBeNull();
  });
  it('only treats SimpleAssets moves through `trade` as ExpressTrade', () => {
    expect(isExpressTrade({ chain: 'sa', from: 'fvdau.wam', to: 'trade' })).toBe(true);
    expect(isExpressTrade({ chain: 'sa', from: 'trade', to: 'kreau.wam' })).toBe(true);
    expect(isExpressTrade({ chain: 'aa', from: 'a', to: 'trade' })).toBe(false);
    expect(isExpressTrade({ chain: 'sa', from: 'a', to: 'b' })).toBe(false);
  });
});
