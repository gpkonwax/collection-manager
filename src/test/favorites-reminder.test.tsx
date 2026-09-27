import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FavoritesExportReminder } from '../components/FavoritesExportReminder';
import { addFavorite, removeFavorite, importFavorites, loadFavorites } from '../lib/favoriteAccounts';

describe('FavoritesExportReminder', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows the popup on the first add to a clean list', async () => {
    render(<FavoritesExportReminder />);
    addFavorite('alice.wam');
    await waitFor(() => expect(screen.getByText('Back up your favourites')).toBeTruthy());
    expect(screen.getByRole('button', { name: /export now/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /got it/i })).toBeTruthy();
  });

  it('shows the popup when adding to an already-populated list (new session)', async () => {
    addFavorite('bob.wam');
    sessionStorage.clear(); // simulate a fresh session with existing favourites
    render(<FavoritesExportReminder />);
    addFavorite('carol.wam');
    await waitFor(() => expect(screen.getByText('Back up your favourites')).toBeTruthy());
  });

  it('does not reappear on a second add in the same session', async () => {
    render(<FavoritesExportReminder />);
    addFavorite('alice.wam');
    await waitFor(() => expect(screen.getByText('Back up your favourites')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    await waitFor(() => expect(screen.queryByText('Back up your favourites')).toBeNull());
    addFavorite('dave.wam');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Back up your favourites')).toBeNull();
  });

  it('does not appear on import or removal', async () => {
    render(<FavoritesExportReminder />);
    importFavorites([{ account: 'erin.wam', addedAt: new Date().toISOString() }]);
    addFavorite('frank.wam');
    removeFavorite('frank.wam');
    // import + removal happened; only the add should have triggered (and only once)
    await waitFor(() => expect(screen.getByText('Back up your favourites')).toBeTruthy());
    expect(loadFavorites().map((f) => f.account)).toEqual(['erin.wam']);
  });

  it('export button produces a favourites envelope download', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const urlSpy = vi.fn(() => 'blob:mock');
    const revokeSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: urlSpy, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeSpy, configurable: true });

    render(<FavoritesExportReminder />);
    addFavorite('alice.wam');
    await waitFor(() => expect(screen.getByText('Back up your favourites')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /export now/i }));

    expect(urlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Back up your favourites')).toBeNull());
    clickSpy.mockRestore();
  });
});
