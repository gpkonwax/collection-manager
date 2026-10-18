import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TradeHistorySection } from '@/components/simpleassets/TradeHistorySection';

vi.mock('@/lib/tradeHistory', () => ({
  HISTORY_LIMIT: 500,
  fetchTradeHistory: async () => ({
    sales: [{ id: '92217954', time: 1664896669500, price: '199 WAX', amount: '199', token: 'WAX', seller: 'guz22.wam', buyer: 'le1qu.wam' }],
    transfers: [
      { id: 'escrow', time: 1664896669500, from: 'guz22.wam', to: 'atomicmarket', memo: 'Accepted Offer ID: 95573477', txid: 'sale-tx' },
      { id: 'delivery', time: 1664896669500, from: 'atomicmarket', to: 'le1qu.wam', memo: 'AtomicMarket Purchased Sale - ID # 92217954', txid: 'sale-tx' },
    ],
  }),
}));
vi.mock('@/lib/aaHistory', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/aaHistory')>(),
  getAaCardHistory: async () => null,
  fetchLiveAaOpening: async () => null,
}));
vi.mock('@/lib/waxUsd', () => ({ saleUsd: async () => undefined, fmtUsd: () => '' }));

describe('AtomicMarket custody display control', () => {
  it('keeps the 199 WAX sale visible while the listings control reveals and hides escrow', async () => {
    localStorage.clear();
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    render(<TradeHistorySection assetId="1099795623168" isAtomic owner="le1qu.wam" />);
    const expand = await screen.findByRole('button', { name: /Show listings & cancellations/ });
    expect(screen.queryByText('atomicmarket')).toBeNull();
    expect(screen.getByText('199 WAX')).toBeInTheDocument();
    fireEvent.click(expand);
    const escrowAccount = screen.getByText('atomicmarket');
    const escrow = escrowAccount.closest('li');
    expect(escrow).not.toBeNull();
    if (!escrow) throw new Error('Escrow milestone missing');
    expect(within(escrow).getByText('guz22.wam')).toBeInTheDocument();
    expect(screen.getByText('199 WAX')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Milestones only' }));
    expect(screen.queryByText('atomicmarket')).toBeNull();
    expect(screen.getByText('199 WAX')).toBeInTheDocument();
  });
});