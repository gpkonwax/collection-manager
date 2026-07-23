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

export interface MirrorProviderInfo {
  name: string;
  colorClass: string;
}

/**
 * Detect a friendly hosting-provider name from a mirror base URL.
 * Returns null when the URL is empty or the host is not recognized.
 */
export function getMirrorProviderName(url: string): MirrorProviderInfo | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith('github.io')) return { name: 'GitHub Pages', colorClass: 'bg-gray-500/20 text-gray-300' };
    if (host.endsWith('pages.dev')) return { name: 'Cloudflare Pages', colorClass: 'bg-orange-500/20 text-orange-300' };
    if (host.endsWith('gitlab.io')) return { name: 'GitLab Pages', colorClass: 'bg-orange-600/20 text-orange-300' };
    if (host.endsWith('vercel.app')) return { name: 'Vercel', colorClass: 'bg-black/30 text-white' };
    if (host.endsWith('netlify.app')) return { name: 'Netlify', colorClass: 'bg-teal-500/20 text-teal-300' };
    if (host.endsWith('surge.sh')) return { name: 'Surge', colorClass: 'bg-purple-500/20 text-purple-300' };
    if (host.endsWith('onrender.com')) return { name: 'Render', colorClass: 'bg-emerald-500/20 text-emerald-300' };
    if (host.endsWith('web.app') || host.endsWith('firebaseapp.com')) return { name: 'Firebase', colorClass: 'bg-amber-500/20 text-amber-300' };
    if (host.includes('s3-website') || host.endsWith('amazonaws.com')) return { name: 'AWS S3', colorClass: 'bg-yellow-500/20 text-yellow-300' };
    return null;
  } catch {
    return null;
  }
}

/**
 * User-facing label for a mirror. When the host is recognizable, the provider
 * name is appended so it's clear which of the 3 providers each entry points to.
 */
export function getMirrorDisplayLabel(config: MirrorConfig): string {
  const provider = getMirrorProviderName(config.url);
  if (!provider) return config.label;
  return `${config.label} — ${provider.name}`;
}

export function isMirrorConfigured(key: MirrorKey): boolean {
  const cfg = MIRRORS.find((m) => m.key === key);
  return !!cfg?.url && /^https:\/\//i.test(cfg.url);
}

interface ManifestFile {
  sha256: string;
  bytes: number;
  gateway?: string;
  fetchedAt?: string;
  /** Actual on-disk/mirror path when it differs from the manifest key. */
  path?: string;
}

interface PinnedManifest {
  generatedAt: string | null;
  files: Record<string, ManifestFile>;
  missing: string[];
  seriesCount?: number;
  fileCount?: number;
  missingCount?: number;
  zipFileName?: string;
  zipBytes?: number;
  zipSha256?: string;
  zipPartCount?: number;
  zipParts?: ZipManifestPart[];
}

export interface ZipManifestPart {
  index: number;
  fileName: string;
  bytes: number;
  sha256: string;
  fileCount?: number;
}

const RELEASE_ZIP_PARTS: ZipManifestPart[] = [
  { index: 1, fileName: 'gpk-image-mirror-part-001.zip', bytes: 1885365317, sha256: '' },
  { index: 2, fileName: 'gpk-image-mirror-part-002.zip', bytes: 1887321761, sha256: '' },
  { index: 3, fileName: 'gpk-image-mirror-part-003.zip', bytes: 487481462, sha256: '' },
];

const RELEASE_ZIP_TOTAL_BYTES = RELEASE_ZIP_PARTS.reduce((sum, part) => sum + part.bytes, 0);


/** GitHub Releases landing page — bonus fallback link. */
export const ZIP_GITHUB_RELEASE_URL =
  'https://github.com/bewbzz/gpkonwaxbackup/releases/latest';

/**
 * Direct-download URL for the ZIP asset attached to the latest GitHub Release.
 * Used for the primary mirror because the ZIP is excluded from the GitHub
 * Pages repo (100 MB per-file limit); it lives on Releases instead.
 */
export const ZIP_GITHUB_RELEASE_DOWNLOAD_BASE =
  'https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download';

export const ZIP_GITHUB_RELEASE_ASSET_URL =
  `${ZIP_GITHUB_RELEASE_DOWNLOAD_BASE}/gpk-image-mirror.zip`;

/**
 * Direct-download URL for the offline app bundle (built + zipped viewer).
 * Users unzip and open `open-me.html` to run the manager locally without
 * relying on any hosted URL.
 */
export const OFFLINE_APP_RELEASE_ASSET_URL =
  'https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/gpk-collection-manager-offline.zip';

export interface ZipDownloadOption {
  key: MirrorKey | 'github';
  label: string;
  url?: string;
  parts: Array<ZipManifestPart & { url: string }>;
}

/**
 * Direct download URLs for the offline ZIP, in priority order.
 *
 * - Primary (GitHub Pages) → GitHub Release asset (Pages repo can't hold >100 MB files).
 * - Other mirrors (GitLab / Cloudflare) → `${baseUrl}gpk-image-mirror.zip`
 *   because those platforms accept large files alongside the images.
 * - GitHub Release landing page is appended as a bonus fallback.
 */
export function getZipDownloadUrls(zipInfo?: ZipManifestInfo | null): ZipDownloadOption[] {
  if (!zipInfo) return [];
  const options: ZipDownloadOption[] = [];
  const hasRealParts = zipInfo.parts.length > 0;
  const hasSingleFile = !hasRealParts && !!zipInfo.fileName;
  const parts = hasRealParts
    ? zipInfo.parts
    : hasSingleFile
      ? [{ index: 1, fileName: zipInfo.fileName as string, bytes: zipInfo.bytes ?? 0, sha256: zipInfo.sha256 ?? '' }]
      : [];
  for (const m of MIRRORS) {
    if (!m.url || !/^https:\/\//i.test(m.url)) continue;
    // Backup A (Cloudflare Pages) has a 25 MB per-file cap on the free tier,
    // so the ZIP is deliberately not uploaded there — it stays image-only.
    if (m.key === 'backupA') continue;
    if (parts.length === 0) {
      // Manifest has no ZIP metadata — never fabricate a filename that might 404.
      // Point users at the release landing page instead so they always land somewhere real.
      if (m.key !== 'primary') continue;
      options.push({ key: m.key, label: m.label, url: ZIP_GITHUB_RELEASE_URL, parts: [] });
      continue;
    }
    const optionParts = parts.map((part) => ({
      ...part,
      url: m.key === 'primary'
        ? `${ZIP_GITHUB_RELEASE_DOWNLOAD_BASE}/${part.fileName}`
        : `${m.url}${part.fileName}`,
    }));
    options.push({ key: m.key, label: m.label, url: optionParts[0]?.url, parts: optionParts });
  }
  return options;
}

export interface ZipManifestInfo {
  sha256: string | null;
  bytes: number | null;
  fileName: string | null;
  parts: ZipManifestPart[];
}

function normalizeZipManifestInfo(manifest: PinnedManifest | null): ZipManifestInfo {
  const manifestParts = Array.isArray(manifest?.zipParts) ? manifest.zipParts : [];
  const hasSplitParts = manifestParts.length > 1;

  if (hasSplitParts) {
    return {
      sha256: manifest?.zipSha256 ?? null,
      bytes: manifest?.zipBytes ?? null,
      fileName: manifest?.zipFileName ?? null,
      parts: manifestParts,
    };
  }

  if (manifest?.zipFileName === 'gpk-image-mirror.zip') {
    return {
      sha256: null,
      bytes: RELEASE_ZIP_TOTAL_BYTES,
      fileName: null,
      parts: RELEASE_ZIP_PARTS,
    };
  }

  return {
    sha256: manifest?.zipSha256 ?? null,
    bytes: manifest?.zipBytes ?? null,
    fileName: manifest?.zipFileName ?? null,
    parts: manifestParts,
  };
}

/** Pinned ZIP hash + size for user-facing verification display. */
export async function getZipManifest(): Promise<ZipManifestInfo> {
  const manifest = await loadPinnedManifest();
  return normalizeZipManifestInfo(manifest);
}


let manifestPromise: Promise<PinnedManifest | null> | null = null;

export function loadPinnedManifest(): Promise<PinnedManifest | null> {
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}gpk-manifest.json`, { cache: 'no-store' });
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

  const mirrorPath = fileEntry.path ?? ipfsPath;
  const cacheKey = `${baseUrl}${mirrorPath}`;
  const cached = verifiedCache.get(cacheKey);
  if (cached) return cached.url;

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<string | null> => {
    const url = `${baseUrl}${mirrorPath}`;
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

/**
 * Public entry point — check a mirror's health without making it active.
 * Safe to call repeatedly; results are surfaced via subscribeRemoteMirror.
 */
export function checkMirrorHealth(key: MirrorKey): void {
  void verifyMirror(key);
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
