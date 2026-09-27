import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ViewWalletControl } from '../components/ViewWalletControl';

const mockWallets = [
  { account: 'gp43g.c.wam', lastActive: Date.now() - 3 * 24 * 60 * 60 * 1000, activityCount: 12 },
  { account: 'kvqr.wam', lastActive: Date.now() - 60 * 60 * 1000, activityCount: 4 },
];

vi.mock('../lib/activeWallets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/activeWallets')>();
  return {
    ...actual,
    getCachedActiveWallets: () => null,
    clearCachedActiveWallets: () => {},
    fetchActiveWallets: vi.fn(async () => ({ wallets: mockWallets })),
  };
});

vi.mock('../lib/gpkHolders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/gpkHolders')>();
  return { ...actual, getCachedHolders: () => null, clearCachedHolders: () => {} };
});

describe('ViewWalletControl — Active traders list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the Active traders toggle and loads accounts on expand', async () => {
    render(
      <ViewWalletControl currentAccount="me.wam" viewedAccount={null} onView={() => {}} onClear={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /view wallet/i }));
    fireEvent.click(screen.getByText(/Active traders \(90 days\)/i));

    await waitFor(() => expect(screen.getByText('gp43g.c.wam')).toBeTruthy());
    expect(screen.getByText('kvqr.wam')).toBeTruthy();
    expect(screen.getByText('2 active accounts')).toBeTruthy();
    expect(screen.getByText('3d ago')).toBeTruthy();
    expect(screen.getByText('1h ago')).toBeTruthy();
  });

  it('clicking an account fills the input box', async () => {
    render(
      <ViewWalletControl currentAccount="me.wam" viewedAccount={null} onView={() => {}} onClear={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /view wallet/i }));
    fireEvent.click(screen.getByText(/Active traders \(90 days\)/i));
    await waitFor(() => expect(screen.getByText('gp43g.c.wam')).toBeTruthy());

    fireEvent.click(screen.getByText('gp43g.c.wam'));
    const input = screen.getByPlaceholderText('e.g. someuser.wam') as HTMLInputElement;
    expect(input.value).toBe('gp43g.c.wam');
  });
});
