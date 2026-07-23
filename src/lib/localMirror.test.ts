import { describe, it, expect, beforeEach, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  __resetLocalMirrorForTests,
  clearLocalMirror,
  getLocalMirrorStatus,
  hasLocalMirror,
  ingestMirrorZip,
  resolveLocalMirror,
  subscribeLocalMirror,
} from './localMirror';

// jsdom lacks URL.createObjectURL — polyfill with a counter so we can
// distinguish blob URLs from real URLs in assertions.
let blobCounter = 0;
const createdUrls = new Set<string>();
beforeEach(() => {
  __resetLocalMirrorForTests();
  blobCounter = 0;
  createdUrls.clear();
  URL.createObjectURL = vi.fn((blob: Blob) => {
    const url = `blob:mock/${++blobCounter}-${blob.size}`;
    createdUrls.add(url);
    return url;
  }) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn((url: string) => { createdUrls.delete(url); }) as unknown as typeof URL.revokeObjectURL;
});

function makeFixtureZip() {
  const files: Record<string, Uint8Array> = {
    // A card front
    'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/prism/42a.gif': strToU8('fake-gif-bytes-1'),
    // A card back
    'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/back/42.jpg':   strToU8('fake-jpg-bytes-2'),
    // An entry under a "mirror/" prefix — must be normalised away
    'mirror/QmXXX/base/1a.jpg': strToU8('fake-jpg-bytes-3'),
    // Atomic asset: bare CID with extension added by the mirror builder
    'atomic/QmT2injqNvKs9eBjf6chS6srTCGeoVoZFNmV1xSkqjy8yy.png': strToU8('fake-png-bytes-4'),

    // Atomic asset: CID/path preserved exactly
    'atomic/QmAtomicFolder/gold/card.gif': strToU8('fake-gif-bytes-5'),
    // A manifest that must be ignored for lookup
    'manifest.json': strToU8('{"files":{}}'),
    // A hidden file that must be ignored
    '.DS_Store': strToU8('junk'),
  };
  return zipSync(files);
}


describe('localMirror', () => {
  it('starts empty', () => {
    expect(hasLocalMirror()).toBe(false);
    expect(getLocalMirrorStatus().fileCount).toBe(0);
    expect(resolveLocalMirror('anything')).toBeNull();
  });

  it('ingests a ZIP and exposes blob URLs by IPFS path', async () => {
    const zip = makeFixtureZip();
    const { added, bytes } = await ingestMirrorZip(zip);

    // manifest.json + .DS_Store excluded; 5 real files kept
    expect(added).toBe(5);
    expect(bytes).toBeGreaterThan(0);
    expect(hasLocalMirror()).toBe(true);

    const front = resolveLocalMirror('QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/prism/42a.gif');
    const back  = resolveLocalMirror('QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/back/42.jpg');
    const stripped = resolveLocalMirror('QmXXX/base/1a.jpg'); // "mirror/" prefix stripped

    expect(front).toMatch(/^blob:/);
    expect(back).toMatch(/^blob:/);
    expect(stripped).toMatch(/^blob:/);

    expect(resolveLocalMirror('does/not/exist')).toBeNull();
    expect(resolveLocalMirror('manifest.json')).toBeNull(); // ignored
  });

  it('resolves atomic assets by bare CID even though the file has an extension', async () => {
    await ingestMirrorZip(makeFixtureZip());

    const bare = resolveLocalMirror('QmAtomicBareCid');
    const folderPath = resolveLocalMirror('QmAtomicFolder/gold/card.gif');

    expect(bare).toMatch(/^blob:/);
    expect(folderPath).toMatch(/^blob:/);
  });


  it('notifies subscribers when contents change', async () => {
    const spy = vi.fn();
    const unsub = subscribeLocalMirror(spy);
    await ingestMirrorZip(makeFixtureZip());
    expect(spy).toHaveBeenCalled();

    spy.mockClear();
    clearLocalMirror();
    expect(spy).toHaveBeenCalled();
    unsub();
  });

  it('clear() revokes blob URLs and resets state', async () => {
    await ingestMirrorZip(makeFixtureZip());
    expect(hasLocalMirror()).toBe(true);

    clearLocalMirror();
    expect(hasLocalMirror()).toBe(false);
    expect(getLocalMirrorStatus().fileCount).toBe(0);
    expect(resolveLocalMirror('QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/prism/42a.gif')).toBeNull();
    // Every URL we handed out should have been revoked.
    expect(createdUrls.size).toBe(0);
  });

  it('re-ingesting the same path replaces the prior blob and revokes it', async () => {
    await ingestMirrorZip(makeFixtureZip());
    const first = resolveLocalMirror('QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/back/42.jpg');
    expect(first).not.toBeNull();

    // Ingest a new zip with the same path but different bytes
    const zip2 = zipSync({
      'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/back/42.jpg': strToU8('newer-bytes'),
    });
    await ingestMirrorZip(zip2);
    const second = resolveLocalMirror('QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/back/42.jpg');

    expect(second).not.toBe(first);
    expect(createdUrls.has(first!)).toBe(false); // old one revoked
    expect(createdUrls.has(second!)).toBe(true);
  });
});
