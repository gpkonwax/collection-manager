/**
 * Session-only "history ZIP": per-card SimpleAssets history shards
 * (sa-history/by-asset/*.json) loaded from a user-selected gpk-sa-history.zip.
 * When loaded, getSaCardHistory reads from here before raw GitHub — the same
 * rule the records ZIP follows for mints and holders. Raw shard bytes are kept
 * and parsed lazily per shard so loading stays fast.
 */
import { unzipSync, strFromU8 } from 'fflate';

export const SA_HISTORY_ZIP_NAME = 'gpk-sa-history.zip';
export const SA_HISTORY_ZIP_URL =
  `https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/${SA_HISTORY_ZIP_NAME}`;

export interface SaHistoryZipIndex {
  generatedAt?: string;
  complete?: boolean;
  upTo?: string | null;
  cards?: number;
  shards?: Record<string, { sha256?: string; count?: number }>;
}

export interface LoadedSaHistory {
  fileName: string;
  loadedAt: number;
  generatedAt: string | null;
  complete: boolean;
  upTo: string | null;
  cardCount: number;
  shardKeys: Set<string>;
  shards: Map<string, Uint8Array>;
}

let current: LoadedSaHistory | null = null;
const parsedCache = new Map<string, Record<string, unknown[]>>();
const listeners = new Set<() => void>();

export function subscribeSaHistoryZip(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function getLoadedSaHistory(): LoadedSaHistory | null { return current; }
export function clearSaHistoryZip(): void {
  current = null;
  parsedCache.clear();
  listeners.forEach((l) => l());
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Keep only the per-card shard entries, wherever they sit in the ZIP. */
function shardKey(path: string): string | null {
  const m = path.replace(/\\/g, '/').match(/(?:^|\/)sa-history\/by-asset\/(\d{3}|index)\.json$/);
  return m ? m[1] : null;
}

/** Parse + verify a history ZIP. Throws a plain-language Error on failure; never replaces the current load on failure. */
export async function loadSaHistoryZip(file: Blob & { name?: string }): Promise<LoadedSaHistory> {
  let entries: Record<string, Uint8Array>;
  try {
    // The ZIP also carries the multi-GB raw event log; the filter keeps those
    // entries compressed so only the per-card shards are decompressed.
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (f) => shardKey(f.name) !== null,
    });
  } catch {
    throw new Error("That file isn't a readable ZIP.");
  }
  const files = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(entries)) {
    const key = shardKey(name);
    if (key) files.set(key, data);
  }
  const indexBytes = files.get('index');
  if (!indexBytes) throw new Error("This ZIP doesn't contain the card history (sa-history/by-asset/index.json missing).");
  let index: SaHistoryZipIndex;
  try { index = JSON.parse(strFromU8(indexBytes)); } catch { throw new Error('The history index inside the ZIP is damaged.'); }
  const expected = index.shards ?? {};

  const shards = new Map<string, Uint8Array>();
  for (const [key, meta] of Object.entries(expected)) {
    const bytes = files.get(key);
    if (!bytes) throw new Error(`The ZIP is incomplete — history file ${key}.json is missing.`);
    if (meta?.sha256 && (await sha256Hex(bytes)) !== meta.sha256) {
      throw new Error(`History file ${key}.json is damaged (checksum mismatch).`);
    }
    shards.set(key, bytes);
  }

  current = {
    fileName: file.name ?? SA_HISTORY_ZIP_NAME,
    loadedAt: Date.now(),
    generatedAt: index.generatedAt ?? null,
    complete: !!index.complete,
    upTo: index.upTo ?? null,
    cardCount: typeof index.cards === 'number' ? index.cards : 0,
    shardKeys: new Set(Object.keys(expected)),
    shards,
  };
  parsedCache.clear();
  listeners.forEach((l) => l());
  return current;
}

/** Parsed shard from the loaded ZIP: object, `{}` if the index lists no cards here, or null if no ZIP. */
export function getSaHistoryZipShard(key: string): Record<string, unknown[]> | null {
  if (!current) return null;
  if (!current.shardKeys.has(key)) return {};
  const cached = parsedCache.get(key);
  if (cached) return cached;
  const bytes = current.shards.get(key);
  if (!bytes) return {};
  try {
    const parsed = JSON.parse(strFromU8(bytes)) as Record<string, unknown[]>;
    parsedCache.set(key, parsed);
    return parsed;
  } catch {
    return {};
  }
}
