/**
 * Session-only "records ZIP": holders list + mint-number backup shards,
 * loaded from a user-selected `gpk-records.zip`. When loaded, the mint
 * resolver and holders list read from here before any network mirror.
 */
import { unzipSync, strFromU8 } from 'fflate';
import type { HoldersManifest } from './gpkHolders';

export const RECORDS_ZIP_NAME = 'gpk-records.zip';
export const RECORDS_ZIP_URL =
  `https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/${RECORDS_ZIP_NAME}`;

export interface RecordsIndex {
  generatedAt?: string;
  count?: number;
  shards?: Record<string, { sha256?: string; count?: number }>;
}

export interface LoadedRecords {
  fileName: string;
  loadedAt: number;
  generatedAt: string | null;
  cardCount: number;
  holderCount: number;
  index: RecordsIndex;
  shards: Map<string, Record<string, unknown>>;
  holders: HoldersManifest | null;
}

let current: LoadedRecords | null = null;
const listeners = new Set<() => void>();

export function subscribeRecords(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function getLoadedRecords(): LoadedRecords | null { return current; }
export function clearRecords(): void {
  current = null;
  listeners.forEach((l) => l());
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Strip any leading folder so `gpk-records/mints/001.json` → `mints/001.json`. */
function normalise(path: string): string | null {
  const p = path.replace(/\\/g, '/');
  const m = p.match(/(?:^|\/)(mints\/(?:\d{3}|index)\.json|gpk-topps-holders\.json|records-info\.json)$/);
  return m ? m[1] : null;
}

/** Parse + verify a records ZIP. Throws a plain-language Error on failure; never replaces the current load on failure. */
export async function loadRecordsZip(file: Blob & { name?: string }): Promise<LoadedRecords> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("That file isn't a readable ZIP.");
  }
  const files = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(entries)) {
    const key = normalise(name);
    if (key) files.set(key, data);
  }
  const indexBytes = files.get('mints/index.json');
  if (!indexBytes) throw new Error("This ZIP doesn't contain the mint-number backup (mints/index.json missing).");
  let index: RecordsIndex;
  try { index = JSON.parse(strFromU8(indexBytes)); } catch { throw new Error('The mint index inside the ZIP is damaged.'); }
  const expected = index.shards ?? {};

  const shards = new Map<string, Record<string, unknown>>();
  for (const [key, meta] of Object.entries(expected)) {
    const bytes = files.get(`mints/${key}.json`);
    if (!bytes) throw new Error(`The ZIP is incomplete — mint file ${key}.json is missing.`);
    if (meta?.sha256 && (await sha256Hex(bytes)) !== meta.sha256) {
      throw new Error(`Mint file ${key}.json is damaged (checksum mismatch).`);
    }
    try { shards.set(key, JSON.parse(strFromU8(bytes))); } catch { throw new Error(`Mint file ${key}.json is damaged.`); }
  }

  let holders: HoldersManifest | null = null;
  const holdersBytes = files.get('gpk-topps-holders.json');
  if (holdersBytes) {
    try {
      const h = JSON.parse(strFromU8(holdersBytes)) as HoldersManifest;
      if (h && Array.isArray(h.holders)) holders = h;
    } catch { /* holders optional — mints still usable */ }
  }

  current = {
    fileName: file.name ?? RECORDS_ZIP_NAME,
    loadedAt: Date.now(),
    generatedAt: index.generatedAt ?? null,
    cardCount: typeof index.count === 'number' ? index.count : 0,
    holderCount: holders?.holders.length ?? 0,
    index,
    shards,
    holders,
  };
  listeners.forEach((l) => l());
  return current;
}

/** Shard from the loaded ZIP: object, `{}` if index says no cards here, or null if no ZIP. */
export function getRecordsShard(key: string): Record<string, unknown> | null {
  if (!current) return null;
  return current.shards.get(key) ?? {};
}
