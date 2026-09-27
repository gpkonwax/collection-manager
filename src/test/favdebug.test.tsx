import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewWalletControl } from '@/components/ViewWalletControl';
import { addFavorite, loadFavorites } from '@/lib/favoriteAccounts';

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

describe('debug', () => {
  it('inspect popover dom', async () => {
    addFavorite('erin.wam');
    render(<ViewWalletControl currentAccount="me.wam" viewedAccount={null} onView={() => {}} onClear={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /view wallet/i }));
    fireEvent.click(screen.getByText(/Favourites \(1\)/i));
    const btns = screen.getAllByRole('button').map((b) => b.textContent);
    console.log('BUTTONS:', JSON.stringify(btns));
    console.log('FILE_INPUTS:', document.querySelectorAll('input[type="file"]').length);
    const inp = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (inp) {
      const file = new File([JSON.stringify({ type: 'gpk-favorite-accounts', version: 1, exportedAt: 'x', accounts: [{ account: 'finn.wam', addedAt: 'y' }] })], 'f.json', { type: 'application/json' });
      fireEvent.change(inp, { target: { files: [file] } });
      await new Promise((r) => setTimeout(r, 200));
      console.log('FAVS_AFTER:', JSON.stringify(loadFavorites().map((f) => f.account)));
    }
    expect(true).toBe(true);
  });
});
