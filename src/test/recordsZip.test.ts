import { describe, it, expect, beforeEach } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { createHash } from 'node:crypto';
import { loadRecordsZip, getLoadedRecords, getRecordsShard, clearRecords } from '@/lib/recordsZip';

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
