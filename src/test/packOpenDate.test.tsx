import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

// The provenance date is what this test checks, so the chain lookups are stubbed
// empty and the opener comes straight from the props.
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

const OPENED_MS = Date.UTC(2021, 3, 11, 5, 30);

/** The "Pack opened" box (the timeline <li> holding that label). */
const packBox = async () => {
  const label = await screen.findByText('Pack opened');
  const box = label.closest('li');
  expect(box).toBeTruthy();
  return box as HTMLElement;
};

const renderSection = (openedAt?: number) =>
  render(
    <TradeHistorySection
      assetId="100000004472192"
      isAtomic={false}
      owner="owner.wam"
      opener="opener.wam"
      openedAt={openedAt}
    />,
  );

describe('pack opened date', () => {
  it('shows the provenance opening date at the top of the box', async () => {
    renderSection(OPENED_MS);
    await screen.findByRole('button', { name: 'Hide history' });
    const box = await packBox();
    // Same "11 Apr 2021" wording the other timeline boxes use.
    expect(box.textContent).toContain('11 Apr 2021');
  });

  it('leaves the date blank when the opening time is unknown', async () => {
    renderSection(undefined);
    await screen.findByRole('button', { name: 'Hide history' });
    const box = await packBox();
    expect(box.textContent).not.toMatch(/\b\d{1,2} [A-Z][a-z]{2} \d{4}\b/);
  });
});
