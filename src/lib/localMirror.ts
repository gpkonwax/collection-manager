/**
 * Session-only local image mirror backed by user-selected ZIP files.
 *
 * ZIP central directories are indexed up-front, but image bytes are extracted
 * only when a visible card asks for them. This keeps multi-gigabyte backups out
 * of JavaScript memory and makes the archive behave like a read-only drive.
 */
import { BlobReader, BlobWriter, ZipReader, type Entry, type FileEntry } from '@zip.js/zip.js';
import { del as idbDel } from 'idb-keyval';

const IDB_KEY = 'gpk-local-mirror-v1';
const IDB_PERSIST_KEY = 'gpk-local-mirror-persist';
const CACHE_LIMIT_BYTES = 192 * 1024 * 1024;

type IndexedEntry = { entry: FileEntry; storedPath: string; archiveName: string };
type CachedEntry = { blob: Blob; url: string; bytes: number; touchedAt: number; refs: number };

const readers: ZipReader<Blob>[] = [];
const index = new Map<string, IndexedEntry>();
const cache = new Map<string, CachedEntry>();
const inFlight = new Map<string, Promise<string>>();
const corrupt = new Set<string>();
let cacheBytes = 0;
let indexedBytes = 0;
let loadedAt: number | null = null;
let generation = 0;

const listeners = new Set<() => void>();
export function subscribeLocalMirror(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export interface LocalMirrorPartStatus {
  name: string;
  fileCount: number;
  ready: boolean;
  error?: string;
}

export type LocalMirrorCoverage = 'none' | 'checking' | 'complete' | 'incomplete' | 'corrupt' | 'unverified';

export interface LocalMirrorStatus {
  fileCount: number;
  totalBytes: number;
  loadedAt: number | null;
  persisted: boolean;
  generation: number;
  coverage: LocalMirrorCoverage;
  expectedFiles: number | null;
  missingFiles: number;
  duplicateFiles: number;
  corruptFiles: number;
  parts: LocalMirrorPartStatus[];
}

let cachedStatus: LocalMirrorStatus = {
  fileCount: 0, totalBytes: 0, loadedAt: null, persisted: false, generation: 0,
  coverage: 'none', expectedFiles: null, missingFiles: 0, duplicateFiles: 0,
  corruptFiles: 0, parts: [],
};

function emit() {
  cachedStatus = { ...cachedStatus, fileCount: index.size, totalBytes: indexedBytes, loadedAt, generation, corruptFiles: corrupt.size };
  for (const fn of listeners) fn();
}

export function getLocalMirrorStatus(): LocalMirrorStatus { return cachedStatus; }
export function getLocalMirrorGeneration(): number { return generation; }

export function getPersistPreference(): boolean {
  try { return localStorage.getItem(IDB_PERSIST_KEY) === '1'; } catch { return false; }
}
export function setPersistPreference(v: boolean): void {
  try { localStorage.setItem(IDB_PERSIST_KEY, v ? '1' : '0'); } catch { /* noop */ }
}

/** Canonicalize a metadata/ZIP path to the same raw IPFS lookup key. */
export function canonicalLocalMirrorKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.replace(/\\/g, '/').replace(/^\/+/, '');
  if (value.startsWith('mirror/')) value = value.slice(7);
  if (value.startsWith('atomic/')) value = value.slice(7);
  value = value.split(/[?#]/, 1)[0];
  try { value = decodeURIComponent(value); } catch { /* retain malformed but usable path */ }
  value = value.replace(/\/{2,}/g, '/');
  return value || null;
}

function aliasesForPath(storedPath: string): string[] {
  const canonical = canonicalLocalMirrorKey(storedPath);
  if (!canonical) return [];
  const aliases = new Set([canonical]);
  // Atomic metadata often contains a bare CID while the mirror adds the detected extension.
  if (storedPath.replace(/\\/g, '/').startsWith('atomic/')) {
    const bare = canonical.match(/^((?:Qm|bafy|bafk)[^/]+)\.[a-zA-Z0-9]{2,6}$/);
    if (bare) aliases.add(bare[1]);
  }
  return [...aliases];
}

export function hasLocalMirror(): boolean { return index.size > 0; }
export function hasLocalMirrorEntry(key: string | null | undefined): boolean {
  const canonical = canonicalLocalMirrorKey(key);
  return !!canonical && index.has(canonical);
}

/** Synchronous cache-only lookup retained for reveal helpers. */
export function resolveLocalMirror(key: string | null | undefined): string | null {
  const canonical = canonicalLocalMirrorKey(key);
  if (!canonical) return null;
  const hit = cache.get(canonical);
  if (!hit) return null;
  hit.touchedAt = Date.now();
  return hit.url;
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

function evictCache() {
  if (cacheBytes <= CACHE_LIMIT_BYTES) return;
  const candidates = [...cache.entries()].filter(([, item]) => item.refs === 0).sort((a, b) => a[1].touchedAt - b[1].touchedAt);
  for (const [key, item] of candidates) {
    if (cacheBytes <= CACHE_LIMIT_BYTES) break;
    URL.revokeObjectURL(item.url);
    cache.delete(key);
    cacheBytes -= item.bytes;
  }
}

/** Extract one indexed image. ZIP CRC/signature errors reject instead of falling online silently. */
export async function acquireLocalMirror(key: string | null | undefined): Promise<string | null> {
  const canonical = canonicalLocalMirrorKey(key);
  if (!canonical) return null;
  const cached = cache.get(canonical);
  if (cached) {
    cached.refs += 1;
    cached.touchedAt = Date.now();
    return cached.url;
  }
  const indexed = index.get(canonical);
  if (!indexed) return null;
  const pending = inFlight.get(canonical);
  if (pending) {
    const url = await pending;
    const item = cache.get(canonical);
    if (item) item.refs += 1;
    return url;
  }
  const task = (async () => {
    try {
      const blob = await indexed.entry.getData(new BlobWriter(extToMime(indexed.storedPath)), { checkSignature: true });
      const url = URL.createObjectURL(blob);
      cache.set(canonical, { blob, url, bytes: blob.size, touchedAt: Date.now(), refs: 1 });
      cacheBytes += blob.size;
      evictCache();
      return url;
    } catch (error) {
      corrupt.add(canonical);
      cachedStatus = { ...cachedStatus, coverage: 'corrupt', corruptFiles: corrupt.size };
      generation += 1;
      emit();
      throw new Error(`Local backup entry could not be verified: ${indexed.storedPath}`, { cause: error });
    } finally {
      inFlight.delete(canonical);
    }
  })();
  inFlight.set(canonical, task);
  return task;
}

export function releaseLocalMirror(key: string | null | undefined): void {
  const canonical = canonicalLocalMirrorKey(key);
  if (!canonical) return;
  const item = cache.get(canonical);
  if (item) item.refs = Math.max(0, item.refs - 1);
  evictCache();
}

interface ManifestShape { files?: Record<string, { path?: string }> }

async function verifyCoverage(): Promise<Pick<LocalMirrorStatus, 'coverage' | 'expectedFiles' | 'missingFiles'>> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}gpk-manifest.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    const manifest = await response.json() as ManifestShape;
    const entries = Object.entries(manifest.files ?? {});
    let missing = 0;
    for (const [key, record] of entries) {
      const canonical = canonicalLocalMirrorKey(record.path ?? key);
      if (!canonical || !index.has(canonical)) missing += 1;
    }
    return { coverage: missing === 0 ? 'complete' : 'incomplete', expectedFiles: entries.length, missingFiles: missing };
  } catch {
    return { coverage: 'unverified', expectedFiles: null, missingFiles: 0 };
  }
}

/** Atomically replace the current session backup with all selected ZIP parts. */
export async function ingestMirrorZipBatch(sources: Array<File | Blob>): Promise<{ added: number; bytes: number }> {
  const newReaders: ZipReader<Blob>[] = [];
  const newIndex = new Map<string, IndexedEntry>();
  const parts: LocalMirrorPartStatus[] = [];
  let bytes = 0;
  let duplicates = 0;
  try {
    for (let i = 0; i < sources.length; i += 1) {
      const source = sources[i];
      const name = source instanceof File ? source.name : `ZIP part ${i + 1}`;
      const reader = new ZipReader(new BlobReader(source), { useWebWorkers: true });
      newReaders.push(reader);
      const entries = await reader.getEntries();
      let fileCount = 0;
      for (const entry of entries) {
        if (entry.directory) continue;
        let storedPath = entry.filename.replace(/\\/g, '/');
        if (storedPath.startsWith('mirror/')) storedPath = storedPath.slice(7);
        if (!storedPath || storedPath === 'manifest.json' || storedPath.startsWith('.')) continue;
        fileCount += 1;
        bytes += entry.uncompressedSize;
        for (const alias of aliasesForPath(storedPath)) {
          if (newIndex.has(alias)) duplicates += 1;
          else newIndex.set(alias, { entry: entry as FileEntry, storedPath, archiveName: name });
        }
      }
      parts.push({ name, fileCount, ready: true });
    }
  } catch (error) {
    await Promise.allSettled(newReaders.map((reader) => reader.close()));
    throw error;
  }

  await clearLocalMirrorInternal();
  readers.push(...newReaders);
  for (const [key, value] of newIndex) index.set(key, value);
  indexedBytes = bytes;
  loadedAt = Date.now();
  generation += 1;
  cachedStatus = { ...cachedStatus, parts, duplicateFiles: duplicates, coverage: 'checking', persisted: false };
  emit();
  const coverage = await verifyCoverage();
  cachedStatus = { ...cachedStatus, ...coverage };
  generation += 1;
  emit();
  return { added: newIndex.size, bytes };
}

/** Backwards-compatible single-part helper. */
export function ingestMirrorZip(source: File | Blob | ArrayBuffer | Uint8Array): Promise<{ added: number; bytes: number }> {
  const blob = source instanceof Blob ? source : new Blob([source instanceof Uint8Array ? source.slice().buffer : source]);
  return ingestMirrorZipBatch([blob]);
}

async function clearLocalMirrorInternal() {
  for (const item of cache.values()) URL.revokeObjectURL(item.url);
  cache.clear(); cacheBytes = 0; index.clear(); corrupt.clear(); inFlight.clear();
  const oldReaders = readers.splice(0);
  await Promise.allSettled(oldReaders.map((reader) => reader.close()));
  indexedBytes = 0; loadedAt = null;
}

export function clearLocalMirror(): void {
  void clearLocalMirrorInternal();
  generation += 1;
  cachedStatus = { fileCount: 0, totalBytes: 0, loadedAt: null, persisted: false, generation,
    coverage: 'none', expectedFiles: null, missingFiles: 0, duplicateFiles: 0, corruptFiles: 0, parts: [] };
  emit();
  try { void idbDel(IDB_KEY); } catch { /* noop */ }
}

// Multi-gigabyte File handles cannot be safely persisted in IndexedDB. Kept as explicit no-ops for boot compatibility.
export async function persistLocalMirrorToIdb(): Promise<void> { throw new Error('ZIP backups are session-only'); }
export async function restoreLocalMirrorFromIdb(): Promise<number> { return 0; }

export function __resetLocalMirrorForTests(): void {
  for (const item of cache.values()) URL.revokeObjectURL(item.url);
  cache.clear(); index.clear(); readers.splice(0); corrupt.clear(); inFlight.clear(); listeners.clear();
  cacheBytes = 0; indexedBytes = 0; loadedAt = null; generation = 0;
  cachedStatus = { fileCount: 0, totalBytes: 0, loadedAt: null, persisted: false, generation: 0,
    coverage: 'none', expectedFiles: null, missingFiles: 0, duplicateFiles: 0, corruptFiles: 0, parts: [] };
}