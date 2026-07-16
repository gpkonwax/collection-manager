#!/usr/bin/env node
/**
 * verify-mirror.mjs — sha256 every file in a local mirror folder and
 * compare against the recorded values in `manifest.json`.
 *
 * Usage: node scripts/verify-mirror.mjs [dir]
 * Exits non-zero if any file is missing, extra, or corrupted.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function walk(dir, base = '') {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'manifest.json' && base === '') continue;
    const abs = path.join(dir, e.name);
    const rel = path.posix.join(base, e.name);
    if (e.isDirectory()) out.push(...await walk(abs, rel));
    else if (e.isFile()) out.push({ abs, rel });
  }
  return out;
}

export async function verify(mirrorDir) {
  const manifestPath = path.join(mirrorDir, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const expected = new Map(Object.entries(manifest.files || {}));

  const onDisk = await walk(mirrorDir);
  const seen = new Set();
  const corrupt = [];
  const extra = [];

  for (const { abs, rel } of onDisk) {
    seen.add(rel);
    const rec = expected.get(rel);
    if (!rec) { extra.push(rel); continue; }
    const buf = await fs.readFile(abs);
    if (sha256(buf) !== rec.sha256) corrupt.push(rel);
  }

  const missing = [...expected.keys()].filter((k) => !seen.has(k));
  return { checked: onDisk.length, missing, corrupt, extra };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2] ?? path.resolve(__dirname, '../mirror-output');
  verify(dir)
    .then(({ checked, missing, corrupt, extra }) => {
      console.log(`Checked ${checked} files in ${dir}`);
      if (missing.length) console.log(`  MISSING (${missing.length}):`, missing.slice(0, 10));
      if (corrupt.length) console.log(`  CORRUPT (${corrupt.length}):`, corrupt.slice(0, 10));
      if (extra.length)   console.log(`  EXTRA   (${extra.length}):`, extra.slice(0, 10));
      if (missing.length || corrupt.length) process.exit(1);
      console.log('OK');
    })
    .catch((err) => { console.error(err); process.exit(2); });
}
