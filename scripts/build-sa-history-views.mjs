#!/usr/bin/env node
/**
 * From manifests/sa-history/events/*.json builds:
 *   manifests/sa-history/by-asset/index.json   { generatedAt, complete, upTo, cards, shards: { NNN: { count, sha256 } } }
 *   manifests/sa-history/by-asset/NNN.json     { "<id>": [[ms, kind, from, to, amount, token, market, tx], ...] }  (last 3 digits)
 *   manifests/sa-history/summary.json          headline totals + per-day sales
 * and, with --zip, dist-sa-history/gpk-sa-history.zip (events + index + summary).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readAllRows, buildTimelines, buildSummary, loadIndex, shardOf } from './lib/saHistory.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (n) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : undefined; };
const DIR = path.resolve(ROOT, argVal('--dir') || 'manifests/sa-history');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

const index = await loadIndex(DIR);
const rows = await readAllRows(DIR);
const timelines = buildTimelines(rows);
const shards = new Map();
for (const [id, tl] of timelines) {
  const k = shardOf(id);
  if (!shards.has(k)) shards.set(k, {});
  shards.get(k)[id] = tl;
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
const upTo = Object.values(index.sources || {}).map((c) => c.after).filter(Boolean).sort()[0] || null;
await fs.writeFile(path.join(outDir, 'index.json'), JSON.stringify({
  version: 1, generatedAt: new Date().toISOString(), complete: !!index.complete, upTo, cards: timelines.size, shards: meta,
}));
const summary = buildSummary(rows, timelines);
await fs.writeFile(path.join(DIR, 'summary.json'), JSON.stringify({ ...summary, complete: !!index.complete, upTo }));
console.log(`[sa-history views] ${rows.length.toLocaleString()} rows → ${timelines.size.toLocaleString()} cards in ${shards.size} shards; ${summary.totals.sales.toLocaleString()} sales`);

if (args.includes('--zip')) {
  const { zipSync } = await import('fflate');
  const files = {};
  const ev = path.join(DIR, 'events');
  for (const f of (await fs.readdir(ev)).filter((n) => n.endsWith('.json'))) files[`sa-history/events/${f}`] = new Uint8Array(await fs.readFile(path.join(ev, f)));
  for (const f of ['index.json', 'summary.json']) files[`sa-history/${f}`] = new Uint8Array(await fs.readFile(path.join(DIR, f)));
  const zipped = zipSync(files, { level: 9 });
  await fs.mkdir(path.join(ROOT, 'dist-sa-history'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'dist-sa-history', 'gpk-sa-history.zip'), zipped);
  console.log(`[sa-history views] wrote gpk-sa-history.zip (${(zipped.length / 1048576).toFixed(1)} MB)`);
}
