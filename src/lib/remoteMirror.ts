/**
 * Remote mirror manager with pinned-manifest hash verification.
 *
 * Mirrors are just static copies of the same `mirror/` folder. Because every
 * file's SHA-256 is recorded in the pinned manifest, we can fetch from any
 * mirror host and verify the bytes before using them — no trust in the host
 * is required.
 */
import { PRIMARY_MIRROR, BACKUP_MIRROR_A, BACKUP_MIRROR_B } from './ipfsGateways';

export type MirrorKey = 'primary' | 'backupA' | 'backupB';

export interface MirrorConfig {
  key: MirrorKey;
  label: string;
  url: string;
}

export const MIRRORS: MirrorConfig[] = [
  { key: 'primary', label: 'Built-in primary mirror', url: PRIMARY_MIRROR },
  { key: 'backupA', label: 'Backup mirror A', url: BACKUP_MIRROR_A },
  { key: 'backupB', label: 'Backup mirror B', url: BACKUP_MIRROR_B },
];

export function isMirrorConfigured(key: MirrorKey): boolean {
  const cfg = MIRRORS.find((m) => m.key === key);
  return !!cfg?.url && /^https:\/\//i.test(cfg.url);
}

interface ManifestFile {
  sha256: string;
  bytes: number;
  gateway?: string;
  fetchedAt?: string;
}

interface PinnedManifest {
  generatedAt: string | null;
  files: Record<string, ManifestFile>;
  missing: string[];
  seriesCount?: number;
  fileCount?: number;
  missingCount?: number;
}

let manifestPromise: Promise<PinnedManifest | null> | null = null;

export function loadPinnedManifest(): Promise<PinnedManifest | null> {
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    try {
      const res = await fetch('/gpk-manifest.json', { cache: 'no-store' });
      if (!res.ok) {
        console.warn('[remoteMirror] pinned manifest fetch failed', res.status);
        return null;
      }
      const data = (await res.json()) as PinnedManifest;
      if (!data || typeof data.files !== 'object') {
        console.warn('[remoteMirror] pinned manifest malformed');
        return null;
      }
      return data;
    } catch (err) {
      console.warn('[remoteMirror] could not load pinned manifest', err);
      return null;
    }
  })();
  return manifestPromise;
}

export function getPinnedManifestSync(): PinnedManifest | null {
  // Consumers that need sync access can await loadPinnedManifest() instead.
  return null;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('crypto.subtle is unavailable');
  }
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface CachedEntry {
  blob: Blob;
  url: string;
}

const verifiedCache = new Map<string, CachedEntry>();
const inFlight = new Map<string, Promise<string | null>>();

/**
 * Fetch a single IPFS-relative path from a mirror base URL and verify its
 * SHA-256 against the pinned manifest. Returns a blob: URL on success, or
 * null if the file is unknown, the fetch fails, or the hash does not match.
 */
export async function fetchVerifiedMirrorFile(
  ipfsPath: string,
  baseUrl: string
): Promise<string | null> {
  if (!baseUrl || !/^https:\/\//i.test(baseUrl)) return null;

  const manifest = await loadPinnedManifest();
  if (!manifest) return null;

  const fileEntry = manifest.files[ipfsPath];
  if (!fileEntry) return null;

  const cacheKey = `${baseUrl}${ipfsPath}`;
  const cached = verifiedCache.get(cacheKey);
  if (cached) return cached.url;

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<string | null> => {
    const url = `${baseUrl}${ipfsPath}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        console.warn('[remoteMirror] fetch failed', url, res.status);
        return null;
      }
      const buf = await res.arrayBuffer();
      const hash = await sha256Hex(buf);
      if (hash !== fileEntry.sha256) {
        console.warn(
          '[remoteMirror] hash mismatch for',
          ipfsPath,
          'expected',
          fileEntry.sha256,
          'got',
          hash
        );
        return null;
      }
      const blob = new Blob([buf]);
      const objectUrl = URL.createObjectURL(blob);
      verifiedCache.set(cacheKey, { blob, url: objectUrl });
      return objectUrl;
    } catch (err) {
      clearTimeout(timer);
      console.warn('[remoteMirror] fetch error', url, err);
      return null;
    }
  })();

  inFlight.set(cacheKey, promise);
  try {
    const result = await promise;
    return result;
  } finally {
    inFlight.delete(cacheKey);
  }
}

export type MirrorStatus = 'idle' | 'checking' | 'ok' | 'failed';

interface MirrorState {
  active: MirrorKey | null;
  statuses: Record<MirrorKey, MirrorStatus>;
}

let state: MirrorState = {
  active: null,
  statuses: { primary: 'idle', backupA: 'idle', backupB: 'idle' },
};

const listeners = new Set<() => void>();

function emit() {
  const next = { ...state, statuses: { ...state.statuses } };
  state = next;
  for (const fn of listeners) fn();
}

export function subscribeRemoteMirror(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getRemoteMirrorState(): MirrorState {
  return state;
}

function setStatus(key: MirrorKey, status: MirrorStatus) {
  if (state.statuses[key] === status) return;
  state = { ...state, statuses: { ...state.statuses, [key]: status } };
  emit();
}

async function verifyMirror(key: MirrorKey) {
  const cfg = MIRRORS.find((m) => m.key === key);
  if (!cfg || !cfg.url) {
    setStatus(key, 'failed');
    return;
  }
  setStatus(key, 'checking');
  try {
    const manifest = await loadPinnedManifest();
    if (!manifest) {
      setStatus(key, 'failed');
      return;
    }
    const samplePath = Object.keys(manifest.files)[0];
    if (!samplePath) {
      setStatus(key, 'failed');
      return;
    }
    const verifiedUrl = await fetchVerifiedMirrorFile(samplePath, cfg.url);
    setStatus(key, verifiedUrl ? 'ok' : 'failed');
  } catch {
    setStatus(key, 'failed');
  }
}

export function setActiveMirror(key: MirrorKey | null): void {
  if (state.active === key) return;
  state = { ...state, active: key };
  emit();
  if (key) verifyMirror(key);
}

export function resetActiveMirror(): void {
  setActiveMirror(null);
}

// Test-only escape hatch: reset module state between tests.
export function __resetRemoteMirrorForTests(): void {
  state = {
    active: null,
    statuses: { primary: 'idle', backupA: 'idle', backupB: 'idle' },
  };
  listeners.clear();
  manifestPromise = null;
  for (const entry of verifiedCache.values()) {
    try { URL.revokeObjectURL(entry.url); } catch { /* noop */ }
  }
  verifiedCache.clear();
  inFlight.clear();
}
