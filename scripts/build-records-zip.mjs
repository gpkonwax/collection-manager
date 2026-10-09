#!/usr/bin/env node
/**
 * Packages the collection records into dist-records/gpk-records.zip:
 *   gpk-topps-holders.json, mints/index.json, mints/000-999.json, records-info.json
 * Loaded back into the app from the Offline Backup section.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'dist-records');
const ZIP = path.join(OUT_DIR, 'gpk-records.zip');

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

const holderCandidates = [
  path.join(ROOT, 'mirror-output', 'manifests', 'gpk-topps-holders.json'),
  path.join(ROOT, 'manifests', 'gpk-topps-holders.json'),
];
let holdersPath = null;
for (const c of holderCandidates) if (await exists(c)) { holdersPath = c; break; }

const mintsDir = path.join(ROOT, 'manifests', 'mints');
const mintFiles = (await fs.readdir(mintsDir)).filter((f) => /^(\d{3}|index)\.json$/.test(f)).sort();
if (!mintFiles.includes('index.json')) {
  console.error('[build-records-zip] manifests/mints/index.json missing — run build-mint-manifest.mjs first.');
  process.exit(1);
}

const files = {};
for (const f of mintFiles) files[`mints/${f}`] = new Uint8Array(await fs.readFile(path.join(mintsDir, f)));
const index = JSON.parse(Buffer.from(files['mints/index.json']).toString('utf8'));

// Optional pack-opening provenance (opener, mint date, pack).
const provDir = path.join(ROOT, 'manifests', 'provenance');
let provenanceCount = 0;
if (await exists(path.join(provDir, 'index.json'))) {
  const provFiles = (await fs.readdir(provDir)).filter((f) => /^(\d{3}|index)\.json$/.test(f));
  for (const f of provFiles) files[`provenance/${f}`] = new Uint8Array(await fs.readFile(path.join(provDir, f)));
  provenanceCount = JSON.parse(Buffer.from(files['provenance/index.json']).toString('utf8')).count ?? 0;
} else {
  console.warn('[build-records-zip] pack provenance not built yet — ZIP will not include it.');
}

// Legacy saved SimpleAssets transfers (no longer updated; full history is on the sa-history branch).
const saTransfersPath = path.join(ROOT, 'manifests', 'sa-transfers.json');
if (await exists(saTransfersPath)) files['sa-transfers.json'] = new Uint8Array(await fs.readFile(saTransfersPath));

let holderCount = 0;
let holdersGeneratedAt = null;
if (holdersPath) {
  const buf = await fs.readFile(holdersPath);
  files['gpk-topps-holders.json'] = new Uint8Array(buf);
  const h = JSON.parse(buf.toString('utf8'));
  holderCount = Array.isArray(h.holders) ? h.holders.length : 0;
  holdersGeneratedAt = h.generatedAt ?? null;
} else {
  console.warn('[build-records-zip] WARNING: holders manifest not found — ZIP will contain mint numbers only.');
}

files['records-info.json'] = strToU8(JSON.stringify({
  builtAt: new Date().toISOString(),
  mintsGeneratedAt: index.generatedAt ?? null,
  holdersGeneratedAt,
  cardCount: index.count ?? 0,
  holderCount,
  provenanceCount,
}, null, 2));

await fs.mkdir(OUT_DIR, { recursive: true });
const zipped = zipSync(files, { level: 9 });
await fs.writeFile(ZIP, zipped);
console.log(`[build-records-zip] wrote ${ZIP} (${(zipped.length / 1024 / 1024).toFixed(2)} MB, ${mintFiles.length} mint files, ${holderCount} holders)`);
