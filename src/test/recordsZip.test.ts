// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { createHash } from 'node:crypto';
import { loadRecordsZip, getLoadedRecords, getRecordsShard, getRecordsProvenanceShard, clearRecords } from '@/lib/recordsZip';

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

function buildZip(opts: { corrupt?: boolean } = {}) {
  const shard = strToU8(JSON.stringify({ '100000004391383': [1, 27, 0] }));
  const index = { generatedAt: '2026-10-02T00:00:00Z', count: 1, shards: { '383': { sha256: opts.corrupt ? 'bad' : sha(shard) } } };
  const zip = zipSync({
    'mints/index.json': strToU8(JSON.stringify(index)),
    'mints/383.json': shard,
    'gpk-topps-holders.json': strToU8(JSON.stringify({ generatedAt: 'x', totals: {}, holders: [{ account: 'a', sa: 1, aa: 1, total: 2 }] })),
  });
  return new Blob([zip]);
}

describe('records ZIP', () => {
  beforeEach(() => clearRecords());

  it('loads shards and holders', async () => {
    const rec = await loadRecordsZip(buildZip());
    expect(rec.cardCount).toBe(1);
    expect(rec.holderCount).toBe(1);
    expect(getRecordsShard('383')).toEqual({ '100000004391383': [1, 27, 0] });
    expect(getRecordsShard('001')).toEqual({});
  });

  it('rejects a checksum mismatch without replacing the current load', async () => {
    await loadRecordsZip(buildZip());
    await expect(loadRecordsZip(buildZip({ corrupt: true }))).rejects.toThrow(/checksum/);
    expect(getLoadedRecords()?.cardCount).toBe(1);
  });

  it('rejects a non-ZIP file', async () => {
    await expect(loadRecordsZip(new Blob(['nope']))).rejects.toThrow(/ZIP/);
  });
});

describe('records ZIP provenance', () => {
  beforeEach(() => clearRecords());
  const build = (bad = false) => {
    const mint = strToU8(JSON.stringify({}));
    const prov = strToU8(JSON.stringify({ '100000004390402': { o: 'dk2au.wam', t: 1589291695500, p: 'series1', n: 5 } }));
    return new Blob([zipSync({
      'mints/index.json': strToU8(JSON.stringify({ count: 0, shards: { '402': { sha256: sha(mint) } } })),
      'mints/402.json': mint,
      'provenance/index.json': strToU8(JSON.stringify({ count: 1, shards: { '402': { sha256: bad ? 'bad' : sha(prov) } } })),
      'provenance/402.json': prov,
    })]);
  };
  it('loads verified provenance shards', async () => {
    const rec = await loadRecordsZip(build());
    expect(rec.provenanceCount).toBe(1);
    expect(getRecordsProvenanceShard('402')).toEqual({ '100000004390402': { o: 'dk2au.wam', t: 1589291695500, p: 'series1', n: 5 } });
    expect(getRecordsProvenanceShard('001')).toEqual({});
  });
  it('rejects damaged provenance', async () => {
    await expect(loadRecordsZip(build(true))).rejects.toThrow(/checksum/);
  });
  it('treats an older ZIP without provenance as having none', async () => {
    await loadRecordsZip(buildZip());
    expect(getRecordsProvenanceShard('402')).toBeNull();
  });
});
