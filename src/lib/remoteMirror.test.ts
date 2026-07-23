import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  __resetRemoteMirrorForTests,
  fetchVerifiedMirrorFile,
  getMirrorDisplayLabel,
  getMirrorProviderName,
  getRemoteMirrorState,
  loadPinnedManifest,
  setActiveMirror,
  subscribeRemoteMirror,
  MIRRORS,
  getZipDownloadUrls,
  getZipManifest,
} from './remoteMirror';

function sha256Raw(bytes: Uint8Array): ArrayBuffer {
  const hash = createHash('sha256').update(bytes).digest();
  return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength) as ArrayBuffer;
}

let blobCounter = 0;
beforeEach(() => {
  vi.unstubAllGlobals();
  __resetRemoteMirrorForTests();
  blobCounter = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock/${++blobCounter}`) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn(() => {}) as unknown as typeof URL.revokeObjectURL;

  vi.stubGlobal('crypto', {
    subtle: {
      digest: vi.fn(async (_algorithm: string, data: ArrayBuffer) => {
        return sha256Raw(new Uint8Array(data));
      }),
    },
  });
});

function makeManifest(files: Record<string, Uint8Array>) {
  const entries: Record<string, { sha256: string; bytes: number }> = {};
  for (const [path, bytes] of Object.entries(files)) {
    entries[path] = {
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
    };
  }
  return { generatedAt: new Date().toISOString(), files: entries, missing: [] };
}

function mockFetch(responses: Record<string, { status?: number; body?: Uint8Array | Buffer }>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
    const key = String(url);
    const match = Object.entries(responses).find(([prefix]) => key.startsWith(prefix));
    if (!match) {
      return new Response(null, { status: 404 });
    }
    const [, res] = match;
    if ((res.status ?? 200) >= 400) {
      return new Response(null, { status: res.status });
    }
    return new Response(res.body as BodyInit, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
  }));
}

describe('remoteMirror', () => {
  it('returns null when the pinned manifest is missing', async () => {
    mockFetch({});
    const manifest = await loadPinnedManifest();
    expect(manifest).toBeNull();
  });

  it('fetches and verifies a mirror file by hash', async () => {
    const fileBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const manifest = makeManifest({ 'QmTest/prism/1a.gif': fileBytes });
    const primaryUrl = MIRRORS[0].url;

    mockFetch({
      '/gpk-manifest.json': { body: Buffer.from(JSON.stringify(manifest)) },
      [primaryUrl]: { body: Buffer.from(fileBytes) },
    });

    const url = await fetchVerifiedMirrorFile('QmTest/prism/1a.gif', primaryUrl);
    expect(url).toMatch(/^blob:/);
  });

  it('fetches atomic assets using the manifest path field', async () => {
    const fileBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const hash = createHash('sha256').update(fileBytes).digest('hex');
    const manifest = {
      generatedAt: new Date().toISOString(),
      files: {
        'QmAtomicBareCid': {
          sha256: hash,
          bytes: fileBytes.length,
          path: 'atomic/QmAtomicBareCid.png',
        },
      },
      missing: [],
    };
    const primaryUrl = MIRRORS[0].url;

    mockFetch({
      '/gpk-manifest.json': { body: Buffer.from(JSON.stringify(manifest)) },
      [`${primaryUrl}atomic/QmAtomicBareCid.png`]: { body: Buffer.from(fileBytes) },
    });

    const url = await fetchVerifiedMirrorFile('QmAtomicBareCid', primaryUrl);
    expect(url).toMatch(/^blob:/);
  });


  it('rejects a mirror file whose hash does not match', async () => {
    const fileBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const wrongBytes = new Uint8Array([9, 9, 9, 9]);
    const manifest = makeManifest({ 'QmTest/prism/1a.gif': fileBytes });
    const primaryUrl = MIRRORS[0].url;

    mockFetch({
      '/gpk-manifest.json': { body: Buffer.from(JSON.stringify(manifest)) },
      [primaryUrl]: { body: Buffer.from(wrongBytes) },
    });

    const url = await fetchVerifiedMirrorFile('QmTest/prism/1a.gif', primaryUrl);
    expect(url).toBeNull();
  });

  it('notifies subscribers when the active mirror changes', () => {
    mockFetch({
      '/gpk-manifest.json': { body: Buffer.from(JSON.stringify({ generatedAt: null, files: {}, missing: [] })) },
    });
    const spy = vi.fn();
    const unsub = subscribeRemoteMirror(spy);
    setActiveMirror('primary');
    expect(spy).toHaveBeenCalled();
    expect(getRemoteMirrorState().active).toBe('primary');
    unsub();
  });

  it('caches verified blob URLs so the same path returns the same URL', async () => {
    const fileBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const manifest = makeManifest({ 'QmTest/prism/1a.gif': fileBytes });
    const primaryUrl = MIRRORS[0].url;

    mockFetch({
      '/gpk-manifest.json': { body: Buffer.from(JSON.stringify(manifest)) },
      [primaryUrl]: { body: Buffer.from(fileBytes) },
    });

    const first = await fetchVerifiedMirrorFile('QmTest/prism/1a.gif', primaryUrl);
    const second = await fetchVerifiedMirrorFile('QmTest/prism/1a.gif', primaryUrl);
    expect(first).toBe(second);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // manifest + one file fetch
  });

  it('exposes ZIP download URLs for every configured mirror', () => {
    const options = getZipDownloadUrls({
      sha256: 'a'.repeat(64),
      bytes: 12345,
      fileName: 'gpk-image-mirror.zip',
      parts: [],
    });
    // Primary (GitHub Release asset) is always present. Backup A (Cloudflare)
    // is intentionally excluded even when configured — its 25 MB per-file cap
    // means the ZIP isn't uploaded there.
    const keys = options.map((o) => o.key);
    expect(keys).toContain('primary');
    expect(keys).not.toContain('backupA');
    const primary = options.find((o) => o.key === 'primary')!;
    expect(primary.parts[0].url).toBe(
      'https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/gpk-image-mirror.zip'
    );
  });

  it('exposes split ZIP part URLs from manifest metadata', () => {
    const options = getZipDownloadUrls({
      sha256: null,
      bytes: 3000,
      fileName: 'gpk-image-mirror.zip',
      parts: [
        { index: 1, fileName: 'gpk-image-mirror-part-001.zip', bytes: 1000, sha256: 'a'.repeat(64), fileCount: 10 },
        { index: 2, fileName: 'gpk-image-mirror-part-002.zip', bytes: 2000, sha256: 'b'.repeat(64), fileCount: 20 },
      ],
    });
    const primary = options.find((o) => o.key === 'primary')!;
    expect(primary.parts).toHaveLength(2);
    expect(primary.parts[0].url).toBe(
      'https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/gpk-image-mirror-part-001.zip'
    );
    expect(primary.parts[1].url).toBe(
      'https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/gpk-image-mirror-part-002.zip'
    );
  });

  it('normalizes stale single ZIP metadata to the real split release parts', async () => {
    const manifest = {
      generatedAt: null,
      files: {},
      missing: [],
      zipSha256: 'a'.repeat(64),
      zipBytes: 1349536047,
      zipFileName: 'gpk-image-mirror.zip',
    };
    mockFetch({
      '/gpk-manifest.json': { body: Buffer.from(JSON.stringify(manifest)) },
    });

    const info = await getZipManifest();
    expect(info.sha256).toBeNull();
    expect(info.bytes).toBe(4260168540);
    expect(info.fileName).toBeNull();
    expect(info.parts.map((part) => part.fileName)).toEqual([
      'gpk-image-mirror-part-001.zip',
      'gpk-image-mirror-part-002.zip',
      'gpk-image-mirror-part-003.zip',
    ]);
  });

  it('reads pinned zipSha256 / zipBytes from the manifest', async () => {
    const manifest = {
      generatedAt: null,
      files: {},
      missing: [],
      zipSha256: 'a'.repeat(64),
      zipBytes: 12345,
      zipFileName: 'custom-single-mirror.zip',
      zipParts: [
        { index: 1, fileName: 'custom-single-mirror.zip', bytes: 12345, sha256: 'b'.repeat(64), fileCount: 5 },
      ],
    };
    mockFetch({
      '/gpk-manifest.json': { body: Buffer.from(JSON.stringify(manifest)) },
    });
    const info = await getZipManifest();
    expect(info.sha256).toBe('a'.repeat(64));
    expect(info.bytes).toBe(12345);
    expect(info.fileName).toBe('custom-single-mirror.zip');
    expect(info.parts).toHaveLength(1);
    expect(info.parts[0].fileName).toBe('custom-single-mirror.zip');
  });

  it('returns null zip fields when the manifest is unavailable', async () => {
    mockFetch({});
    const info = await getZipManifest();
    expect(info.sha256).toBeNull();
    expect(info.bytes).toBeNull();
    expect(info.parts).toEqual([]);
  });
});

describe('getMirrorProviderName', () => {
  it('detects GitHub Pages', () => {
    expect(getMirrorProviderName('https://gpkonwaxbackup.github.io/gpk-backup/mirror/')?.name).toBe('GitHub Pages');
  });

  it('detects Cloudflare Pages', () => {
    expect(getMirrorProviderName('https://gpk-backup.pages.dev/mirror/')?.name).toBe('Cloudflare Pages');
  });

  it('detects GitLab Pages', () => {
    expect(getMirrorProviderName('https://gpkonwaxbackup.gitlab.io/gpk-backup/mirror/')?.name).toBe('GitLab Pages');
  });

  it('returns null for empty or invalid URLs', () => {
    expect(getMirrorProviderName('')).toBeNull();
    expect(getMirrorProviderName('not-a-url')).toBeNull();
  });

  it('returns null for unknown hosts', () => {
    expect(getMirrorProviderName('https://example.com/mirror/')).toBeNull();
  });
});

describe('getMirrorDisplayLabel', () => {
  it('appends provider name when detected', () => {
    const cfg = { key: 'backupA' as const, label: 'Backup mirror A', url: 'https://gpk-backup.pages.dev/mirror/' };
    expect(getMirrorDisplayLabel(cfg)).toBe('Backup mirror A — Cloudflare Pages');
  });

  it('falls back to base label when provider is unknown', () => {
    const cfg = { key: 'backupB' as const, label: 'Backup mirror B', url: 'https://example.com/mirror/' };
    expect(getMirrorDisplayLabel(cfg)).toBe('Backup mirror B');
  });

  it('falls back to base label when URL is empty', () => {
    const cfg = { key: 'backupA' as const, label: 'Backup mirror A', url: '' };
    expect(getMirrorDisplayLabel(cfg)).toBe('Backup mirror A');
  });
});
