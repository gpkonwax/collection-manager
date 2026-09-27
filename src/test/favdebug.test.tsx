import { describe, it, expect } from 'vitest';
import { parseFavoritesEnvelope, importFavorites, loadFavorites } from '@/lib/favoriteAccounts';

describe('debug2', () => {
  it('envelope + file.text', async () => {
    const env = { type: 'gpk-favorite-accounts', version: 1, exportedAt: 'x', accounts: [{ account: 'finn.wam', addedAt: 'y' }] };
    console.log('PARSED:', JSON.stringify(parseFavoritesEnvelope(env)));
    console.log('IMPORT:', JSON.stringify(importFavorites(parseFavoritesEnvelope(env)!)));
    const file = new File([JSON.stringify(env)], 'f.json', { type: 'application/json' });
    console.log('typeof text:', typeof (file as any).text);
    try {
      const t = await file.text();
      console.log('TEXT ok, len', t.length);
    } catch (e) {
      console.log('TEXT FAILED:', String(e));
    }
    console.log('FAVS:', JSON.stringify(loadFavorites().map((f) => f.account)));
    expect(true).toBe(true);
  });
});
