/**
 * Retro "1985 scans" — original Topps Series 1 & 2 card scans from geepeekay.com,
 * mirrored on the data mirror under retro/. Only base-variant cards with a known,
 * unambiguous scan get one; everything else keeps its normal artwork.
 */
import { DATA_MIRROR_URL, isDataMirrorConfigured } from './dataMirror';

const GPK = 'https://geepeekay.com/gallery';

export interface RetroScan {
  /** Primary source (data mirror when configured). */
  src: string;
  /** Original geepeekay URL, used if the mirror copy fails. */
  fallback: string;
  /** True for sideways (landscape) back scans that must be rotated to portrait. */
  landscape: boolean;
}

/** Series 2 shared backs: card number → file stem (first printing where there are two). */
const OS2_SHARED_BACKS: Record<number, string> = {
  43: '43_44ll', 44: '43_44ll',
  49: '49_51', 51: '49_51',
  52: '52_63', 63: '52_63',
  54: '54_65', 65: '54_65',
  74: '42_74',
  83: '42_83',
};
const OS2_SINGLE_BACKS = new Set([45, 53, 61, 62, 64, 72, 73, 81, 82]);
// Puzzle-piece backs; the NFT series matches the first ("ll") printing.
const OS2_PUZZLE_BACKS = new Set([55, 56, 57, 58, 59, 60, 66, 67, 68, 69, 70, 71, 75, 76, 77, 78, 79, 80]);
// Card 42 has two different backs on geepeekay; 46, 47, 48 and 50 have none.

function build(rel: string, landscape: boolean): RetroScan {
  const fallback = `${GPK}/${rel}`;
  const src = isDataMirrorConfigured() ? `${DATA_MIRROR_URL}retro/${rel.toLowerCase()}` : fallback;
  return { src, fallback, landscape };
}

function parseCard(asset: { cardid?: string; side?: string; quality?: string }): { n: number; side: 'a' | 'b' } | null {
  if ((asset.quality || '').toLowerCase() !== 'base') return null;
  const n = parseInt(asset.cardid || '', 10);
  const side = (asset.side || '').toLowerCase();
  if (!Number.isInteger(n) || n < 1 || n > 83) return null;
  if (side !== 'a' && side !== 'b') return null;
  return { n, side };
}

export function getRetroFront(asset: { cardid?: string; side?: string; quality?: string }): RetroScan | null {
  const c = parseCard(asset);
  if (!c) return null;
  const set = c.n <= 41 ? 'os1' : 'os2';
  return build(`${set}/${set}_${c.n}${c.side}.jpg`, false);
}

export function getRetroBack(asset: { cardid?: string; side?: string; quality?: string }): RetroScan | null {
  const c = parseCard(asset);
  if (!c) return null;
  if (c.n <= 41) {
    if (c.n === 29) return c.side === 'b' ? build('os1/backs/os1_back_29b.jpg', true) : null;
    return build(`os1/backs/os1_back_${c.n}ab.jpg`, true);
  }
  if (OS2_PUZZLE_BACKS.has(c.n)) return build(`os2/backs/os2_back_${c.n}ll.jpg`, true);
  if (OS2_SINGLE_BACKS.has(c.n)) return build(`os2/backs/os2_back_${c.n}.jpg`, false);
  const shared = OS2_SHARED_BACKS[c.n];
  return shared ? build(`os2/backs/os2_back_${shared}.jpg`, false) : null;
}

/** Every geepeekay scan URL used above (for the data-mirror build). */
export function listAllRetroScanUrls(): string[] {
  const urls = new Set<string>();
  for (let n = 1; n <= 83; n++) {
    for (const side of ['a', 'b']) {
      const a = { cardid: String(n), side, quality: 'base' };
      const f = getRetroFront(a); if (f) urls.add(f.fallback);
      const b = getRetroBack(a); if (b) urls.add(b.fallback);
    }
  }
  return [...urls];
}
