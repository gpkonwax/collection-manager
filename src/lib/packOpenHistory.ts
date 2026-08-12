/**
 * Local storage for the user's personal pack-opening history.
 *
 * Entries are written the moment a reveal completes (see `handlePackOpened`
 * in `src/pages/Index.tsx`) and can be exported / imported as JSON so the log
 * survives a browser cache clear or a move to another device.
 *
 * Durability: the store lives in IndexedDB (far more room than localStorage and
 * not evicted under the same pressure) with a synchronous in-memory mirror so
 * reads stay instant. A legacy localStorage copy is migrated on first load and
 * kept as a best-effort secondary copy. Write failures are surfaced (see
 * `getPackHistorySaveFailed`) instead of being swallowed.
 *
 * Nothing here ever touches the chain — the chain export lives in
 * `packOpenHistoryChain.ts` and deliberately does NOT write to this store.
 */

import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { RevealMatcher } from './packReveal';

const STORAGE_KEY = 'gpk:packHistory:v1';
/** Legacy timestamp-based download marker (replaced by the saved-txId set). */
const DOWNLOAD_KEY = 'gpk:packHistoryDownloaded:v1';
const SAVED_KEY = 'gpk:packHistorySaved:v1';
const IDB_HISTORY_KEY = 'gpk-pack-history-v1';
const IDB_SAVED_KEY = 'gpk-pack-history-saved-v1';
/** Max entries kept per account. Older openings fall off the end. */
export const PACK_HISTORY_CAP = 500;

export const PACK_HISTORY_ENVELOPE_TYPE = 'gpk-pack-history';
export const PACK_HISTORY_ENVELOPE_VERSION = 1;

export interface PackHistoryCard {
  /** Asset id at reveal time, when known. */
  id?: string | null;
  name: string;
  image: string | null;
  cardid?: string | null;
  side?: string | null;
  variant?: string | null;
  category?: string | null;
  templateId?: string | null;
}

export interface PackHistoryEntry {
  /** Claim transaction id, or a locally generated id when the claim had none. */
  txId: string;
  account: string;
  source: 'simpleassets' | 'atomicassets';
  /** Pack symbol (SA) or template id (AA), when known. */
  packId?: string | null;
  packName: string;
  packImage?: string | null;
  /** Epoch ms. */
  openedAt: number;
  matchers: RevealMatcher[];
  cards: PackHistoryCard[];
  /** True when the entry was rebuilt from chain history rather than recorded live. */
  fromChain?: boolean;
}

export interface PackHistoryEnvelope {
  type: typeof PACK_HISTORY_ENVELOPE_TYPE;
  version: number;
  account?: string;
  exportedAt?: string;
  entries: PackHistoryEntry[];
}

// ---------------------------------------------------------------- in-memory

let cache: PackHistoryEntry[] = [];
/** account → set of txIds already written into a downloaded JSON file. */
let savedIds: Record<string, string[]> = {};
let saveFailed = false;
let hydrated = false;
let hydrating: Promise<void> | null = null;

const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) {
    try { fn(); } catch { /* listener errors never break a write */ }
  }
}

export function subscribePackHistory(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** True when the last attempted persist failed — the JSON export is the only durable copy. */
export function getPackHistorySaveFailed(): boolean {
  return saveFailed;
}

function readLocalEntries(): PackHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPackHistoryEntry) : [];
  } catch {
    return [];
  }
}

function readLocalSaved(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string[]> = {};
    for (const [account, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(ids)) out[account] = ids.filter((i): i is string => typeof i === 'string');
    }
    return out;
  } catch {
    return {};
  }
}

// Seed synchronously from the legacy localStorage copy so the very first render
// has data even before IndexedDB answers.
cache = capPerAccount(readLocalEntries());
savedIds = readLocalSaved();

function mergeLists(a: PackHistoryEntry[], b: PackHistoryEntry[]): PackHistoryEntry[] {
  const out = [...a];
  const index = new Map(out.map((e, i) => [`${e.account}:${e.txId}`, i]));
  for (const entry of b) {
    const key = `${entry.account}:${entry.txId}`;
    const at = index.get(key);
    if (at === undefined) {
      out.push(entry);
      index.set(key, out.length - 1);
    } else {
      out[at] = mergeEntry(out[at], entry);
    }
  }
  return out;
}

/** Load the IndexedDB copy and migrate anything left in localStorage. Idempotent. */
export function ensurePackHistoryLoaded(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const [storedEntries, storedSaved] = await Promise.all([
        idbGet(IDB_HISTORY_KEY) as Promise<unknown>,
        idbGet(IDB_SAVED_KEY) as Promise<unknown>,
      ]);
      const fromIdb = Array.isArray(storedEntries) ? storedEntries.filter(isPackHistoryEntry) : [];
      const localOnly = readLocalEntries();
      cache = capPerAccount(mergeLists(fromIdb, localOnly));

      if (storedSaved && typeof storedSaved === 'object') {
        const merged: Record<string, string[]> = { ...readLocalSaved() };
        for (const [account, ids] of Object.entries(storedSaved as Record<string, unknown>)) {
          if (!Array.isArray(ids)) continue;
          const clean = ids.filter((i): i is string => typeof i === 'string');
          merged[account] = Array.from(new Set([...(merged[account] ?? []), ...clean]));
        }
        savedIds = merged;
      }
      migrateLegacyDownloadMarker();
    } catch {
      /* IndexedDB unavailable — the localStorage seed stays in play */
    } finally {
      hydrated = true;
      hydrating = null;
      persist();
      notify();
    }
  })();
  return hydrating;
}

/**
 * Older builds tracked "already downloaded" with a single timestamp per account.
 * Translate it once so existing users don't see a spurious "unsaved" warning.
 */
function migrateLegacyDownloadMarker(): void {
  let map: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(DOWNLOAD_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    map = parsed as Record<string, number>;
  } catch {
    return;
  }
  for (const [account, at] of Object.entries(map)) {
    if (typeof at !== 'number') continue;
    const ids = cache.filter((e) => e.account === account && e.openedAt <= at).map((e) => e.txId);
    if (ids.length === 0) continue;
    savedIds[account] = Array.from(new Set([...(savedIds[account] ?? []), ...ids]));
  }
  try { localStorage.removeItem(DOWNLOAD_KEY); } catch { /* noop */ }
}

// Kick off hydration as soon as the module loads.
void ensurePackHistoryLoaded();

// -------------------------------------------------------------------- writes

function persist(): void {
  cache = capPerAccount(cache);
  // Trim the saved-id sets to ids we still know about, so they can't grow forever.
  const known = new Map<string, Set<string>>();
  for (const e of cache) {
    const set = known.get(e.account) ?? new Set<string>();
    set.add(e.txId);
    known.set(e.account, set);
  }
  for (const [account, ids] of Object.entries(savedIds)) {
    const set = known.get(account);
    savedIds[account] = set ? ids.filter((id) => set.has(id)) : [];
  }

  // Best-effort secondary copy. Quota failures here are not fatal.
  let lsOk = false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds));
    lsOk = true;
  } catch {
    /* IndexedDB is the durable path */
  }

  void (async () => {
    try {
      await idbSet(IDB_HISTORY_KEY, cache);
      await idbSet(IDB_SAVED_KEY, savedIds);
      if (saveFailed) { saveFailed = false; notify(); }
    } catch {
      if (!lsOk && !saveFailed) { saveFailed = true; notify(); }
    }
  })();
}

/** Keep at most PACK_HISTORY_CAP entries per account, newest first. */
function capPerAccount(list: PackHistoryEntry[]): PackHistoryEntry[] {
  const sorted = [...list].sort((a, b) => b.openedAt - a.openedAt);
  const counts = new Map<string, number>();
  const out: PackHistoryEntry[] = [];
  for (const entry of sorted) {
    const n = counts.get(entry.account) ?? 0;
    if (n >= PACK_HISTORY_CAP) continue;
    counts.set(entry.account, n + 1);
    out.push(entry);
  }
  return out;
}

export function isPackHistoryEntry(value: unknown): value is PackHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.txId === 'string' &&
    typeof e.account === 'string' &&
    (e.source === 'simpleassets' || e.source === 'atomicassets') &&
    typeof e.openedAt === 'number' &&
    Array.isArray(e.cards)
  );
}

/** Newest first. Pass an account to scope the list (history is private per account). */
export function getPackHistory(account?: string): PackHistoryEntry[] {
  const all = [...cache].sort((a, b) => b.openedAt - a.openedAt);
  return account ? all.filter((e) => e.account === account) : all;
}

/**
 * Record (or refresh) a single opening. De-duped by `txId` + account:
 * a later write with more cards wins, a thinner one never overwrites a richer
 * entry that is already stored.
 */
export function recordPackOpen(entry: PackHistoryEntry): void {
  const idx = cache.findIndex((e) => e.txId === entry.txId && e.account === entry.account);
  if (idx >= 0) {
    cache[idx] = mergeEntry(cache[idx], entry);
  } else {
    cache.unshift(entry);
  }
  persist();
  notify();
}

function mergeEntry(existing: PackHistoryEntry, incoming: PackHistoryEntry): PackHistoryEntry {
  const richer = incoming.cards.length >= existing.cards.length ? incoming : existing;
  const other = richer === incoming ? existing : incoming;
  return {
    ...other,
    ...richer,
    packName: richer.packName || other.packName,
    packImage: richer.packImage ?? other.packImage ?? null,
    packId: richer.packId ?? other.packId ?? null,
    matchers: richer.matchers?.length ? richer.matchers : (other.matchers ?? []),
    // A live recording is always better than a chain reconstruction.
    fromChain: existing.fromChain === false || incoming.fromChain === false ? false : (richer.fromChain ?? false),
  };
}

/** Merge imported entries into the local store. Never creates duplicates. */
export function mergePackHistory(entries: PackHistoryEntry[]): { added: number; updated: number; skipped: number } {
  const index = new Map<string, number>(cache.map((e, i) => [`${e.account}:${e.txId}`, i]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of entries) {
    if (!isPackHistoryEntry(raw)) { skipped++; continue; }
    const key = `${raw.account}:${raw.txId}`;
    const at = index.get(key);
    if (at === undefined) {
      cache.push(raw);
      index.set(key, cache.length - 1);
      added++;
    } else {
      const merged = mergeEntry(cache[at], raw);
      const changed = JSON.stringify(merged) !== JSON.stringify(cache[at]);
      cache[at] = merged;
      if (changed) updated++; else skipped++;
    }
    // Anything that arrived from a file is, by definition, already saved to a file.
    markPackHistorySaved(raw.account, [raw.txId], false);
  }

  persist();
  notify();
  return { added, updated, skipped };
}

export function clearPackHistory(account?: string): void {
  if (!account) {
    cache = [];
    savedIds = {};
  } else {
    cache = cache.filter((e) => e.account !== account);
    delete savedIds[account];
  }
  persist();
  notify();
}

export function buildPackHistoryEnvelope(account: string, entries: PackHistoryEntry[]): PackHistoryEnvelope {
  return {
    type: PACK_HISTORY_ENVELOPE_TYPE,
    version: PACK_HISTORY_ENVELOPE_VERSION,
    account,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

/** Returns the entries from a parsed JSON payload, or null when it isn't a pack-history file. */
export function parsePackHistoryEnvelope(parsed: unknown): PackHistoryEntry[] | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.type !== PACK_HISTORY_ENVELOPE_TYPE) return null;
  if (!Array.isArray(obj.entries)) return null;
  return obj.entries.filter(isPackHistoryEntry);
}

export function packHistoryFilename(account: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `gpk-pack-history-${account || 'account'}-${date}.json`;
}

export function downloadPackHistory(account: string, entries: PackHistoryEntry[]): void {
  const blob = new Blob([JSON.stringify(buildPackHistoryEnvelope(account, entries), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = packHistoryFilename(account);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- "your file is out of date" tracking ----------
//
// Tracked as an exact set of txIds that are known to live in a downloaded file,
// so re-importing that file never reports its own openings as unsaved.

function markPackHistorySaved(account: string, txIds: string[], flush = true): void {
  if (!account || txIds.length === 0) return;
  savedIds[account] = Array.from(new Set([...(savedIds[account] ?? []), ...txIds]));
  if (flush) { persist(); notify(); }
}

/** Call after a successful download with the exact entries written to the file. */
export function markPackHistoryDownloaded(account: string, entries?: PackHistoryEntry[]): void {
  const list = entries ?? getPackHistory(account);
  markPackHistorySaved(account, list.filter((e) => e.account === account).map((e) => e.txId));
}

/** Number of openings recorded that are not yet in any downloaded file. */
export function countUnsavedOpenings(account: string): number {
  const saved = new Set(savedIds[account] ?? []);
  return getPackHistory(account).filter((e) => !saved.has(e.txId)).length;
}
