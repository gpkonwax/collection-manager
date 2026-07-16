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
} from './remoteMirror';

function sha256Raw(bytes: Uint8Array): ArrayBuffer {
  const hash = createHash('sha256').update(bytes).digest();
  return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
}

let blobCounter = 0;
beforeEach(() => {
  __resetRemoteMirrorForTests();
  blobCounter = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock/${++blobCounter}`) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn(() => {}) as unknown as typeof URL.revokeObjectURL;

  globalThis.crypto = {
    subtle: {
      digest: vi.fn(async (_algorithm: string, data: ArrayBuffer) => {
        return sha256Raw(new Uint8Array(data));
      }),
    },
  } as unknown as Crypto;
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

function mockFetch(responses: Record<string, { status?: number; body?: Uint8Array }>) {
  globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
    const key = String(url);
    const match = Object.entries(responses).find(([prefix]) => key.startsWith(prefix));
    if (!match) {
      return new Response(null, { status: 404 });
    }
    const [prefix, res] = match;
    if ((res.status ?? 200) >= 400) {
      return new Response(null, { status: res.status });
    }
    return new Response(res.body, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
  }) as unknown as typeof fetch;
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
      '/gpk-manifest.json': { body: new TextEncoder().encode(JSON.stringify(manifest)) },
      [primaryUrl]: { body: fileBytes },
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
      '/gpk-manifest.json': { body: new TextEncoder().encode(JSON.stringify(manifest)) },
      [primaryUrl]: { body: wrongBytes },
    });

    const url = await fetchVerifiedMirrorFile('QmTest/prism/1a.gif', primaryUrl);
    expect(url).toBeNull();
  });

  it('notifies subscribers when the active mirror changes', () => {
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
      '/gpk-manifest.json': { body: new TextEncoder().encode(JSON.stringify(manifest)) },
      [primaryUrl]: { body: fileBytes },
    });

    const first = await fetchVerifiedMirrorFile('QmTest/prism/1a.gif', primaryUrl);
    const second = await fetchVerifiedMirrorFile('QmTest/prism/1a.gif', primaryUrl);
    expect(first).toBe(second);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // manifest + one file fetch
  });
});
