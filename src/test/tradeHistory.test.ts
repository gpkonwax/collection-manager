import { describe, it, expect } from 'vitest';
import { parseSale, parseTransfer, formatTokenAmount } from '@/lib/tradeHistory';
describe('tradeHistory', () => {
  it('formats token amounts', () => {
    expect(formatTokenAmount('619000000', 8, 'WAX')).toBe('6.19 WAX');
    expect(formatTokenAmount('5', 8, 'WAX')).toBe('0.00000005 WAX');
    expect(formatTokenAmount('300000000', 8, 'WAX')).toBe('3 WAX');
  });
  it('parses a real sale and transfer', () => {
    const s = parseSale({ sale_id: '19660417', seller: '5wjqw.wam', buyer: 'pxawpxawpxaw', updated_at_time: '1791113208500', price: { token_symbol: 'WAX', token_precision: 8, amount: '619000000' } });
    expect(s).toMatchObject({ price: '6.19 WAX', seller: '5wjqw.wam', buyer: 'pxawpxawpxaw', time: 1791113208500 });
    expect(parseTransfer({ transfer_id: '1', sender_name: '3ngqu.wam', recipient_name: 'ytoqw.wam', memo: '', txid: 'ab', created_at_time: '1789350902000' })).toMatchObject({ from: '3ngqu.wam', to: 'ytoqw.wam' });
    expect(parseSale({ seller: '', updated_at_time: '1' })).toBeNull();
  });
});
