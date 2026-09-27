import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewWalletControl } from '../components/ViewWalletControl';
import { addFavorite, loadFavorites } from '../lib/favoriteAccounts';

vi.mock('../lib/activeWallets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/activeWallets')>();
  return {
    ...actual,
    getCachedActiveWallets: () => null,
    clearCachedActiveWallets: () => {},
    fetchActiveWallets: vi.fn(async () => ({ wallets: [] })),
  };
});

vi.mock('../lib/gpkHolders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/gpkHolders')>();
  return { ...actual, getCachedHolders: () => null, clearCachedHolders: () => {} };
});

describe('ViewWalletControl — Favourites list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows the Favourites toggle with count and empty-state hint', () => {
    render(
      <ViewWalletControl currentAccount="me.wam" viewedAccount={null} onView={() => {}} onClear={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /view wallet/i }));
    fireEvent.click(screen.getByText(/Favourites \(0\)/i));
    expect(screen.getByText(/No favourites yet/i)).toBeTruthy();
  });

  it('starring the typed account adds it to the list', () => {
    render(
      <ViewWalletControl currentAccount="me.wam" viewedAccount={null} onView={() => {}} onClear={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /view wallet/i }));
    const input = screen.getByPlaceholderText('e.g. someuser.wam') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'alice.wam' } });
    fireEvent.click(screen.getByRole('button', { name: /add to favourites/i }));
    expect(loadFavorites().map((f) => f.account)).toEqual(['alice.wam']);

    fireEvent.click(screen.getByText(/Favourites \(1\)/i));
    expect(screen.getByText('alice.wam')).toBeTruthy();
  });

  it('clicking a favourite fills the input box', () => {
    addFavorite('bob.wam');
    render(
      <ViewWalletControl currentAccount="me.wam" viewedAccount={null} onView={() => {}} onClear={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /view wallet/i }));
    fireEvent.click(screen.getByText(/Favourites \(1\)/i));
    fireEvent.click(screen.getByText('bob.wam'));
    const input = screen.getByPlaceholderText('e.g. someuser.wam') as HTMLInputElement;
    expect(input.value).toBe('bob.wam');
  });

  it('unstarring from the list removes the favourite', () => {
    addFavorite('carol.wam');
    render(
      <ViewWalletControl currentAccount="me.wam" viewedAccount={null} onView={() => {}} onClear={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /view wallet/i }));
    fireEvent.click(screen.getByText(/Favourites \(1\)/i));
    fireEvent.click(screen.getByRole('button', { name: /remove carol\.wam from favourites/i }));
    expect(loadFavorites()).toHaveLength(0);
  });
});
