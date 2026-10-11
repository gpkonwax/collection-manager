import { describe, expect, it } from 'vitest';
import { categoryForSaPack, categoryForAtomicPack, pendingPreloadUrls, PRELOAD_CONCURRENCY } from '@/lib/collectionPreload';
import { DEAL_YAY_DELAY_MS } from '@/components/simpleassets/CardDealAnimation';

describe('collection preload during reveal', () => {
  it('maps SA pack symbols to the collection that gets dealt', () => {
    expect(categoryForSaPack('GPKMEGA')).toBe('series1');
    expect(categoryForSaPack('GPKTWOB')).toBe('series2');
    expect(categoryForSaPack('EXOFIVE')).toBe('exotic');
    expect(categoryForSaPack('NOPE')).toBeNull();
  });

  it('maps AtomicAssets pack names to their collection', () => {
    expect(categoryForAtomicPack('Crash Gordon Pack')).toBe('crashgordon');
    expect(categoryForAtomicPack('GameStonk! Pack')).toBe('gamestonk');
    expect(categoryForAtomicPack('Food Fight! Pack')).toBe('foodfightb');
  });

  it('dedupes identical artwork so each image is fetched once', () => {
    const a = 'https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
    const b = 'https://gateway.pinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
    expect(pendingPreloadUrls([a, b, null, undefined])).toEqual([a]);
  });

  it('keeps preloading gentle and celebrates 1s after the last card lands', () => {
    expect(PRELOAD_CONCURRENCY).toBe(6);
    expect(DEAL_YAY_DELAY_MS).toBe(1000);
  });
});
