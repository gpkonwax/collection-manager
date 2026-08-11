/**
 * Local storage for the user's personal pack-opening history.
 *
 * Entries are written the moment a reveal completes (see `handlePackOpened`
 * in `src/pages/Index.tsx`) and can be exported / imported as JSON so the log
 * survives a browser cache clear or a move to another device.
 *
 * Nothing here ever touches the chain — the chain export lives in
 * `packOpenHistoryChain.ts` and deliberately does NOT write to this store.
 */

import type { RevealMatcher } from './packReveal';

const STORAGE_KEY = 'gpk:packHistory:v1';
const DOWNLOAD_KEY = 'gpk:packHistoryDownloaded:v1';
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

function safeRead(): PackHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPackHistoryEntry) : [];
  } catch {
    return [];
  }
}

function safeWrite(list: PackHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capPerAccount(list)));
  } catch {
    /* quota exceeded — the JSON export is the durable copy */
  }
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
  const all = safeRead().sort((a, b) => b.openedAt - a.openedAt);
  return account ? all.filter((e) => e.account === account) : all;
}

/**
 * Record (or refresh) a single opening. De-duped by `txId` + account:
 * a later write with more cards wins, a thinner one never overwrites a richer
 * entry that is already stored.
 */
export function recordPackOpen(entry: PackHistoryEntry): void {
  const list = safeRead();
  const idx = list.findIndex((e) => e.txId === entry.txId && e.account === entry.account);
  if (idx >= 0) {
    list[idx] = mergeEntry(list[idx], entry);
  } else {
    list.unshift(entry);
  }
  safeWrite(list);
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
  const list = safeRead();
  const index = new Map<string, number>(list.map((e, i) => [`${e.account}:${e.txId}`, i]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of entries) {
    if (!isPackHistoryEntry(raw)) { skipped++; continue; }
    const key = `${raw.account}:${raw.txId}`;
    const at = index.get(key);
    if (at === undefined) {
      list.push(raw);
      index.set(key, list.length - 1);
      added++;
    } else {
      const merged = mergeEntry(list[at], raw);
      const changed = JSON.stringify(merged) !== JSON.stringify(list[at]);
      list[at] = merged;
      if (changed) updated++; else skipped++;
    }
  }

  safeWrite(list);
  return { added, updated, skipped };
}

export function clearPackHistory(account?: string): void {
  if (!account) { safeWrite([]); return; }
  safeWrite(safeRead().filter((e) => e.account !== account));
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

function readDownloadMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DOWNLOAD_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function markPackHistoryDownloaded(account: string): void {
  try {
    const map = readDownloadMap();
    map[account] = Date.now();
    localStorage.setItem(DOWNLOAD_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getPackHistoryDownloadedAt(account: string): number | null {
  const map = readDownloadMap();
  return typeof map[account] === 'number' ? map[account] : null;
}

/** Number of openings recorded since the last download for this account. */
export function countUnsavedOpenings(account: string): number {
  const since = getPackHistoryDownloadedAt(account);
  const entries = getPackHistory(account);
  if (since === null) return entries.length;
  return entries.filter((e) => e.openedAt > since).length;
}
