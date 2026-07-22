#!/usr/bin/env node
/**
 * Build the offline-bundle ZIP: a self-contained copy of the built app that
 * users can unzip and open locally.
 *
 * Steps:
 *   1. Run `vite build` with `VITE_OFFLINE_BUNDLE=1` so the app uses relative
 *      asset URLs, HashRouter, and shows the offline banner.
 *   2. Copy `open-me.html` and `README.txt` into the build output.
 *   3. Zip the whole thing into `dist-offline/gpk-collection-manager-offline.zip`.
 *
 * Run:  npm run build:offline
 * Then upload the resulting ZIP as a second asset on the GitHub Release.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = join(ROOT, 'dist-offline');
const TEMPLATES_DIR = join(__dirname, 'offline-templates');
const ZIP_NAME = 'gpk-collection-manager-offline.zip';

function walk(dir, base = dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, base, files);
    else files.push({ rel: relative(base, p).split('\\').join('/'), abs: p });
  }
  return files;
}

console.log('[build-offline-bundle] running Vite build (VITE_OFFLINE_BUNDLE=1)…');
execSync('vite build --outDir dist-offline', {
  stdio: 'inherit',
  cwd: ROOT,
  env: { ...process.env, VITE_OFFLINE_BUNDLE: '1' },
});

if (!existsSync(OUT_DIR)) {
  throw new Error(`build output missing at ${OUT_DIR}`);
}

// Copy templates alongside index.html
for (const name of ['open-me.html', 'README.txt']) {
  const src = join(TEMPLATES_DIR, name);
  const dst = join(OUT_DIR, name);
  if (!existsSync(src)) throw new Error(`template missing: ${src}`);
  writeFileSync(dst, readFileSync(src));
  console.log(`[build-offline-bundle] wrote ${relative(ROOT, dst)}`);
}

// Zip everything except any previous zip
console.log('[build-offline-bundle] zipping…');
const files = walk(OUT_DIR).filter((f) => f.rel !== ZIP_NAME);
const zipInput = {};
for (const f of files) {
  zipInput[f.rel] = new Uint8Array(readFileSync(f.abs));
}
const zipped = zipSync(zipInput, { level: 6 });
const zipPath = join(OUT_DIR, ZIP_NAME);
mkdirSync(dirname(zipPath), { recursive: true });
writeFileSync(zipPath, zipped);

const sizeMb = (zipped.length / (1024 * 1024)).toFixed(2);
console.log(`[build-offline-bundle] wrote ${relative(ROOT, zipPath)} (${files.length} files, ${sizeMb} MB)`);
console.log('[build-offline-bundle] upload this zip as a release asset on GitHub.');
