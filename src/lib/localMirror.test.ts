import { describe, it, expect, beforeEach, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  __resetLocalMirrorForTests,
  acquireLocalMirror,
  canonicalLocalMirrorKey,
  clearLocalMirror,
  getLocalMirrorGeneration,
  getLocalMirrorStatus,
  hasLocalMirror,
  hasLocalMirrorEntry,
  ingestMirrorZip,
  ingestMirrorZipBatch,
  releaseLocalMirror,
  resolveLocalMirror,
  subscribeLocalMirror,
} from './localMirror';

let blobCounter = 0;
beforeEach(() => {
  __resetLocalMirrorForTests();
  blobCounter = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock/${++blobCounter}`) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

function zip(files: Record<string, string>) {
  return zipSync(Object.fromEntries(Object.entries(files).map(([key, value]) => [key, strToU8(value)])));
}

describe('localMirror indexed ZIP source', () => {
  it('indexes without extracting, then extracts an entry on demand', async () => {
    await ingestMirrorZip(zip({ 'QmOne/base/1a.jpg': 'image-bytes' }));
    expect(hasLocalMirror()).toBe(true);
    expect(hasLocalMirrorEntry('QmOne/base/1a.jpg')).toBe(true);
    expect(resolveLocalMirror('QmOne/base/1a.jpg')).toBeNull();
    const url = await acquireLocalMirror('QmOne/base/1a.jpg');
    expect(url).toMatch(/^blob:/);
    expect(resolveLocalMirror('QmOne/base/1a.jpg')).toBe(url);
    releaseLocalMirror('QmOne/base/1a.jpg');
  });

  it('loads multiple parts atomically and publishes a new generation each batch', async () => {
    const before = getLocalMirrorGeneration();
    await ingestMirrorZipBatch([
      new Blob([zip({ 'QmOne/base/1a.jpg': 'one' })]),
      new Blob([zip({ 'QmTwo/base/2a.jpg': 'two' })]),
      new Blob([zip({ 'QmThree/base/3a.jpg': 'three' })]),
    ]);
    expect(getLocalMirrorStatus().fileCount).toBe(3);
    expect(hasLocalMirrorEntry('QmThree/base/3a.jpg')).toBe(true);
    expect(getLocalMirrorGeneration()).toBeGreaterThan(before);
  });

  it('normalizes encoded spaces and atomic bare CID extensions', async () => {
    const cid = 'QmT2injqNvKs9eBjf6chS6srTCGeoVoZFNmV1xSkqjy8yy';
    await ingestMirrorZip(zip({
      'QmOne/tiger stripe/1a.gif': 'stripe',
      [`atomic/${cid}.png`]: 'atomic',
    }));
    expect(canonicalLocalMirrorKey('QmOne/tiger%20stripe/1a.gif')).toBe('QmOne/tiger stripe/1a.gif');
    expect(hasLocalMirrorEntry('QmOne/tiger%20stripe/1a.gif')).toBe(true);
    expect(hasLocalMirrorEntry(cid)).toBe(true);
  });

  it('deduplicates simultaneous extraction requests', async () => {
    await ingestMirrorZip(zip({ 'QmOne/base/1a.jpg': 'image' }));
    const [a, b] = await Promise.all([
      acquireLocalMirror('QmOne/base/1a.jpg'),
      acquireLocalMirror('QmOne/base/1a.jpg'),
    ]);
    expect(a).toBe(b);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('notifies and clears all cached URLs', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLocalMirror(listener);
    await ingestMirrorZip(zip({ 'QmOne/base/1a.jpg': 'image' }));
    await acquireLocalMirror('QmOne/base/1a.jpg');
    clearLocalMirror();
    expect(listener).toHaveBeenCalled();
    expect(hasLocalMirror()).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    unsubscribe();
  });
});