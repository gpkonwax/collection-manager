/**
 * Classic GPK card-back puzzles that are NOT backed by NFTs.
 * Artwork is hosted on geepeekay.com (card-back scans + completed-puzzle reference sheets).
 *
 * These unlock once the user has completed the NFT-backed Series 2 puzzle
 * (all 18 pieces owned), and behave exactly like the NFT puzzle in the builder.
 */

import { geepeekayToMirrorPath } from './dataMirror';

export interface ExtraPuzzlePiece {
  /** Stable key used for layout persistence/export */
  key: string;
  /** Full image URL for the piece (card back scan) */
  url: string;
  /** Mirrored relative path (e.g. puzzles/os3/backs/os3back_85a.jpg) — resolved
   *  through the data mirror at render time, with `url` as last-resort fallback. */
  mirrorPath: string;
  /** Short label, e.g. "85a" */
  label: string;
}

export interface ExtraPuzzle {
  id: string;
  name: string;
  series: string;
  subtitle: string;
  /** Completed-puzzle reference sheet (also lists required card numbers) */
  referenceUrl: string;
  /** Mirrored relative path for the reference sheet. */
  referenceMirrorPath: string;
  pieces: ExtraPuzzlePiece[];
}

const GPK = 'https://geepeekay.com/gallery';

/** Reference sheet for the existing NFT-backed Series 2 puzzle (1st printing). */
export const NFT_SERIES2_REFERENCE_URL = `${GPK}/os2/puzzleback_18numbers_os2LL.jpg`;

const OS2_NUMBERS = [55, 56, 57, 58, 59, 60, 66, 67, 68, 69, 70, 71, 75, 76, 77, 78, 79, 80];
const OS3_NUMBERS = [85, 88, 89, 90, 92, 93, 94, 95, 101, 103, 107, 112, 114, 115, 121, 122, 123, 124];
/** OS5 pieces: some numbers appear as a normal + a "(V)" variant piece. */
const OS5_PIECES: Array<{ num: number; variant?: boolean }> = [
  { num: 168 }, { num: 168, variant: true },
  { num: 169 }, { num: 169, variant: true },
  { num: 171 },
  { num: 175 }, { num: 175, variant: true },
  { num: 176 }, { num: 178 }, { num: 183 }, { num: 186 }, { num: 187 },
  { num: 188 }, { num: 192 }, { num: 194 }, { num: 197 }, { num: 198 },
  { num: 199 }, { num: 200 }, { num: 203 }, { num: 205 },
];

function os2Pieces(printing: 'll' | 'lm'): ExtraPuzzlePiece[] {
  return OS2_NUMBERS.map(n => ({
    key: `${n}${printing}`,
    label: `${n}ab`,
    url: `${GPK}/os2/backs/os2_back_${n}${printing}.jpg`,
  }));
}

function os3Pieces(side: 'a' | 'b'): ExtraPuzzlePiece[] {
  return OS3_NUMBERS.map(n => ({
    key: `${n}${side}`,
    label: `${n}${side}`,
    url: `${GPK}/os3/backs/os3back_${n}${side}.JPG`,
  }));
}

function os4Pieces(): ExtraPuzzlePiece[] {
  return Array.from({ length: 21 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {
      key: `green${n}`,
      label: `${i + 1}`,
      url: `${GPK}/os4/backs/os4_back_green_${n}.jpg`,
    };
  });
}

function os5Pieces(side: 'a' | 'b'): ExtraPuzzlePiece[] {
  return OS5_PIECES.map(({ num, variant }) => ({
    key: `${num}${side}${variant ? 'v' : ''}`,
    label: `${num}${side.toUpperCase()}${variant ? ' (V)' : ''}`,
    url: `${GPK}/os5/backs/os5_back_${num}${side}${variant ? 'v' : ''}.jpg`,
  }));
}

const RAW_PUZZLES: Array<Omit<ExtraPuzzle, 'mirrorPath' | 'referenceMirrorPath'> & {
  pieces: Array<Omit<ExtraPuzzlePiece, 'mirrorPath'>>;
}> = [
  {
    id: 'os2lm',
    name: 'Live Mike / Jolted Joel',
    series: 'OS2',
    subtitle: '2nd & 3rd printing · red border',
    referenceUrl: `${GPK}/os2/puzzleback_18numbers_os2LM.jpg`,
    pieces: os2Pieces('lm'),
  },
  {
    id: 'os3a',
    name: "Snooty Sam / U.S. Arnie",
    series: 'OS3',
    subtitle: 'Puzzle A · blue border',
    referenceUrl: `${GPK}/os3/puzzleback_18numbers_os3SS.jpg`,
    pieces: os3Pieces('a'),
  },
  {
    id: 'os3b',
    name: "Mugged Marcus / Kayo'd Cody",
    series: 'OS3',
    subtitle: 'Puzzle B · yellow border',
    referenceUrl: `${GPK}/os3/puzzleback_18numbers_os3MM.jpg`,
    pieces: os3Pieces('b'),
  },
  {
    id: 'os4',
    name: 'Bony Tony / Unzipped Zack',
    series: 'OS4',
    subtitle: 'Green border · 21 pieces',
    referenceUrl: `${GPK}/os4/backs/puzzleback_os4.png`,
    pieces: os4Pieces(),
  },
  {
    id: 'os5d',
    name: 'Handy Randy / Jordan Nuts',
    series: 'OS5',
    subtitle: 'Puzzle D · orange border',
    referenceUrl: `${GPK}/os5/backs/os5_orangepuzzle.png`,
    pieces: os5Pieces('a'),
  },
  {
    id: 'os5e',
    name: 'Dee Faced / Terri Cloth',
    series: 'OS5',
    subtitle: 'Puzzle E · purple border',
    referenceUrl: `${GPK}/os5/backs/os5_purplepuzzle.png`,
    pieces: os5Pieces('b'),
  },
];

/**
 * Attach the mirrored relative path to every piece + reference sheet so the
 * builder can prefer the data mirror (with geepeekay as last-resort fallback).
 */
export const EXTRA_PUZZLES: ExtraPuzzle[] = RAW_PUZZLES.map((p) => ({
  ...p,
  referenceMirrorPath: geepeekayToMirrorPath(p.referenceUrl) ?? p.referenceUrl,
  pieces: p.pieces.map((piece) => ({
    ...piece,
    mirrorPath: geepeekayToMirrorPath(piece.url) ?? piece.url,
  })),
}));

export function getExtraPuzzle(id: string): ExtraPuzzle | undefined {
  return EXTRA_PUZZLES.find(p => p.id === id);
}
