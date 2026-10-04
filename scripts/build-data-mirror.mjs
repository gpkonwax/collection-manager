#!/usr/bin/env node
/**
 * build-data-mirror.mjs — assembles a small `gpk-data` folder for a dedicated
 * Cloudflare Pages site. Contains only tiny files (no multi-gigabyte image mirror):
 *
 *   gpk-data/
 *     _headers                          (CORS so the browser may fetch it —
                                       Cloudflare Pages reads this the same
                                       way Netlify does)
 *     manifests/
 *       gpk-topps-holders.json           (View Wallet holder list)
 *       data-mirror-index.json         (sha256 + size of every file, for audit)
 *     packs/                            (pack artwork images)
 *     puzzles/                          (geepeekay card-back scans + reference sheets)
 *     retro/                            (original 1985 Series 1 & 2 card scans)
 *
 * Output: scripts/data-mirror-output/gpk-data/
 *
 * Usage:
 *   node scripts/build-data-mirror.mjs
 *
 * It is resumable: puzzle images already on disk are skipped. The holders
 * manifest is copied from the first location found (see findHoldersManifest);
 * it is never regenerated here — that is a separate 30+ minute scan.
 *
 * The puzzle URL set below mirrors src/lib/extraPuzzles.ts. If that file
 * changes, update the arrays here to match.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


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

// --- Retro 1985 scans (must match src/lib/retroScans.ts listAllRetroScanUrls) --
// Paths are relative to https://geepeekay.com/gallery/ and stored lowercased under retro/.
const RETRO_SCANS = ["os1/os1_1a.jpg", "os1/backs/os1_back_1ab.jpg", "os1/os1_1b.jpg", "os1/os1_2a.jpg", "os1/backs/os1_back_2ab.jpg", "os1/os1_2b.jpg", "os1/os1_3a.jpg", "os1/backs/os1_back_3ab.jpg", "os1/os1_3b.jpg", "os1/os1_4a.jpg", "os1/backs/os1_back_4ab.jpg", "os1/os1_4b.jpg", "os1/os1_5a.jpg", "os1/backs/os1_back_5ab.jpg", "os1/os1_5b.jpg", "os1/os1_6a.jpg", "os1/backs/os1_back_6ab.jpg", "os1/os1_6b.jpg", "os1/os1_7a.jpg", "os1/backs/os1_back_7ab.jpg", "os1/os1_7b.jpg", "os1/os1_8a.jpg", "os1/backs/os1_back_8ab.jpg", "os1/os1_8b.jpg", "os1/os1_9a.jpg", "os1/backs/os1_back_9ab.jpg", "os1/os1_9b.jpg", "os1/os1_10a.jpg", "os1/backs/os1_back_10ab.jpg", "os1/os1_10b.jpg", "os1/os1_11a.jpg", "os1/backs/os1_back_11ab.jpg", "os1/os1_11b.jpg", "os1/os1_12a.jpg", "os1/backs/os1_back_12ab.jpg", "os1/os1_12b.jpg", "os1/os1_13a.jpg", "os1/backs/os1_back_13ab.jpg", "os1/os1_13b.jpg", "os1/os1_14a.jpg", "os1/backs/os1_back_14ab.jpg", "os1/os1_14b.jpg", "os1/os1_15a.jpg", "os1/backs/os1_back_15ab.jpg", "os1/os1_15b.jpg", "os1/os1_16a.jpg", "os1/backs/os1_back_16ab.jpg", "os1/os1_16b.jpg", "os1/os1_17a.jpg", "os1/backs/os1_back_17ab.jpg", "os1/os1_17b.jpg", "os1/os1_18a.jpg", "os1/backs/os1_back_18ab.jpg", "os1/os1_18b.jpg", "os1/os1_19a.jpg", "os1/backs/os1_back_19ab.jpg", "os1/os1_19b.jpg", "os1/os1_20a.jpg", "os1/backs/os1_back_20ab.jpg", "os1/os1_20b.jpg", "os1/os1_21a.jpg", "os1/backs/os1_back_21ab.jpg", "os1/os1_21b.jpg", "os1/os1_22a.jpg", "os1/backs/os1_back_22ab.jpg", "os1/os1_22b.jpg", "os1/os1_23a.jpg", "os1/backs/os1_back_23ab.jpg", "os1/os1_23b.jpg", "os1/os1_24a.jpg", "os1/backs/os1_back_24ab.jpg", "os1/os1_24b.jpg", "os1/os1_25a.jpg", "os1/backs/os1_back_25ab.jpg", "os1/os1_25b.jpg", "os1/os1_26a.jpg", "os1/backs/os1_back_26ab.jpg", "os1/os1_26b.jpg", "os1/os1_27a.jpg", "os1/backs/os1_back_27ab.jpg", "os1/os1_27b.jpg", "os1/os1_28a.jpg", "os1/backs/os1_back_28ab.jpg", "os1/os1_28b.jpg", "os1/os1_29a.jpg", "os1/os1_29b.jpg", "os1/backs/os1_back_29b.jpg", "os1/os1_30a.jpg", "os1/backs/os1_back_30ab.jpg", "os1/os1_30b.jpg", "os1/os1_31a.jpg", "os1/backs/os1_back_31ab.jpg", "os1/os1_31b.jpg", "os1/os1_32a.jpg", "os1/backs/os1_back_32ab.jpg", "os1/os1_32b.jpg", "os1/os1_33a.jpg", "os1/backs/os1_back_33ab.jpg", "os1/os1_33b.jpg", "os1/os1_34a.jpg", "os1/backs/os1_back_34ab.jpg", "os1/os1_34b.jpg", "os1/os1_35a.jpg", "os1/backs/os1_back_35ab.jpg", "os1/os1_35b.jpg", "os1/os1_36a.jpg", "os1/backs/os1_back_36ab.jpg", "os1/os1_36b.jpg", "os1/os1_37a.jpg", "os1/backs/os1_back_37ab.jpg", "os1/os1_37b.jpg", "os1/os1_38a.jpg", "os1/backs/os1_back_38ab.jpg", "os1/os1_38b.jpg", "os1/os1_39a.jpg", "os1/backs/os1_back_39ab.jpg", "os1/os1_39b.jpg", "os1/os1_40a.jpg", "os1/backs/os1_back_40ab.jpg", "os1/os1_40b.jpg", "os1/os1_41a.jpg", "os1/backs/os1_back_41ab.jpg", "os1/os1_41b.jpg", "os2/os2_42a.jpg", "os2/os2_42b.jpg", "os2/os2_43a.jpg", "os2/backs/os2_back_43_44ll.jpg", "os2/os2_43b.jpg", "os2/os2_44a.jpg", "os2/os2_44b.jpg", "os2/os2_45a.jpg", "os2/backs/os2_back_45.jpg", "os2/os2_45b.jpg", "os2/os2_46a.jpg", "os2/os2_46b.jpg", "os2/os2_47a.jpg", "os2/os2_47b.jpg", "os2/os2_48a.jpg", "os2/os2_48b.jpg", "os2/os2_49a.jpg", "os2/backs/os2_back_49_51.jpg", "os2/os2_49b.jpg", "os2/os2_50a.jpg", "os2/os2_50b.jpg", "os2/os2_51a.jpg", "os2/os2_51b.jpg", "os2/os2_52a.jpg", "os2/backs/os2_back_52_63.jpg", "os2/os2_52b.jpg", "os2/os2_53a.jpg", "os2/backs/os2_back_53.jpg", "os2/os2_53b.jpg", "os2/os2_54a.jpg", "os2/backs/os2_back_54_65.jpg", "os2/os2_54b.jpg", "os2/os2_55a.jpg", "os2/backs/os2_back_55ll.jpg", "os2/os2_55b.jpg", "os2/os2_56a.jpg", "os2/backs/os2_back_56ll.jpg", "os2/os2_56b.jpg", "os2/os2_57a.jpg", "os2/backs/os2_back_57ll.jpg", "os2/os2_57b.jpg", "os2/os2_58a.jpg", "os2/backs/os2_back_58ll.jpg", "os2/os2_58b.jpg", "os2/os2_59a.jpg", "os2/backs/os2_back_59ll.jpg", "os2/os2_59b.jpg", "os2/os2_60a.jpg", "os2/backs/os2_back_60ll.jpg", "os2/os2_60b.jpg", "os2/os2_61a.jpg", "os2/backs/os2_back_61.jpg", "os2/os2_61b.jpg", "os2/os2_62a.jpg", "os2/backs/os2_back_62.jpg", "os2/os2_62b.jpg", "os2/os2_63a.jpg", "os2/os2_63b.jpg", "os2/os2_64a.jpg", "os2/backs/os2_back_64.jpg", "os2/os2_64b.jpg", "os2/os2_65a.jpg", "os2/os2_65b.jpg", "os2/os2_66a.jpg", "os2/backs/os2_back_66ll.jpg", "os2/os2_66b.jpg", "os2/os2_67a.jpg", "os2/backs/os2_back_67ll.jpg", "os2/os2_67b.jpg", "os2/os2_68a.jpg", "os2/backs/os2_back_68ll.jpg", "os2/os2_68b.jpg", "os2/os2_69a.jpg", "os2/backs/os2_back_69ll.jpg", "os2/os2_69b.jpg", "os2/os2_70a.jpg", "os2/backs/os2_back_70ll.jpg", "os2/os2_70b.jpg", "os2/os2_71a.jpg", "os2/backs/os2_back_71ll.jpg", "os2/os2_71b.jpg", "os2/os2_72a.jpg", "os2/backs/os2_back_72.jpg", "os2/os2_72b.jpg", "os2/os2_73a.jpg", "os2/backs/os2_back_73.jpg", "os2/os2_73b.jpg", "os2/os2_74a.jpg", "os2/backs/os2_back_42_74.jpg", "os2/os2_74b.jpg", "os2/os2_75a.jpg", "os2/backs/os2_back_75ll.jpg", "os2/os2_75b.jpg", "os2/os2_76a.jpg", "os2/backs/os2_back_76ll.jpg", "os2/os2_76b.jpg", "os2/os2_77a.jpg", "os2/backs/os2_back_77ll.jpg", "os2/os2_77b.jpg", "os2/os2_78a.jpg", "os2/backs/os2_back_78ll.jpg", "os2/os2_78b.jpg", "os2/os2_79a.jpg", "os2/backs/os2_back_79ll.jpg", "os2/os2_79b.jpg", "os2/os2_80a.jpg", "os2/backs/os2_back_80ll.jpg", "os2/os2_80b.jpg", "os2/os2_81a.jpg", "os2/backs/os2_back_81.jpg", "os2/os2_81b.jpg", "os2/os2_82a.jpg", "os2/backs/os2_back_82.jpg", "os2/os2_82b.jpg", "os2/os2_83a.jpg", "os2/backs/os2_back_42_83.jpg", "os2/os2_83b.jpg"];

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

// Cloudflare Pages (and Netlify) both read a top-level `_headers` file.
const HEADERS = `/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
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
  const candidates = [
    path.join(ROOT, 'mirror-output', 'manifests', 'gpk-topps-holders.json'),
    path.join(ROOT, 'scripts', 'mirror-output', 'manifests', 'gpk-topps-holders.json'),
    path.join(ROOT, 'manifests', 'gpk-topps-holders.json'),
    path.join(OUT_ROOT, 'incoming', 'gpk-topps-holders.json'),
    path.join(ROOT, 'public', 'manifests', 'gpk-topps-holders.json'),
    path.join(OUT, 'manifests', 'gpk-topps-holders.json'),
  ];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch { /* keep looking */ }
  }
  return null;
}

async function main() {
  log(`output: ${OUT}`);

  // Preserve a holders manifest that only exists inside OUT before we wipe it.
  let preservedHolders = null;
  try {
    preservedHolders = await fs.readFile(path.join(OUT, 'manifests', 'gpk-topps-holders.json'));
  } catch { /* none staged */ }

  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(path.join(OUT, 'manifests'), { recursive: true });
  await fs.mkdir(path.join(OUT, 'packs'), { recursive: true });

  // _headers (Netlify CORS)
  await fs.writeFile(path.join(OUT, '_headers'), HEADERS, 'utf8');

  // Holders manifest (must be pre-built via build-holders-manifest.mjs, or
  // dropped into manifests/gpk-topps-holders.json at the project root)
  const holdersSrc = await findHoldersManifest();
  if (holdersSrc) {
    await fs.copyFile(holdersSrc, path.join(OUT, 'manifests', 'gpk-topps-holders.json'));
    log(`copied holders manifest from ${path.relative(ROOT, holdersSrc)}`);
  } else if (preservedHolders) {
    await fs.writeFile(path.join(OUT, 'manifests', 'gpk-topps-holders.json'), preservedHolders);
    log('re-staged previously copied holders manifest');
  } else {
    log('WARNING: holders manifest not found. Drop it at manifests/gpk-topps-holders.json (project root) or run `node scripts/build-holders-manifest.mjs`, then re-run this script. Skipping holders manifest.');
  }

  // Mint-number backup (built by build-mint-manifest.mjs into manifests/mints/)
  const mintsSrc = path.join(ROOT, 'manifests', 'mints');
  try {
    const files = (await fs.readdir(mintsSrc)).filter((f) => /^(\d{3}|index)\.json$/.test(f));
    if (files.length) {
      await fs.mkdir(path.join(OUT, 'manifests', 'mints'), { recursive: true });
      for (const f of files) await fs.copyFile(path.join(mintsSrc, f), path.join(OUT, 'manifests', 'mints', f));
      log(`copied mint backup (${files.length} files) from manifests/mints`);
    } else {
      log('WARNING: manifests/mints is empty — run `node scripts/build-mint-manifest.mjs`. Skipping mint backup.');
    }
  } catch {
    log('WARNING: mint backup not found at manifests/mints — run `node scripts/build-mint-manifest.mjs`. Skipping mint backup.');
  }


  // Pack-opening provenance (built by backfill-pack-provenance.mjs into manifests/provenance/)
  const provSrc = path.join(ROOT, 'manifests', 'provenance');
  try {
    const files = (await fs.readdir(provSrc)).filter((f) => /^(\d{3}|index)\.json$/.test(f));
    if (files.length) {
      await fs.mkdir(path.join(OUT, 'manifests', 'provenance'), { recursive: true });
      for (const f of files) await fs.copyFile(path.join(provSrc, f), path.join(OUT, 'manifests', 'provenance', f));
      log(`copied pack provenance (${files.length} files) from manifests/provenance`);
    }
  } catch {
    log('pack provenance not built yet — skipping manifests/provenance.');
  }

  // Saved SimpleAssets transfers (collect-sa-transfers.mjs)
  try {
    await fs.copyFile(path.join(ROOT, 'manifests', 'sa-transfers.json'), path.join(OUT, 'manifests', 'sa-transfers.json'));
    log('copied saved SimpleAssets transfers');
  } catch {
    log('saved SimpleAssets transfers not built yet — skipping.');
  }

  // Records ZIP (built by build-records-zip.mjs) — optional download copy
  try {
    const recordsZip = path.join(ROOT, 'dist-records', 'gpk-records.zip');
    await fs.access(recordsZip);
    await fs.mkdir(path.join(OUT, 'downloads'), { recursive: true });
    await fs.copyFile(recordsZip, path.join(OUT, 'downloads', 'gpk-records.zip'));
    log('copied records ZIP to downloads/gpk-records.zip');
  } catch {
    log('records ZIP not built — skipping downloads/gpk-records.zip.');
  }

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

  // Retro 1985 scans (Series 1 & 2 fronts/backs)
  log(`downloading ${RETRO_SCANS.length} retro scans from geepeekay.com…`);
  let rDown = 0, rSkip = 0, rFail = 0;
  await pool(RETRO_SCANS, CONCURRENCY, async (rel) => {
    const dest = path.join(OUT, 'retro', ...rel.toLowerCase().split('/'));
    try {
      const r = await download(`${GPK}/${rel}`, dest);
      if (r === 'downloaded') rDown++; else rSkip++;
    } catch (e) {
      rFail++;
      console.error(`  ✗ retro ${rel}: ${e.message}`);
    }
  }, (done, total) => process.stdout.write(`\r  retro ${done}/${total}`));
  process.stdout.write('\n');
  log(`retro scans: ${rDown} downloaded, ${rSkip} skipped, ${rFail} failed`);
  if (rFail) console.error(`WARNING: ${rFail} retro scans failed to download.`);

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
  log(`Drag the CONTENTS of this folder into Cloudflare Pages (Upload assets):  ${OUT}`);
}

function fileCount(index) { return index.fileCount; }

main().catch((e) => { console.error(e); process.exit(1); });
