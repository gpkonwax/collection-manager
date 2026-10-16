#!/usr/bin/env node
/**
 * From manifests/aa-history/ builds:
 *   by-asset/index.json   { generatedAt, complete, upTo, cards, shards: { NNN: { count, sha256 } } }
 *   by-asset/NNN.json     { "<asset id>": { m?, t?, s?, b? } }   (see buildAaCards)
 * and, with --zip, dist-aa-history/gpk-aa-history.zip (per-card shards + raw events).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readAllRows, readAssetSnapshot, loadIndex, loadJson, buildAaCards, shardOf } from './lib/aaHistory.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (n) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : undefined; };
const DIR = path.resolve(ROOT, argVal('--dir') || 'manifests/aa-history');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

const index = await loadIndex(DIR);
const cards = buildAaCards(await readAllRows(DIR), await readAssetSnapshot(DIR), await loadJson(path.join(DIR, 'packs.json'), {}));
const shards = new Map();
for (const [id, c] of cards) {
  const k = shardOf(id);
  if (!shards.has(k)) shards.set(k, {});
  shards.get(k)[id] = c;
}
const outDir = path.join(DIR, 'by-asset');
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });
const meta = {};
for (const k of [...shards.keys()].sort()) {
  const buf = Buffer.from(JSON.stringify(shards.get(k)));
  await fs.writeFile(path.join(outDir, `${k}.json`), buf);
  meta[k] = { count: Object.keys(shards.get(k)).length, sha256: sha256(buf) };
}
// Covered up to the oldest live bookmark (the notify listing is the one that moves).
const upTo = index.sources?.notify?.after || null;
await fs.writeFile(path.join(outDir, 'index.json'), JSON.stringify({
  version: 1, generatedAt: new Date().toISOString(), complete: !!index.complete, upTo, cards: cards.size, shards: meta,
}));
const openings = [...cards.values()].filter((c) => c.m?.[0] === 'open').length;
console.log(`[aa-history views] ${cards.size.toLocaleString()} cards in ${shards.size} shards; ${openings.toLocaleString()} pack openings`);

if (args.includes('--zip')) {
  const { zipSync } = await import('fflate');
  const files = {};
  const ev = path.join(DIR, 'events');
  for (const f of (await fs.readdir(ev).catch(() => [])).filter((n) => n.endsWith('.json'))) files[`aa-history/events/${f}`] = new Uint8Array(await fs.readFile(path.join(ev, f)));
  files['aa-history/index.json'] = new Uint8Array(await fs.readFile(path.join(DIR, 'index.json')));
  for (const f of (await fs.readdir(outDir)).filter((n) => n.endsWith('.json'))) files[`aa-history/by-asset/${f}`] = new Uint8Array(await fs.readFile(path.join(outDir, f)));
  const outZip = path.join(ROOT, 'dist-aa-history');
  await fs.mkdir(outZip, { recursive: true });
  await fs.writeFile(path.join(outZip, 'gpk-aa-history.zip'), zipSync(files, { level: 6 }));
  console.log('[aa-history views] wrote dist-aa-history/gpk-aa-history.zip');
}
