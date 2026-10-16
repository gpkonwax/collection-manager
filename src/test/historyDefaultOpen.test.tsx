import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TradeHistorySection } from '@/components/simpleassets/TradeHistorySection';

// jsdom has no layout and no ResizeObserver; the timeline measures its row to
// decide how many cards fit. Force the detail modal's width.
const realWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { value: 1036, configurable: true });
  (globalThis as Record<string, unknown>).ResizeObserver = RO;
});
afterAll(() => {
  if (realWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', realWidth);
});


// Data sources are stubbed: this test is only about whether the section starts
// open and whether the Hide/Show button still collapses it.
vi.mock('@/lib/tradeHistory', () => ({
  HISTORY_LIMIT: 500,
  fetchTradeHistory: () => Promise.resolve({ sales: [], transfers: [] }),
}));
vi.mock('@/lib/saHistory', () => ({
  MARKET_NAMES: {},
  getSaCardHistory: () => Promise.resolve({ events: [], complete: true }),
}));
vi.mock('@/lib/saTransfers', () => ({
  getSavedSaTransfers: () => Promise.resolve([]),
  fetchIncomingSaTransfer: () => Promise.resolve({ kind: 'none' }),
}));

const renderSection = () =>
  render(
    <TradeHistorySection
      assetId="100000004472192"
      isAtomic={false}
      owner="owner.wam"
      opener="opener.wam"
    />,
  );

describe('asset history default state', () => {
  it('is already open when the detail opens, and the button still hides it', async () => {
    const { container } = renderSection();

    // Open by default: the button offers to hide, and the history body is on screen.
    const toggle = await screen.findByRole('button', { name: 'Hide history' });
    await waitFor(() => expect(screen.getByText('How the current owner got it')).toBeTruthy());
    expect(container.textContent).toContain('No transfer to the current owner found');

    fireEvent.click(toggle);
    expect(screen.queryByText('How the current owner got it')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show history' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show history' }));
    await waitFor(() => expect(screen.getByText('How the current owner got it')).toBeTruthy());
  });

  it('reopens by default when the detail switches to another card', async () => {
    const { rerender } = renderSection();
    await screen.findByRole('button', { name: 'Hide history' });
    fireEvent.click(screen.getByRole('button', { name: 'Hide history' }));
    expect(screen.getByRole('button', { name: 'Show history' })).toBeTruthy();

    rerender(
      <TradeHistorySection
        assetId="1099795623168"
        isAtomic={false}
        owner="le1qu.wam"
        opener="opener.wam"
      />,
    );
    await waitFor(() => expect(screen.getByText('How the current owner got it')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Hide history' })).toBeTruthy();
  });
});
