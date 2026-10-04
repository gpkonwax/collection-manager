// @vitest-environment node
import { describe, it, expect } from 'vitest';
// @ts-expect-error — .mjs source with no types
import { extractGpkCreatelogIds, readRecentSaMints } from '../lib/saCreatelog.mjs';

const act = (author: string, assetid: unknown, ts = '2026-09-16T16:27:34.500', name = 'createlog') => ({
  '@timestamp': ts,
  act: { account: 'simpleassets', name, data: { author, assetid } },
});

describe('extractGpkCreatelogIds', () => {
  it('keeps only gpk.topps createlog rows with numeric ids', () => {
    const r = extractGpkCreatelogIds([
      act('gpk.topps', '100000020304447'),
      act('other.author', '100000020304448'),
      act('gpk.topps', 'abc'),
      act('gpk.topps', '100000020304449', '2026-09-17T00:00:00.000', 'create'),
      act('gpk.topps', 100000020304450, '2026-09-18T00:00:00.000'),
    ]);
    expect(r.ids).toEqual(['100000020304447', '100000020304450']);
    expect(r.lastTs).toBe('2026-09-18T00:00:00.000');
  });
});

describe('readRecentSaMints', () => {
  it('keeps the old bookmark when every node fails', async () => {
    const r = await readRecentSaMints('2026-10-01T00:00:00.000Z', {
      endpoints: ['http://a', 'http://b'],
      fetchJson: async () => { throw new Error('down'); },
    });
    expect(r).toEqual({ ids: [], cursor: '2026-10-01T00:00:00.000Z', complete: false });
  });

  it('advances the bookmark after a short page', async () => {
    const r = await readRecentSaMints('2026-09-01T00:00:00.000Z', {
      endpoints: ['http://a'],
      fetchJson: async () => ({ actions: [act('gpk.topps', '5', '2026-09-20T00:00:00.000')] }),
    });
    expect(r).toEqual({ ids: ['5'], cursor: '2026-09-20T00:00:00.000', complete: true });
  });
});
