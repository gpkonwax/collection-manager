#!/usr/bin/env node
/**
 * build-data-mirror.mjs — assembles a small `gpk-data` folder for a dedicated
 * Netlify site. Contains only tiny files (no multi-gigabyte image mirror):
 *
 *   gpk-data/
 *     _headers                          (CORS so the browser may fetch it)
 *     manifests/
 *       gpk-topps-holders.json           (View Wallet holder list)
 *       data-mirror-index.json         (sha256 + size of every file, for audit)
 *     packs/                            (pack artwork images)
 *     puzzles/                          (geepeekay card-back scans + reference sheets)
 *
 * Output: scripts/data-mirror-output/gpk-data/
 *
 * Usage:
 *   node scripts/build-data-mirror.mjs
 *
 * It is resumable: puzzle images already on disk are skipped. The holders
 * manifest is copied from mirror-output/ if present, otherwise regenerated.
 *
 * The puzzle URL set below mirrors src/lib/extraPuzzles.ts. If that file
 * changes, update the arrays here to match.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_ROOT = path.join(__dirname, 'data-mirror-output');
const OUT = path.join(OUT_ROOT, 'gpk-data');

const GPK = 'https://geepeekay.com/gallery';

// --- Puzzle URL set (must match src/lib/extraPuzzles.ts) --------------------
const OS2_NUMBERS = [55, 56, 57, 58, 59, 60, 66, 67, 68, 69, 70, 71, 75, 76, 77, 78, 79, 80];
const OS3_NUMBERS = [85, 88, 89, 90, 92, 93, 94, 95, 101, 103, 107, 112, 114, 115, 121, 122, 123, 124];
const OS5_PIECES = [
  { num: 168 }, { num: 168, variant: true },
  { num: 169 }, { num: 169, variant: true },
  { num: 171 },
  { num: 175 }, { num: 175, variant: true },
  { num: 176 }, { num: 178 }, { num: 183 }, { num: 186 }, { num: 187 },
  { num: 188 }, { num: 192 }, { num: 194 }, { num: 197 }, { num: 198 },
  { num: 199 }, { num: 200 }, { num: 203 }, { num: 205 },
];

function os2PieceUrls(printing) {
  return OS2_NUMBERS.map((n) => `${GPK}/os2/backs/os2_back_${n}${printing}.jpg`);
}
function os3PieceUrls(side) {
  return OS3_NUMBERS.map((n) => `${GPK}/os3/backs/os3back_${n}${side}.JPG`);
}
function os4PieceUrls() {
  return Array.from({ length: 21 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return `${GPK}/os4/backs/os4_back_green_${n}.jpg`;
  });
}
function os5PieceUrls(side) {
  return OS5_PIECES.map(({ num, variant }) =>
    `${GPK}/os5/backs/os5_back_${num}${side}${variant ? 'v' : ''}.jpg`,
  );
}

// Every puzzle asset referenced by extraPuzzles.ts (pieces + reference sheets).
const PUZZLE_URLS = [
  // NFT Series 2 reference (1st printing)
  `${GPK}/os2/puzzleback_18numbers_os2LL.jpg`,
  // OS2 2nd/3rd printing puzzle
  ...os2PieceUrls('lm'),
  `${GPK}/os2/puzzleback_18numbers_os2LM.jpg`,
  // OS3 puzzle A + B
  ...os3PieceUrls('a'),
  ...os3PieceUrls('b'),
  `${GPK}/os3/puzzleback_18numbers_os3SS.jpg`,
  `${GPK}/os3/puzzleback_18numbers_os3MM.jpg`,
  // OS4 puzzle
  ...os4PieceUrls(),
  `${GPK}/os4/backs/puzzleback_os4.png`,
  // OS5 puzzle D + E
  ...os5PieceUrls('a'),
  ...os5PieceUrls('b'),
  `${GPK}/os5/backs/os5_orangepuzzle.png`,
  `${GPK}/os5/backs/os5_purplepuzzle.png`,
];

// --- Pack artwork (bundled in src/assets) ----------------------------------
const PACK_ASSETS = [
  'gpk_pack_series_1_geepeekay.jpg',
  'gpk_pack_series_1_mega_geepeekay.jpg',
  'gpk_pack_series_2a_geepeekay.jpg',
  'gpk_pack_series_2b_geepeekay.jpg',
  'gpk_pack_series_2c_geepeekay.jpg',
  'gpk_pack_exotic.jpeg',
  'gpk_pack_exotic_mega.jpeg',
];

const HEADERS = `/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=300
`;

const FETCH_TIMEOUT_MS = 12_000;
const CONCURRENCY = 4;
const MAX_RETRIES = 3;

function log(...a) { console.log('[data-mirror]', ...a); }

async function fetchWithTimeout(url, opts = {}, timeout = FETCH_TIMEOUT_MS) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    return await fetch(url, { ...opts, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Map a geepeekay URL to its lowercased on-disk path under puzzles/. */
function geepeekayToDiskPath(url) {
  const m = url.match(/geepeekay\.com\/gallery\/(.+)$/i);
  if (!m) throw new Error(`Not a geepeekay gallery URL: ${url}`);
  return path.join('puzzles', m[1].toLowerCase().split('/').join(path.sep));
}

async function download(url, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  // Skip if already present.
  try {
    const stat = await fs.stat(dest);
    if (stat.size > 0) return 'skip';
  } catch { /* not present */ }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error('empty body');
      await fs.writeFile(dest, buf);
      return 'downloaded';
    } catch (e) {
      if (attempt === MAX_RETRIES) throw new Error(`Failed ${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  throw new Error(`unreachable: ${url}`);
}

async function pool(items, concurrency, worker, onProgress) {
  let i = 0, done = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
      done++;
      if (onProgress && (done % 10 === 0 || done === items.length)) onProgress(done, items.length);
    }
  });
  await Promise.all(runners);
}

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Locate the pre-built holders manifest. Does NOT regenerate it — that is a
 * 30+ minute scan the user runs deliberately via `build-holders-manifest.mjs`.
 * Returns null when absent so the caller can skip it with a clear warning.
 */
async function findHoldersManifest() {
  const staged = path.join(ROOT, 'scripts', 'mirror-output', 'manifests', 'gpk-topps-holders.json');
  try {
    await fs.access(staged);
    return staged;
  } catch {
    return null;
  }
}

async function main() {
  log(`output: ${OUT}`);
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(path.join(OUT, 'manifests'), { recursive: true });
  await fs.mkdir(path.join(OUT, 'packs'), { recursive: true });

  // _headers (Netlify CORS)
  await fs.writeFile(path.join(OUT, '_headers'), HEADERS, 'utf8');

  // Holders manifest
  const holdersSrc = await ensureHoldersManifest();
  await fs.copyFile(holdersSrc, path.join(OUT, 'manifests', 'gpk-topps-holders.json'));
  log('copied holders manifest');

  // Puzzle artwork
  log(`downloading ${PUZZLE_URLS.length} puzzle images from geepeekay.com…`);
  let downloaded = 0, skipped = 0, failed = 0;
  await pool(PUZZLE_URLS, CONCURRENCY, async (url) => {
    const rel = geepeekayToDiskPath(url);
    const dest = path.join(OUT, rel);
    try {
      const r = await download(url, dest);
      if (r === 'downloaded') downloaded++;
      else skipped++;
    } catch (e) {
      failed++;
      console.error(`  ✗ ${url}: ${e.message}`);
    }
  }, (done, total) => process.stdout.write(`\r  puzzles ${done}/${total}`));
  process.stdout.write('\n');
  log(`puzzles: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
  if (failed) console.error(`WARNING: ${failed} puzzle images failed to download.`);

  // Pack artwork (copy bundled assets)
  log(`copying ${PACK_ASSETS.length} pack images…`);
  for (const name of PACK_ASSETS) {
    const src = path.join(ROOT, 'src', 'assets', name);
    try {
      await fs.copyFile(src, path.join(OUT, 'packs', name));
    } catch (e) {
      console.error(`  ✗ pack ${name}: ${e.message}`);
    }
  }

  // data-mirror-index.json — sha256 + bytes for every file (excluding _headers
  // and the index itself), relative to the gpk-data root.
  log('building data-mirror-index.json…');
  const index = {};
  async function walk(dir, relBase) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name === '_headers' || entry.name === 'data-mirror-index.json') continue;
      const full = path.join(dir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else {
        const buf = await fs.readFile(full);
        index[rel] = { sha256: sha256Hex(buf), bytes: buf.length };
      }
    }
  }
  await walk(OUT, '');
  const indexFile = {
    generatedAt: new Date().toISOString(),
    fileCount: Object.keys(index).length,
    files: index,
  };
  await fs.writeFile(
    path.join(OUT, 'manifests', 'data-mirror-index.json'),
    JSON.stringify(indexFile, null, 2),
    'utf8',
  );

  log(`done. ${fileCount(indexFile)} files indexed.`);
  log(`Drag this folder to Netlify:  ${OUT}`);
}

function fileCount(index) { return index.fileCount; }

main().catch((e) => { console.error(e); process.exit(1); });
