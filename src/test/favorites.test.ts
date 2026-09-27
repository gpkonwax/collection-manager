import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadFavorites,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  isFavorite,
  exportFavoritesJson,
  importFavorites,
  parseFavoritesEnvelope,
  isValidWaxName,
} from '@/lib/favoriteAccounts';
import { parseAndDetect } from '@/lib/jsonRouter';

describe('favoriteAccounts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('validates WAX names', () => {
    expect(isValidWaxName('gp43g.c.wam')).toBe(true);
    expect(isValidWaxName('kvqr.wam')).toBe(true);
    expect(isValidWaxName('')).toBe(false);
    expect(isValidWaxName('UPPER.wam')).toBe(false);
    expect(isValidWaxName('waytoolongname1')).toBe(false);
    expect(isValidWaxName('bad..dots')).toBe(false);
    expect(isValidWaxName('has6char6')).toBe(false);
  });

  it('adds, lists, and removes favourites', () => {
    expect(addFavorite('alice.wam')).toBe(true);
    expect(addFavorite('bob.wam')).toBe(true);
    expect(addFavorite('alice.wam')).toBe(false); // duplicate
    expect(isFavorite('alice.wam')).toBe(true);
    expect(loadFavorites().map((f) => f.account)).toEqual(['bob.wam', 'alice.wam']);
    expect(removeFavorite('alice.wam')).toBe(true);
    expect(isFavorite('alice.wam')).toBe(false);
    expect(removeFavorite('alice.wam')).toBe(false);
  });

  it('toggles favourites', () => {
    expect(toggleFavorite('carol.wam')).toBe(true);
    expect(isFavorite('carol.wam')).toBe(true);
    expect(toggleFavorite('carol.wam')).toBe(false);
    expect(isFavorite('carol.wam')).toBe(false);
  });

  it('rejects invalid names', () => {
    expect(addFavorite('NOT VALID')).toBe(false);
    expect(loadFavorites()).toHaveLength(0);
  });

  it('export envelope round-trips through the JSON router', () => {
    addFavorite('alice.wam');
    addFavorite('bob.wam');
    const json = exportFavoritesJson();
    const detected = parseAndDetect(json);
    expect(detected.kind).toBe('favorites');
    if (detected.kind === 'favorites') {
      expect(detected.parsed.map((a) => a.account).sort()).toEqual(['alice.wam', 'bob.wam']);
    }
  });

  it('import merges without duplicates and skips invalid names', () => {
    addFavorite('alice.wam');
    const result = importFavorites([
      { account: 'alice.wam', addedAt: '2026-01-01T00:00:00Z' },
      { account: 'bob.wam', addedAt: '2026-01-02T00:00:00Z' },
      { account: 'INVALID NAME', addedAt: '2026-01-03T00:00:00Z' },
    ]);
    expect(result).toEqual({ added: 1, updated: 1, skipped: 1 });
    expect(loadFavorites().map((f) => f.account).sort()).toEqual(['alice.wam', 'bob.wam']);
  });

  it('parseFavoritesEnvelope rejects non-envelopes', () => {
    expect(parseFavoritesEnvelope(null)).toBeNull();
    expect(parseFavoritesEnvelope({ type: 'gpk-pack-history', entries: [] })).toBeNull();
    expect(parseFavoritesEnvelope({ type: 'gpk-favorite-accounts', accounts: 'nope' })).toBeNull();
    expect(
      parseFavoritesEnvelope({ type: 'gpk-favorite-accounts', accounts: [{ account: 'a.wam', addedAt: 'x' }] }),
    ).toHaveLength(1);
  });
});
