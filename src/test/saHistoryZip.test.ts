// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { createHash } from 'node:crypto';
import { loadSaHistoryZip, getLoadedSaHistory, getSaHistoryZipShard, clearSaHistoryZip } from '@/lib/saHistoryZip';
import { getSaCardHistory } from '@/lib/saHistory';

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

const ROW = [1606003604000, 'sale', 'waxstashsale', 'gz52k.wam', '9700', 'WAX', 'waxstash', 'a'.repeat(64)];

function buildZip(opts: { corrupt?: boolean } = {}) {
  const shard = strToU8(JSON.stringify({ '100000004472192': [ROW] }));
  const index = {
    generatedAt: '2026-10-15T00:00:00Z', complete: true, upTo: '2026-10-15', cards: 1,
    shards: { '192': { count: 1, sha256: opts.corrupt ? 'bad' : sha(shard) } },
  };
  return new Blob([zipSync({
    'sa-history/by-asset/index.json': strToU8(JSON.stringify(index)),
    'sa-history/by-asset/192.json': shard,
    // Raw event log entries must be ignored by the loader's filter.
    'sa-history/events/2020-11.json': strToU8(JSON.stringify([['ignored']])),
  })]);
}

describe('history ZIP', () => {
  beforeEach(() => clearSaHistoryZip());

  it('loads verified shards and serves card history without network', async () => {
    const rec = await loadSaHistoryZip(buildZip());
    expect(rec.cardCount).toBe(1);
    expect(rec.complete).toBe(true);
    expect(getSaHistoryZipShard('192')).toEqual({ '100000004472192': [ROW] });
    expect(getSaHistoryZipShard('001')).toEqual({});

    const hist = await getSaCardHistory('100000004472192');
    expect(hist?.complete).toBe(true);
    expect(hist?.events).toHaveLength(1);
    expect(hist?.events[0]).toMatchObject({ kind: 'sale', market: 'waxstash', amount: '9700', token: 'WAX' });
  });

  it('returns empty events for cards outside the loaded index', async () => {
    await loadSaHistoryZip(buildZip());
    const hist = await getSaCardHistory('10000000447001');
    expect(hist?.events).toEqual([]);
    expect(hist?.complete).toBe(true);
  });

  it('rejects a checksum mismatch without replacing the current load', async () => {
    await loadSaHistoryZip(buildZip());
    await expect(loadSaHistoryZip(buildZip({ corrupt: true }))).rejects.toThrow(/checksum/);
    expect(getLoadedSaHistory()?.cardCount).toBe(1);
  });

  it('rejects a non-ZIP file', async () => {
    await expect(loadSaHistoryZip(new Blob(['nope']))).rejects.toThrow(/ZIP/);
  });

  it('rejects a ZIP without the by-asset index', async () => {
    const zip = new Blob([zipSync({ 'sa-history/events/2020-11.json': strToU8('[]') })]);
    await expect(loadSaHistoryZip(zip)).rejects.toThrow(/card history/);
  });
});
