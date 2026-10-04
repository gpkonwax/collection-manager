#!/usr/bin/env node
/**
 * Build the self-hosted GPK mint-number backup.
 *
 * Every gpk.topps SimpleAssets card (and every bridged AtomicAssets card, via
 * its original `sassets_id`) is looked up on AtomicHub's SimpleAssets mint
 * endpoint, which works server-side (it only blocks browsers via CORS):
 *
 *   GET https://nft-data.api.atomichub.io/v1/simpleassets/mints?asset_ids=a,b,...
 *   -> { success, data: [{ asset_id, mint, total, burned }] }
 *
 * Output (default `manifests/mints/` at the repo root, committed + deployed to
 * the gpk-data Cloudflare Pages mirror by build-data-mirror.mjs):
 *
 *   manifests/mints/index.json   { version, generatedAt, count, shardCount, shards: { "000": { count, bytes, sha256 } } }
 *   manifests/mints/000.json … 999.json
 *        { "<sa_id>": [mint, total, burned], … }   (shard = last 3 digits of the SA id)
 *
 * Inputs:
 *   - SimpleAssets ids: `gpk-sa-asset-ids.txt`, written by build-holders-manifest.mjs
 *     (looked up in mirror-output/manifests/, scripts/mirror-output/manifests/, manifests/).
 *     Override with --sa-ids <file>.
 *   - Bridged ids: paged live from the AtomicAssets API (schemas series1/series2/exotic).
 *
 * Every run refreshes every mint (≈ 1 request per 100 cards), so "of total" and
 * burned counts are always current. Entries AtomicHub fails to return are kept
 * from the previous backup, so a flaky run never loses data.
 *
 * Flags:
 *   --sa-ids <file>   SimpleAssets id list (one id per line)
 *   --out <dir>       output folder (default manifests/mints)
 *   --limit <n>       only look up the first n ids (test runs)
 *   --no-bridged      skip the AtomicAssets bridged-card listing
 *   --fresh           ignore the resumable work file from an interrupted run
 *   --incremental     only look up ids missing from the existing backup (mints never change)
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const OUT_DIR = path.resolve(ROOT, argVal('--out') || 'manifests/mints');
const LIMIT = argVal('--limit') ? parseInt(argVal('--limit'), 10) : Infinity;
const SKIP_BRIDGED = args.includes('--no-bridged');
const FRESH = args.includes('--fresh');
const INCREMENTAL = args.includes('--incremental');
// Kept outside the repo so the resumable work file is never committed.
const WORK_FILE = process.env.MINTS_WORK_FILE || path.join(os.tmpdir(), 'gpk-mints-work.ndjson');

const MINT_ENDPOINT = 'https://nft-data.api.atomichub.io/v1/simpleassets/mints';
const BATCH_SIZE = 100;
const CONCURRENCY = 4;
const MAX_ATTEMPTS = 5;
const PACING_MS = 150; // per worker, between requests
const BRIDGED_SCHEMAS = ['series1', 'series2', 'exotic'];
const AA_APIS = [
  'https://wax.api.atomicassets.io',
  'https://wax-aa.eu.eosamsterdam.net',
  'https://atomic.wax.eosrio.io',
  'https://aa.wax.blacklusion.io',
  'https://wax-atomic-api.eosphere.io',
  'https://atomic.hivebp.io',
];

const log = (m) => process.stdout.write(m + '\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
export const shardOf = (id) => String(id).slice(-3).padStart(3, '0');

async function fetchJson(url, timeout = 20_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${url.slice(0, 120)}`);
      err.status = res.status;
      err.retryAfter = Number(res.headers.get('retry-after')) || 0;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function readSaIds() {
  const explicit = argVal('--sa-ids');
  const candidates = explicit
    ? [path.resolve(ROOT, explicit)]
    : [
        path.join(ROOT, 'mirror-output', 'manifests', 'gpk-sa-asset-ids.txt'),
        path.join(ROOT, 'scripts', 'mirror-output', 'manifests', 'gpk-sa-asset-ids.txt'),
        path.join(ROOT, 'manifests', 'gpk-sa-asset-ids.txt'),
      ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const ids = (await fs.readFile(p, 'utf8')).split(/\s+/).filter((x) => /^\d+$/.test(x));
      log(`[SA] ${ids.length.toLocaleString()} SimpleAssets ids from ${path.relative(ROOT, p)}`);
      return ids;
    }
  }
  if (explicit) throw new Error(`--sa-ids file not found: ${explicit}`);
  log('[SA] WARNING: gpk-sa-asset-ids.txt not found — run build-holders-manifest.mjs first. Continuing with bridged cards only.');
  return [];
}

/**
 * Original SA ids of bridged GPK AtomicAssets cards, paged by asset_id.
 * `cursors` (schema -> next lower_bound) lets incremental runs page only cards
 * bridged since the last run. Network failures warn and keep what was found,
 * so a flaky AtomicAssets API never aborts the run.
 */
async function readBridgedSaIds(cursors = {}) {
  const out = new Set();
  const next = { ...cursors };
  for (const schema of BRIDGED_SCHEMAS) {
    let lower = cursors[schema] || '';
    let pages = 0;
    try {
      for (;;) {
        const qs = `collection_name=gpk.topps&schema_name=${schema}&limit=1000&order=asc&sort=asset_id${lower ? `&lower_bound=${lower}` : ''}`;
        let body;
        let lastErr;
        for (const base of AA_APIS) {
          try { body = await fetchJson(`${base}/atomicassets/v1/assets?${qs}`); break; } catch (e) { lastErr = e; }
        }
        if (!body) throw lastErr ?? new Error('AtomicAssets API unreachable');
        const rows = body.data || [];
        for (const a of rows) {
          const sa = a.immutable_data?.sassets_id ?? a.data?.sassets_id;
          if (sa && /^\d+$/.test(String(sa))) out.add(String(sa));
        }
        pages++;
        if (rows.length) {
          lower = String(BigInt(rows[rows.length - 1].asset_id) + 1n);
          next[schema] = lower;
        }
        process.stdout.write(`\r[AA] ${schema}: page ${pages} · ${out.size.toLocaleString()} bridged ids`);
        if (rows.length < 1000) break;
      }
      process.stdout.write('\n');
    } catch (e) {
      process.stdout.write('\n');
      log(`[AA] WARNING: ${schema} listing stopped early (${e.message}); continuing with ids found so far.`);
    }
  }
  return { ids: [...out], cursors: next };
}

async function loadPrevious() {
  const prev = new Map();
  const idx = path.join(OUT_DIR, 'index.json');
  if (!existsSync(idx)) return { prev, index: null };
  const index = JSON.parse(await fs.readFile(idx, 'utf8'));
  for (const key of Object.keys(index.shards || {})) {
    const p = path.join(OUT_DIR, `${key}.json`);
    if (!existsSync(p)) continue;
    const shard = JSON.parse(await fs.readFile(p, 'utf8'));
    for (const [id, v] of Object.entries(shard)) prev.set(id, v);
  }
  log(`[prev] ${prev.size.toLocaleString()} entries in the existing backup`);
  return { prev, index };
}

async function loadWork() {
  const got = new Map();
  const tried = new Set();
  if (FRESH || !existsSync(WORK_FILE)) {
    await fs.mkdir(path.dirname(WORK_FILE), { recursive: true });
    await fs.writeFile(WORK_FILE, '');
    return { got, tried };
  }
  for (const line of (await fs.readFile(WORK_FILE, 'utf8')).split('\n')) {
    if (!line) continue;
    try {
      const rec = JSON.parse(line);
      for (const id of rec.ids) tried.add(id);
      for (const [id, v] of Object.entries(rec.rows)) got.set(id, v);
    } catch { /* torn last line from a kill — ignore */ }
  }
  log(`[resume] ${tried.size.toLocaleString()} ids already looked up in an interrupted run`);
  return { got, tried };
}

async function lookupBatch(ids) {
  for (let attempt = 1; ; attempt++) {
    try {
      const json = await fetchJson(`${MINT_ENDPOINT}?asset_ids=${ids.join(',')}`);
      if (!json?.success || !Array.isArray(json.data)) throw new Error('unexpected response shape');
      const rows = {};
      for (const r of json.data) {
        const mint = Number(r.mint), total = Number(r.total), burned = Number(r.burned ?? 0);
        if (!r?.asset_id || !Number.isFinite(mint) || !Number.isFinite(total)) continue;
        rows[String(r.asset_id)] = [mint, total, Number.isFinite(burned) ? burned : 0];
      }
      return rows;
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS) throw e;
      const wait = e.retryAfter ? e.retryAfter * 1000 : Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500;
      await sleep(wait);
    }
  }
}

async function appendSaIdFile(newIds) {
  if (!newIds.length) return;
  const p = SA_ID_FILE;
  const existing = existsSync(p) ? (await fs.readFile(p, 'utf8')) : '';
  const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
  await fs.writeFile(p, existing + prefix + newIds.join('\n') + '\n');
  log(`[SA-new] appended ${newIds.length.toLocaleString()} new ids to ${path.relative(ROOT, p)}`);
}

async function main() {
  const started = Date.now();
  const { prev, index: prevIndex } = await loadPrevious();
  const saIds = await readSaIds();

  // Fast path for freshly opened SimpleAssets packs: page createlog actions
  // since the last bookmark, so new cards get mints before the monthly scan.
  let saCreateCursor = prevIndex?.saCreateCursor || null;
  let recentIds = [];
  if (!SKIP_RECENT) {
    const start = saCreateCursor
      || new Date(Date.parse(prevIndex?.generatedAt || Date.now()) - 2 * 86_400_000).toISOString();
    const res = await readRecentSaMints(start, { fetchJson, log });
    recentIds = res.ids;
    if (res.complete) saCreateCursor = res.cursor;
    log(`[SA-new] ${recentIds.length.toLocaleString()} gpk.topps cards minted since ${start}`);
  }
  const knownSa = new Set(saIds);
  const freshSa = recentIds.filter((id) => !knownSa.has(id));

  // Incremental runs page only cards bridged since the last saved cursor.
  const startCursors = INCREMENTAL ? (prevIndex?.bridgedCursors || {}) : {};
  const bridgedRes = SKIP_BRIDGED ? { ids: [], cursors: prevIndex?.bridgedCursors || {} } : await readBridgedSaIds(startCursors);
  const bridgedCursors = bridgedRes.cursors;
  let all = [...new Set([...saIds, ...freshSa, ...bridgedRes.ids])];
  if (Number.isFinite(LIMIT)) all = all.slice(0, LIMIT);
  log(`[mints] ${all.length.toLocaleString()} unique SimpleAssets ids considered`);
  if (!Number.isFinite(LIMIT)) await appendSaIdFile(freshSa);

  const { got, tried } = await loadWork();
  // --incremental: a card's mint never changes, so only look up ids that are
  // not in the existing backup yet (newly opened cards).
  const todo = all.filter((id) => !tried.has(id) && !(INCREMENTAL && prev.has(id)));
  if (INCREMENTAL) log(`[mints] incremental: ${todo.length.toLocaleString()} new ids not yet in the backup`);
  if (todo.length === 0 && got.size === 0) {
    log('[mints] nothing new to look up — mint backup left unchanged.');
    const cursorsChanged = JSON.stringify(prevIndex?.bridgedCursors || {}) !== JSON.stringify(bridgedCursors);
    const saCursorChanged = (prevIndex?.saCreateCursor || null) !== saCreateCursor;
    if (prevIndex && (cursorsChanged || saCursorChanged)) {
      prevIndex.bridgedCursors = bridgedCursors;
      if (saCreateCursor) prevIndex.saCreateCursor = saCreateCursor;
      await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(prevIndex, null, 2));
      log('[mints] saved bookmarks for faster future runs.');
    }
    await fs.rm(WORK_FILE, { force: true });
    return;
  }
  const batches = [];
  for (let i = 0; i < todo.length; i += BATCH_SIZE) batches.push(todo.slice(i, i + BATCH_SIZE));

  let cursor = 0, done = 0, failed = 0;
  async function worker() {
    while (cursor < batches.length) {
      const batch = batches[cursor++];
      try {
        const rows = await lookupBatch(batch);
        for (const [id, v] of Object.entries(rows)) got.set(id, v);
        await fs.appendFile(WORK_FILE, JSON.stringify({ ids: batch, rows }) + '\n');
      } catch (e) {
        failed++;
        process.stderr.write(`\n[mints] batch failed after ${MAX_ATTEMPTS} attempts: ${e.message}\n`);
      }
      done++;
      if (done % 20 === 0 || done === batches.length) {
        process.stdout.write(`\r[mints] ${done}/${batches.length} batches · ${got.size.toLocaleString()} mints`);
      }
      await sleep(PACING_MS);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  process.stdout.write('\n');

  // Merge: fresh answers win; previous backup fills anything AtomicHub skipped.
  const merged = new Map(prev);
  for (const [id, v] of got) merged.set(id, v);
  const keptFromPrev = all.filter((id) => !got.has(id) && prev.has(id)).length;

  const shards = new Map();
  for (const [id, v] of merged) {
    const k = shardOf(id);
    if (!shards.has(k)) shards.set(k, {});
    shards.get(k)[id] = v;
  }

  // Write into a staging folder, then swap, so an interrupted run never
  // leaves a half-written backup behind.
  const FINAL_DIR = OUT_DIR;
  const STAGE_DIR = `${FINAL_DIR}.tmp`;
  await fs.rm(STAGE_DIR, { recursive: true, force: true });
  await fs.mkdir(STAGE_DIR, { recursive: true });
  const index = { version: 1, generatedAt: new Date().toISOString(), count: merged.size, shardCount: 0, bridgedCursors, shards: {} };
  for (const k of [...shards.keys()].sort()) {
    const obj = shards.get(k);
    const sorted = Object.fromEntries(Object.keys(obj).sort().map((id) => [id, obj[id]]));
    const buf = Buffer.from(JSON.stringify(sorted));
    await fs.writeFile(path.join(STAGE_DIR, `${k}.json`), buf);
    index.shards[k] = { count: Object.keys(sorted).length, bytes: buf.length, sha256: sha256(buf) };
  }
  index.shardCount = Object.keys(index.shards).length;
  await fs.writeFile(path.join(STAGE_DIR, 'index.json'), JSON.stringify(index, null, 2));
  await fs.rm(FINAL_DIR, { recursive: true, force: true });
  await fs.rename(STAGE_DIR, FINAL_DIR);

  if (failed === 0) await fs.rm(WORK_FILE, { force: true });
  const totalBytes = Object.values(index.shards).reduce((s, x) => s + x.bytes, 0);
  log(`[mints] wrote ${index.shardCount} shards (${(totalBytes / 1048576).toFixed(1)} MB) + index.json to ${path.relative(ROOT, OUT_DIR)}`);
  log(`[mints] ${merged.size.toLocaleString()} mints · ${got.size.toLocaleString()} fresh · ${keptFromPrev.toLocaleString()} kept from previous backup · ${all.length - got.size - keptFromPrev} unknown to AtomicHub`);
  log(`[mints] ${((Date.now() - started) / 1000).toFixed(0)}s elapsed`);
  if (failed) {
    log(`[mints] ${failed} batches failed — re-run (without --fresh) to retry just those.`);
    process.exitCode = 2;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
