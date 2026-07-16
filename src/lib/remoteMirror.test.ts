import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  __resetRemoteMirrorForTests,
  fetchVerifiedMirrorFile,
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

  it('exposes ZIP download URLs for every configured mirror + GitHub Release', () => {
    const options = getZipDownloadUrls();
    expect(options.length).toBeGreaterThanOrEqual(2);
    const primary = options[0];
    expect(primary.key).toBe('primary');
    expect(primary.url).toBe(`${MIRRORS[0].url}gpk-image-mirror.zip`);
    expect(options[options.length - 1].key).toBe('github');
  });

  it('reads pinned zipSha256 / zipBytes from the manifest', async () => {
    const manifest = {
      generatedAt: null,
      files: {},
      missing: [],
      zipSha256: 'a'.repeat(64),
      zipBytes: 12345,
      zipFileName: 'gpk-image-mirror.zip',
    };
    mockFetch({
      '/gpk-manifest.json': { body: Buffer.from(JSON.stringify(manifest)) },
    });
    const info = await getZipManifest();
    expect(info.sha256).toBe('a'.repeat(64));
    expect(info.bytes).toBe(12345);
    expect(info.fileName).toBe('gpk-image-mirror.zip');
  });

  it('returns null zip fields when the manifest is unavailable', async () => {
    mockFetch({});
    const info = await getZipManifest();
    expect(info.sha256).toBeNull();
    expect(info.bytes).toBeNull();
  });
});
