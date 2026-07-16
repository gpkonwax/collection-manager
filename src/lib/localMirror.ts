/**
 * Local image mirror — client-side fallback for IPFS.
 *
 * Users load a ZIP of the frozen GPK image mirror; every entry becomes a
 * `blob:` URL keyed by its IPFS-relative path (hash + optional tail).
 * `useIpfsMedia` checks this map first, so a hit is instant and fully offline.
 *
 * Optional IndexedDB persistence via idb-keyval — off by default; opt-in.
 */
import { unzip, type Unzipped } from 'fflate';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

const IDB_KEY = 'gpk-local-mirror-v1';
const IDB_PERSIST_KEY = 'gpk-local-mirror-persist';

// key = IPFS path (hash or hash/tail). value = { blob, url } (url is a blob: URL).
type Entry = { blob: Blob; url: string };
const store = new Map<string, Entry>();
let bytesLoaded = 0;
let loadedAt: number | null = null;

const listeners = new Set<() => void>();
export function subscribeLocalMirror(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function emit() { for (const fn of listeners) fn(); }

export interface LocalMirrorStatus {
  fileCount: number;
  totalBytes: number;
  loadedAt: number | null;
  persisted: boolean;
}

export function getLocalMirrorStatus(): LocalMirrorStatus {
  return {
    fileCount: store.size,
    totalBytes: bytesLoaded,
    loadedAt,
    persisted: getPersistPreference(),
  };
}

export function getPersistPreference(): boolean {
  try { return localStorage.getItem(IDB_PERSIST_KEY) === '1'; } catch { return false; }
}
export function setPersistPreference(v: boolean): void {
  try { localStorage.setItem(IDB_PERSIST_KEY, v ? '1' : '0'); } catch { /* noop */ }
}

/**
 * Look up a file in the local mirror.
 * `key` is the IPFS path (hash, or hash/tail — same format extractIpfsHash returns).
 */
export function resolveLocalMirror(key: string | null | undefined): string | null {
  if (!key) return null;
  const entry = store.get(key);
  return entry ? entry.url : null;
}

/** True if any local-mirror file is loaded in memory. */
export function hasLocalMirror(): boolean {
  return store.size > 0;
}

function extToMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  return 'image/jpeg';
}

/**
 * Ingest a ZIP produced by `scripts/build-image-mirror.mjs`.
 * Expected internal layout: `<hash>/...` or `mirror/<hash>/...`.
 * A top-level `manifest.json` is ignored for lookup purposes.
 */
export async function ingestMirrorZip(source: File | Blob | ArrayBuffer | Uint8Array): Promise<{ added: number; bytes: number }> {
  const bytes = await toBytes(source);
  const files = await unzipAsync(bytes);
  let added = 0;
  let addedBytes = 0;

  for (const [rawPath, data] of Object.entries(files)) {
    if (!data || data.length === 0) continue; // directories
    // Normalise: strip leading "mirror/" if present, ignore manifest.json + hidden files.
    let path = rawPath.replace(/\\/g, '/');
    if (path.startsWith('mirror/')) path = path.slice('mirror/'.length);
    if (!path || path.endsWith('/')) continue;
    if (path === 'manifest.json' || path.startsWith('.')) continue;

    const mime = extToMime(path);
    // Copy into a plain ArrayBuffer so Blob owns detached memory
    const copy = new Uint8Array(data.length);
    copy.set(data);
    const blob = new Blob([copy], { type: mime });
    const url = URL.createObjectURL(blob);

    const existing = store.get(path);
    if (existing) URL.revokeObjectURL(existing.url);
    store.set(path, { blob, url });
    added += 1;
    addedBytes += data.length;
  }

  bytesLoaded += addedBytes;
  loadedAt = Date.now();
  emit();

  if (getPersistPreference()) {
    // Best-effort persist — don't fail ingest if IDB is unavailable.
    persistToIdb().catch((err) => console.warn('[localMirror] persist failed', err));
  }

  return { added, bytes: addedBytes };
}

async function toBytes(source: File | Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  const buf = await (source as Blob).arrayBuffer();
  return new Uint8Array(buf);
}

function unzipAsync(bytes: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(bytes, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

/** Wipe the in-memory map and revoke every blob URL. */
export function clearLocalMirror(): void {
  for (const entry of store.values()) URL.revokeObjectURL(entry.url);
  store.clear();
  bytesLoaded = 0;
  loadedAt = null;
  emit();
  idbDel(IDB_KEY).catch(() => { /* noop */ });
}

/** Persist current blobs to IndexedDB as an array of [key, Blob]. */
async function persistToIdb(): Promise<void> {
  const payload: Array<[string, Blob]> = [];
  for (const [key, entry] of store.entries()) payload.push([key, entry.blob]);
  await idbSet(IDB_KEY, payload);
}

/** Restore blobs from IndexedDB on app boot. Silent no-op if nothing stored. */
export async function restoreLocalMirrorFromIdb(): Promise<number> {
  try {
    const payload = await idbGet<Array<[string, Blob]>>(IDB_KEY);
    if (!Array.isArray(payload) || payload.length === 0) return 0;
    let restored = 0;
    let bytes = 0;
    for (const [key, blob] of payload) {
      if (!key || !(blob instanceof Blob)) continue;
      const url = URL.createObjectURL(blob);
      const existing = store.get(key);
      if (existing) URL.revokeObjectURL(existing.url);
      store.set(key, { blob, url });
      restored += 1;
      bytes += blob.size;
    }
    bytesLoaded += bytes;
    if (restored > 0) loadedAt = Date.now();
    emit();
    return restored;
  } catch (err) {
    console.warn('[localMirror] restore failed', err);
    return 0;
  }
}

// Test-only escape hatch: reset module state between tests.
export function __resetLocalMirrorForTests(): void {
  for (const entry of store.values()) URL.revokeObjectURL(entry.url);
  store.clear();
  bytesLoaded = 0;
  loadedAt = null;
  listeners.clear();
}
