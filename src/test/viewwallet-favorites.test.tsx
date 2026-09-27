import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ViewWalletControl } from '../components/ViewWalletControl';
import { addFavorite, loadFavorites, parseFavoritesEnvelope } from '../lib/favoriteAccounts';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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

  it('export downloads a valid favourites envelope', async () => {
    addFavorite('dave.wam');
    const created: Blob[] = [];
    const createObjectURL = vi.fn((b: Blob) => { created.push(b); return 'blob:mock'; });
    // jsdom lacks URL.createObjectURL
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
    try {
      render(
        <ViewWalletControl currentAccount="me.wam" viewedAccount={null} onView={() => {}} onClear={() => {}} />,
      );
      fireEvent.click(screen.getByRole('button', { name: /view wallet/i }));
      fireEvent.click(screen.getByText(/Favourites \(1\)/i));
      fireEvent.click(screen.getByRole('button', { name: /^export$/i }));
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const text = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsText(created[0]);
      });
      expect(parseFavoritesEnvelope(JSON.parse(text))!.map((f) => f.account)).toEqual(['dave.wam']);
    } finally {
      // Restore defaults for other tests
      Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
    }
  });

  it('import merges accounts from a favourites JSON file', async () => {
    render(
      <ViewWalletControl currentAccount="me.wam" viewedAccount={null} onView={() => {}} onClear={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /view wallet/i }));
    fireEvent.click(screen.getByText(/Favourites \(0\)/i));
    const file = new File(
      [JSON.stringify({
        type: 'gpk-favorite-accounts',
        version: 1,
        exportedAt: new Date().toISOString(),
        accounts: [{ account: 'erin.wam', addedAt: new Date().toISOString() }],
      })],
      'gpk-favorite-accounts.json',
      { type: 'application/json' },
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    await waitFor(() => fireEvent.change(input, { target: { files: [file] } }));
    await waitFor(() => expect(loadFavorites().map((f) => f.account)).toEqual(['erin.wam']));
    expect(screen.getByText('erin.wam')).toBeTruthy();
  });

  it('importing a non-favourites JSON changes nothing', async () => {
    render(
      <ViewWalletControl currentAccount="me.wam" viewedAccount={null} onView={() => {}} onClear={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /view wallet/i }));
    fireEvent.click(screen.getByText(/Favourites \(0\)/i));
    const file = new File([JSON.stringify({ alerts: [] })], 'alerts.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await waitFor(() => fireEvent.change(input, { target: { files: [file] } }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That file is not a favourites export'));
    expect(loadFavorites()).toHaveLength(0);
  });
});
