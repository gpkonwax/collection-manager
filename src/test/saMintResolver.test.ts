import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveSaMintsForAssets, shardOf, describeMintSource, __resetSaMintResolverForTests } from '@/lib/saMintResolver';

vi.mock('@/lib/dataMirror', () => ({ getDataMirrorBases: () => ['https://mirror.test/'] }));
vi.mock('@/lib/offlineBundle', () => ({ isOfflineBundle: () => false }));

const INDEX = { generatedAt: '2026-10-02T00:00:00.000Z', shards: { '015': {}, '387': {} } };
const SHARDS: Record<string, unknown> = {
  '015': { '100000004478015': [356, 398, 0] },
  '387': { '100000006630387': [1354, 1328, 166] },
};

function mockFetch(live: 'cors' | Record<string, [number, number, number]>) {
  return vi.fn(async (url: string) => {
    if (url.startsWith('https://mirror.test/manifests/mints/')) {
      const file = url.split('/').pop()!.replace('.json', '');
      const body = file === 'index' ? INDEX : SHARDS[file];
      return body ? new Response(JSON.stringify(body)) : new Response('nf', { status: 404 });
    }
    if (live === 'cors') throw new TypeError('Failed to fetch');
    const ids = new URL(url).searchParams.get('asset_ids')!.split(',');
    const data = ids.filter((id) => live[id]).map((id) => ({ asset_id: id, mint: live[id][0], total: live[id][1], burned: live[id][2] }));
    return new Response(JSON.stringify({ success: true, data }));
  });
}

beforeEach(() => { __resetSaMintResolverForTests(); sessionStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe('saMintResolver', () => {
  it('shards by last 3 digits', () => {
    expect(shardOf('100000004478015')).toBe('015');
    expect(shardOf('7')).toBe('007');
  });

  it('serves mints from the backup while AtomicHub is CORS-blocked', async () => {
    vi.stubGlobal('fetch', mockFetch('cors'));
    const r = await resolveSaMintsForAssets([
      { assetId: 'aa1', sassetsId: '100000004478015' },
      { assetId: '100000006630387', sassetsId: '100000006630387' },
    ]);
    expect(r.get('aa1')).toMatchObject({ mint: 356, total: 398, source: 'backup', backupDate: INDEX.generatedAt });
    expect(r.get('100000006630387')).toMatchObject({ mint: 1354, burned: 166, source: 'backup' });
  });

  it('falls back to live for cards missing from the backup', async () => {
    vi.stubGlobal('fetch', mockFetch({ '100000009999015': [400, 400, 0] }));
    const r = await resolveSaMintsForAssets([{ assetId: 'x', sassetsId: '100000009999015' }]);
    expect(r.get('x')).toMatchObject({ mint: 400, source: 'live' });
  });

  it('once live works, live overrides newer totals from the backup', async () => {
    vi.stubGlobal('fetch', mockFetch({ '100000009999015': [400, 400, 0], '100000006630387': [1354, 1400, 170] }));
    await resolveSaMintsForAssets([{ assetId: 'x', sassetsId: '100000009999015' }]);
    const r = await resolveSaMintsForAssets([{ assetId: 'y', sassetsId: '100000006630387' }]);
    expect(r.get('y')).toMatchObject({ mint: 1354, total: 1400, source: 'live' });
  });

  it('leaves unknown cards unresolved', async () => {
    vi.stubGlobal('fetch', mockFetch('cors'));
    const r = await resolveSaMintsForAssets([{ assetId: 'z', sassetsId: '100000000000123' }]);
    expect(r.has('z')).toBe(false);
  });

  it('describes the source for tooltips', () => {
    expect(describeMintSource('live')).toMatch(/live from AtomicHub/);
    expect(describeMintSource('backup', '2026-10-02T00:00:00Z')).toMatch(/saved backup \(/);
  });
});
