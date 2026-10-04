#!/usr/bin/env node
/**
 * Build / extend the pack-opening provenance store (manifests/provenance/).
 * See scripts/lib/provenance.mjs for the file format.
 *
 * Phases (each resumable from a cursor saved in index.json):
 *   sa       SimpleAssets packs (Series 1, Series 2, Exotic, Tiger King …):
 *            pages gpk.topps::getcards on a full-history Hyperion node from
 *            May 2020, then reads each transaction's simpleassets::createlog.
 *   pool     AtomicAssets packs delivered from gpkpools1111 with memo
 *            "<Pack> Pack Opening" (Food Fight!, GameStonk!).
 *   minted   AtomicAssets packs minted straight to the opener
 *            (crashgordon, mittens, bernventures via gpkcrashpack/burnieunpack).
 *   bridged  Bridging account for newly bridged cards (forward-only: the
 *            first run bookmarks the newest bridged card).
 *
 * Flags:
 *   --max-minutes <n>  stop cleanly after n minutes (default 330)
 *   --incremental      only phases whose backfill already finished (+ bridged)
 *   --only <a,b>       run only these phases (sa,pool,minted,bridged)
 *   --out <dir>        default manifests/provenance
 *
 * Writes `done=true|false` to $GITHUB_OUTPUT (true once every phase finished).
 * Network failures stop the affected phase and keep its old cursor; never exit 1
 * for them.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadStore, writeStore, mergeRows, hyperionMs,
  parsePackTransaction, parsePoolTransfer, parsePackMintLog, parseBridgeMintLog,
  POOL_ACCOUNT, MINTED_PACK_SCHEMAS,
} from './lib/provenance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (n) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : undefined; };
const OUT_DIR = path.resolve(ROOT, argVal('--out') || 'manifests/provenance');
const MAX_MS = (Number(argVal('--max-minutes')) || 330) * 60_000;
const INCREMENTAL = args.includes('--incremental');
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const STARTED = Date.now();
const SAVE_EVERY_MS = 5 * 60_000;

// Listing pages MUST come from a full-history node: a pruned node silently
// returns only recent actions, which would skip years of openings.
const HYPERION_FULL = ['https://wax.eosdac.io'];
// Single-transaction lookups are exact, so pruned nodes are safe fallbacks there.
const HYPERION_TX = ['https://wax.eosdac.io', 'https://wax.eosusa.io', 'https://wax.eosphere.io'];
const AA_APIS = [
  'https://wax.api.atomicassets.io',
  'https://wax-aa.eu.eosamsterdam.net',
  'https://atomic.wax.eosrio.io',
  'https://wax-atomic-api.eosphere.io',
];
const SA_START = '2020-05-01T00:00:00.000';
const SA_PAGE = 100; // eosdac rejects larger pages with HTTP 500
const CONCURRENCY = 4;
const BRIDGED_SCHEMAS = ['series1', 'series2', 'exotic'];

const log = (m) => process.stdout.write(m + '\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outOfTime = () => Date.now() - STARTED > MAX_MS;

async function fetchJsonOnce(url, timeout) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const res = await fetch(url, { signal: c.signal, headers: { accept: 'application/json' } });
    if (!res.ok) {
      const e = new Error(`HTTP ${res.status} ${url.slice(0, 140)}`);
      e.status = res.status; e.retryAfter = Number(res.headers.get('retry-after')) || 0;
      throw e;
    }
    return await res.json();
  } finally { clearTimeout(t); }
}

/** Try each base in turn, with backoff on 429/5xx; throws after all bases fail. */
async function getJson(bases, pathQs, timeout = 30_000) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const base of bases) {
      try { return await fetchJsonOnce(`${base}${pathQs}`, timeout); } catch (e) {
        lastErr = e;
        if (e.status === 429) await sleep((e.retryAfter || 5) * 1000);
      }
    }
    await sleep(2000 * 2 ** attempt);
  }
  throw lastErr ?? new Error('unreachable');
}

async function mapLimit(items, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch((e) => ({ error: e })); }
  }));
  return out;
}

const store = await loadStore(OUT_DIR);
const { entries, cursors, complete } = store;
log(`[prov] ${entries.size.toLocaleString()} cards already recorded`);
let lastSave = Date.now();
const fingerprint = () => `${entries.size}|${JSON.stringify(cursors)}|${JSON.stringify(complete)}`;
let savedPrint = fingerprint();
async function save(force = false) {
  if (!force && Date.now() - lastSave < SAVE_EVERY_MS) return;
  // Skip unchanged writes so quiet twice-daily runs don't create a commit.
  if (fingerprint() === savedPrint) return;
  savedPrint = fingerprint();
  const idx = await writeStore(OUT_DIR, store);
  lastSave = Date.now();
  log(`[prov] saved ${idx.count.toLocaleString()} cards in ${idx.shardCount} shards`);
}

// ---------- SimpleAssets packs ----------
/**
 * Every getcards transaction mints cards, so an empty answer means the node
 * doesn't hold that transaction (pruned nodes reply `executed: false` with no
 * actions). Treat that as a failure and try the next node — never record "no cards".
 */
async function readPackTx(trxId, opener) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const base of HYPERION_TX) {
      try {
        const tx = await fetchJsonOnce(`${base}/v2/history/get_transaction?id=${trxId}`, 30_000);
        const rows = parsePackTransaction(tx?.actions, opener);
        if (rows.length) return rows;
        lastErr = new Error(`no cards in transaction on ${base}`);
      } catch (e) {
        lastErr = e;
        if (e.status === 429) await sleep((e.retryAfter || 5) * 1000);
      }
    }
    await sleep(2000 * 2 ** attempt);
  }
  throw lastErr;
}

async function phaseSa() {
  const c = cursors.sa ?? { after: SA_START, trx: [] };
  let added = 0;
  for (;;) {
    if (outOfTime()) return false;
    const qs = `/v2/history/get_actions?account=gpk.topps&filter=gpk.topps:getcards&sort=asc&limit=${SA_PAGE}&after=${encodeURIComponent(c.after)}`;
    let body;
    try { body = await getJson(HYPERION_FULL, qs); } catch (e) {
      log(`[sa] WARNING: history unreachable (${e.message}); resuming next run from ${c.after}.`);
      return false;
    }
    const actions = (body.actions || []).filter((a) => a?.act?.name === 'getcards');
    const seen = new Set(c.trx);
    const todo = actions.filter((a) => !(a['@timestamp'] === c.after && seen.has(a.trx_id)));
    const results = await mapLimit(todo, (a) => readPackTx(a.trx_id, a.act.data?.from));
    // Advance only over the contiguous run of successful transactions.
    let advanced = false;
    for (let k = 0; k < todo.length; k++) {
      const r = results[k];
      if (r?.error) {
        log(`[sa] WARNING: transaction ${todo[k].trx_id} failed (${r.error.message}); resuming there next run.`);
        cursors.sa = c; await save(true);
        return false;
      }
      added += mergeRows(entries, r);
      const ts = todo[k]['@timestamp'];
      if (ts !== c.after) { c.after = ts; c.trx = []; }
      c.trx.push(todo[k].trx_id);
      advanced = true;
    }
    cursors.sa = c;
    process.stdout.write(`\r[sa] up to ${c.after} · +${added.toLocaleString()} cards`);
    await save();
    if (actions.length < SA_PAGE) { process.stdout.write('\n'); return true; }
    if (!advanced) { log(`\n[sa] WARNING: a full page shares ${c.after}; resuming next run.`); return false; }
  }
}

// ---------- AtomicAssets pool packs ----------
async function phasePool() {
  const c = cursors.pool ?? { after: 0, ids: [] };
  let added = 0;
  for (;;) {
    if (outOfTime()) return false;
    const qs = `/atomicassets/v1/transfers?sender=${POOL_ACCOUNT}&collection_name=gpk.topps&sort=created&order=asc&limit=100${c.after ? `&after=${c.after - 1}` : ''}`;
    let body;
    try { body = await getJson(AA_APIS, qs); } catch (e) {
      log(`[pool] WARNING: AtomicAssets unreachable (${e.message}); resuming next run.`);
      return false;
    }
    const rows = body.data || [];
    const seen = new Set(c.ids);
    let advanced = false;
    for (const tr of rows) {
      const ms = Number(tr.created_at_time);
      if (ms === c.after && seen.has(tr.transfer_id)) continue;
      added += mergeRows(entries, parsePoolTransfer(tr));
      if (ms !== c.after) { c.after = ms; c.ids = []; }
      c.ids.push(tr.transfer_id);
      advanced = true;
    }
    cursors.pool = c;
    process.stdout.write(`\r[pool] up to ${new Date(c.after || 0).toISOString()} · +${added.toLocaleString()} cards`);
    await save();
    if (rows.length < 100) { process.stdout.write('\n'); return true; }
    if (!advanced) { log(`\n[pool] WARNING: a full page shares one timestamp; resuming next run.`); return false; }
  }
}

// ---------- AtomicAssets minted packs ----------
async function phaseMinted() {
  const c = cursors.minted ?? {};
  for (const schema of MINTED_PACK_SCHEMAS) {
    let added = 0;
    for (;;) {
      if (outOfTime()) return false;
      const lower = c[schema] || '';
      const qs = `/atomicassets/v1/assets?collection_name=gpk.topps&schema_name=${schema}&sort=asset_id&order=asc&limit=100${lower ? `&lower_bound=${lower}` : ''}`;
      let body;
      try { body = await getJson(AA_APIS, qs); } catch (e) {
        log(`[minted] WARNING: ${schema} listing failed (${e.message}); resuming next run.`);
        return false;
      }
      const assets = body.data || [];
      const todo = assets.filter((a) => !entries.has(String(a.asset_id)));
      const logs = await mapLimit(todo, (a) =>
        getJson(AA_APIS, `/atomicassets/v1/assets/${a.asset_id}/logs?action_whitelist=logmint&page=1&limit=5&order=asc`));
      for (let k = 0; k < todo.length; k++) {
        if (logs[k]?.error) {
          log(`[minted] WARNING: logs for ${todo[k].asset_id} failed (${logs[k].error.message}); resuming next run.`);
          cursors.minted = c; await save(true);
          return false;
        }
        const mint = (logs[k].data || []).map(parsePackMintLog).find(Boolean);
        if (mint) added += mergeRows(entries, [{ id: String(todo[k].asset_id), ...mint, p: schema }]);
      }
      if (assets.length) c[schema] = String(BigInt(assets[assets.length - 1].asset_id) + 1n);
      cursors.minted = c;
      process.stdout.write(`\r[minted] ${schema}: next ${c[schema] || '-'} · +${added.toLocaleString()} cards`);
      await save();
      if (assets.length < 100) { process.stdout.write('\n'); break; }
    }
  }
  return true;
}

// ---------- bridging account, newly bridged cards ----------
async function phaseBridged() {
  const c = cursors.bridged ?? {};
  for (const schema of BRIDGED_SCHEMAS) {
    if (!c[schema]) {
      try {
        const body = await getJson(AA_APIS, `/atomicassets/v1/assets?collection_name=gpk.topps&schema_name=${schema}&sort=asset_id&order=desc&limit=1`);
        const top = body.data?.[0]?.asset_id;
        c[schema] = top ? String(BigInt(top) + 1n) : '1';
        log(`[bridged] ${schema}: bookmarked at ${c[schema]} (records bridges from now on)`);
      } catch (e) { log(`[bridged] WARNING: ${schema} bookmark failed (${e.message}).`); }
      continue;
    }
    for (;;) {
      if (outOfTime()) { cursors.bridged = c; return false; }
      const qs = `/atomicassets/v1/assets?collection_name=gpk.topps&schema_name=${schema}&sort=asset_id&order=asc&limit=100&lower_bound=${c[schema]}`;
      let body;
      try { body = await getJson(AA_APIS, qs); } catch (e) {
        log(`[bridged] WARNING: ${schema} listing failed (${e.message}); resuming next run.`);
        break;
      }
      const assets = (body.data || []);
      const bridged = assets.filter((a) => a.immutable_data?.sassets_id ?? a.data?.sassets_id);
      const logs = await mapLimit(bridged, (a) =>
        getJson(AA_APIS, `/atomicassets/v1/assets/${a.asset_id}/logs?action_whitelist=logmint&page=1&limit=5&order=asc`));
      let failedAt = -1;
      for (let k = 0; k < bridged.length; k++) {
        if (logs[k]?.error) { failedAt = k; break; }
        const b = (logs[k].data || []).map(parseBridgeMintLog).find(Boolean);
        if (b) mergeRows(entries, [{ id: String(bridged[k].asset_id), b }]);
      }
      if (failedAt >= 0) {
        log(`[bridged] WARNING: logs for ${bridged[failedAt].asset_id} failed; resuming next run.`);
        c[schema] = String(bridged[failedAt].asset_id);
        break;
      }
      if (assets.length) c[schema] = String(BigInt(assets[assets.length - 1].asset_id) + 1n);
      if (assets.length < 100) break;
    }
  }
  cursors.bridged = c;
  return true;
}

const phases = [['sa', phaseSa], ['pool', phasePool], ['minted', phaseMinted]];
for (const [name, fn] of phases) {
  if (ONLY && !ONLY.has(name)) continue;
  if (INCREMENTAL && !complete[name]) { log(`[${name}] backfill not finished yet — skipped in incremental mode.`); continue; }
  const done = await fn();
  if (done) complete[name] = true;
  if (outOfTime()) { log(`[prov] time budget reached during ${name}.`); break; }
}
if (!outOfTime() && (!ONLY || ONLY.has('bridged'))) await phaseBridged();

await save(true);
const allDone = phases.every(([n]) => complete[n]);
log(`[prov] ${entries.size.toLocaleString()} cards recorded · backfill ${allDone ? 'complete' : 'in progress'} · ${((Date.now() - STARTED) / 60000).toFixed(1)} min`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `done=${allDone}\n`);
