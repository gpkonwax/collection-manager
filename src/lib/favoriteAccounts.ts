/**
 * favoriteAccounts.ts — personal list of starred WAX accounts (collections you
 * like, past trading partners). Stored in localStorage, exportable/importable
 * as a JSON envelope that routes through the shared JSON menu like alerts,
 * layouts, puzzles, and pack history.
 */

export interface FavoriteAccount {
  account: string;
  addedAt: string; // ISO
  note?: string;
}

export interface FavoritesEnvelope {
  type: 'gpk-favorite-accounts';
  version: 1;
  exportedAt: string;
  accounts: FavoriteAccount[];
}

export interface FavoritesImportResult {
  added: number;
  updated: number;
  skipped: number;
}

const STORAGE_KEY = 'gpk:favorite-accounts';
const CAP = 200;

/** Fired on window whenever the favourites list changes (any source). */
export const FAVORITES_CHANGED_EVENT = 'gpk:favorites-changed';

// WAX account naming rules: a-z, 1-5, and '.', length 1..12, no leading/trailing/double dots.
const WAX_NAME_RE = /^[a-z1-5]+(\.[a-z1-5]+)*$/;

export function isValidWaxName(name: string): boolean {
  return name.length >= 1 && name.length <= 12 && WAX_NAME_RE.test(name);
}

export type FavoritesChangeType = 'added' | 'removed' | 'imported';

function notifyChanged(type?: FavoritesChangeType, account?: string) {
  try {
    window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED_EVENT, { detail: { type, account } }));
  } catch { /* non-browser env */ }
}

export function loadFavorites(): FavoriteAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is FavoriteAccount =>
        e && typeof e.account === 'string' && isValidWaxName(e.account) && typeof e.addedAt === 'string',
    );
  } catch {
    return [];
  }
}

function saveFavorites(list: FavoriteAccount[], changeType?: FavoritesChangeType, changedAccount?: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to persist favourite accounts', err);
  }
  notifyChanged(changeType, changedAccount);
}

export function isFavorite(account: string): boolean {
  return loadFavorites().some((f) => f.account === account);
}

export function addFavorite(account: string, note?: string): boolean {
  if (!isValidWaxName(account)) return false;
  const list = loadFavorites();
  if (list.some((f) => f.account === account)) return false;
  if (list.length >= CAP) return false;
  saveFavorites([{ account, addedAt: new Date().toISOString(), ...(note ? { note } : {}) }, ...list], 'added', account);
  return true;
}

export function removeFavorite(account: string): boolean {
  const list = loadFavorites();
  const next = list.filter((f) => f.account !== account);
  if (next.length === list.length) return false;
  saveFavorites(next, 'removed', account);
  return true;
}

export function toggleFavorite(account: string): boolean {
  return isFavorite(account) ? !removeFavorite(account) : addFavorite(account);
}

export function exportFavoritesJson(): string {
  const envelope: FavoritesEnvelope = {
    type: 'gpk-favorite-accounts',
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: loadFavorites(),
  };
  return JSON.stringify(envelope, null, 2);
}

/** Returns the accounts array when `parsed` is a favourites envelope, else null. */
export function parseFavoritesEnvelope(parsed: unknown): FavoriteAccount[] | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.type !== 'gpk-favorite-accounts' || !Array.isArray(obj.accounts)) return null;
  return obj.accounts.filter(
    (e): e is FavoriteAccount => e && typeof e.account === 'string' && isValidWaxName(e.account),
  );
}

/**
 * Merge imported favourites into the stored list. Existing accounts keep their
 * original addedAt; new ones are prepended. Invalid names are skipped.
 */
export function importFavorites(accounts: FavoriteAccount[]): FavoritesImportResult {
  const list = loadFavorites();
  const seen = new Set(list.map((f) => f.account));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const incoming: FavoriteAccount[] = [];
  for (const a of accounts) {
    if (!isValidWaxName(a.account)) { skipped++; continue; }
    if (seen.has(a.account)) { updated++; continue; }
    if (list.length + incoming.length >= CAP) { skipped++; continue; }
    seen.add(a.account);
    incoming.push({
      account: a.account,
      addedAt: typeof a.addedAt === 'string' ? a.addedAt : new Date().toISOString(),
      ...(a.note ? { note: a.note } : {}),
    });
    added++;
  }
  if (incoming.length > 0) saveFavorites([...incoming, ...list], 'imported');
  return { added, updated, skipped };
}

export const FAVORITES_CAP = CAP;
