import { describe, it, expect } from 'vitest';
import { getDataMirrorBases, DATA_MIRROR_URL, GITHUB_RAW_MIRROR_URL } from '@/lib/dataMirror';
import { MIRRORS } from '@/lib/remoteMirror';

describe('getDataMirrorBases', () => {
  it('lists only the data mirror and raw GitHub, never image mirrors', () => {
    const bases = getDataMirrorBases();
    expect(bases).toEqual([DATA_MIRROR_URL, GITHUB_RAW_MIRROR_URL]);
    for (const m of MIRRORS) {
      if (m.url && m.url !== DATA_MIRROR_URL && m.url !== GITHUB_RAW_MIRROR_URL) {
        expect(bases).not.toContain(m.url);
      }
    }
  });
});
