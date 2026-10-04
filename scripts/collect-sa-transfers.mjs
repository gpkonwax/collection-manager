#!/usr/bin/env node
/**
 * Records new GPK SimpleAssets transfers since the saved bookmark into
 * manifests/sa-transfers.json. Run by the twice-daily mint workflow.
 * Recording starts at START on the first run; older history is not backfilled.
 * Exit 0 always on network trouble (bookmark kept); exit 1 only on bad local files.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTransfersSince, loadTransferStore, writeTransferStore, mergeTransfers } from './lib/saTransfers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORE = path.join(ROOT, 'manifests', 'sa-transfers.json');
const START = '2026-10-01T00:00:00';

async function fetchJson(url, timeout) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally { clearTimeout(timer); }
  }
  throw new Error('rate limited');
}

// Every known GPK SimpleAssets id: holders scan list + mint backup keys.
const gpk = new Set((await fs.readFile(path.join(ROOT, 'manifests', 'gpk-sa-asset-ids.txt'), 'utf8')).split(/\s+/).filter(Boolean));
const mintsDir = path.join(ROOT, 'manifests', 'mints');
for (const f of (await fs.readdir(mintsDir)).filter((n) => /^\d{3}\.json$/.test(n))) {
  for (const id of Object.keys(JSON.parse(await fs.readFile(path.join(mintsDir, f), 'utf8')))) gpk.add(id);
}
console.log(`[SA-transfers] ${gpk.size} known GPK SimpleAssets ids`);

const store = await loadTransferStore(STORE);
const from = store.cursor || START;
const { rows, cursor, complete } = await readTransfersSince(from, (id) => gpk.has(id), { fetchJson, log: console.log });
const added = mergeTransfers(store, rows);
const changed = added > 0 || cursor !== store.cursor;
store.cursor = cursor;
if (changed) {
  store.updatedAt = new Date().toISOString();
  await writeTransferStore(STORE, store);
}
console.log(`[SA-transfers] from ${from} → ${cursor} (${complete ? 'complete' : 'partial'}); ${added} new, ${store.count} total.`);
