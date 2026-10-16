#!/usr/bin/env node
/**
 * Build / extend the full GPK AtomicAssets history (manifests/aa-history/).
 * File format and sources: scripts/lib/aaHistory.mjs.
 *
 * Flags:
 *   --max-minutes <n>   stop cleanly after n minutes (default 320)
 *   --incremental       only run once the initial backfill has finished
 *   --only <a,b>        run only these sources
 *   --out <dir>         store folder (tests)
 *
 * Writes done=true|false to $GITHUB_OUTPUT. Network trouble keeps bookmarks
 * and never exits 1; a short or empty reply before the end of history counts
 * as a failure, never as "nothing there".
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HYPERION_SOURCES, NOTIFY_FROM_MS, PRE_NOTIFY_UNTIL_MS, COLLECTION, UNBOX_MINTER,
  MonthStore, loadIndex, writeIndex, loadJson, writeJsonAtomic, shardOf,
  classifyAaAction, classifyAhTransfer, classifyAhSale, unboxAssocId, hyperionMs, canRefreshHistory, readAllRows,
} from './lib/aaHistory.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (n) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : undefined; };
const OUT = path.resolve(ROOT, argVal('--out') || 'manifests/aa-history');
const MAX_MS = (Number(argVal('--max-minutes')) || 320) * 60_000;
const INCREMENTAL = args.includes('--incremental');
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const FULL_NODE = 'https://wax.eosdac.io';
const AH = ['https://wax.api.atomicassets.io', 'https://wax-aa.eosdac.io'];
const PAGE = 100;
const AH_TRANSFER_PAGE = 100; // AtomicHub's transfer listing rejects larger pages
const STARTED = Date.now();
const SAVE_EVERY_MS = 5 * 60_000;
const log = (m) => process.stdout.write(`${m}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outOfTime = () => Date.now() - STARTED > MAX_MS;

// ---------- polite shared limiter ----------
const limiter = { gap: 150, inflight: 0, max: 3, next: 0, pausedUntil: 0 };
async function request(url, timeout = 45_000) {
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    while (limiter.inflight >= limiter.max || Date.now() < limiter.next || Date.now() < limiter.pausedUntil) await sleep(25);
    limiter.inflight++;
    limiter.next = Date.now() + limiter.gap;
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeout);
    try {
      const res = await fetch(url, { signal: c.signal, headers: { accept: 'application/json' } });
      if (res.status === 429 || res.status >= 500) {
        const wait = (Number(res.headers.get('retry-after')) || 10) * 1000 * (attempt + 1);
        limiter.pausedUntil = Date.now() + wait;
        limiter.gap = Math.min(2000, Math.round(limiter.gap * 1.5));
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        // A plain 4xx is a bad request, not a busy server: retrying cannot help.
        const err = new Error(`HTTP ${res.status}`);
        err.fatal = true;
        throw err;
      }
      const body = await res.json();
      limiter.gap = Math.max(100, limiter.gap - 2);
      return body;
    } catch (e) {
      lastErr = e;
      if (e.fatal) break;
      await sleep(1000 * 2 ** attempt);
    } finally { clearTimeout(t); limiter.inflight--; }
  }
  throw lastErr;
}
/** AtomicHub with endpoint fallback; a reply without success/data is a failure. */
async function ah(p) {
  let lastErr;
  for (const base of AH) {
    try {
      const body = await request(`${base}${p}`);
      if (!body?.success || !Array.isArray(body.data)) throw new Error(body?.message || 'unexpected reply');
      return body.data;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const index = await loadIndex(OUT);
if (index.complete) index.initialBackfillComplete = true;
if (INCREMENTAL && !canRefreshHistory(index)) {
  log('[aa-history] backfill not finished yet — incremental run skipped.');
  process.exit(0);
}
index.sources ??= {};
index.months ??= {};
const store = new MonthStore(OUT);
const packsPath = path.join(OUT, 'packs.json');
const packs = await loadJson(packsPath, {});

let lastSave = Date.now();
let saveChain = Promise.resolve();
function save() {
  lastSave = Date.now();
  const run = saveChain.then(async () => {
    Object.assign(index.months, await store.flush());
    await writeJsonAtomic(packsPath, packs);
    index.updatedAt = new Date().toISOString();
    await writeIndex(OUT, index);
    lastSave = Date.now();
  });
  saveChain = run.catch(() => {});
  return run;
}
async function maybeSave() {
  if (Date.now() - lastSave <= SAVE_EVERY_MS) return;
  try { await save(); } catch (e) { log(`[aa-history] WARNING: periodic save failed (${e.message}); will retry.`); }
}
const cursor = (name, init) => (index.sources[name] ??= { done: false, actions: 0, ...init });

// ---------- Hyperion listings (same paging as the SimpleAssets backfill) ----------
const listUrl = (src, after, skip, before) =>
  `${FULL_NODE}/v2/history/get_actions?${src.qs}&sort=asc&limit=${PAGE}&after=${encodeURIComponent(after)}`
  + `${skip ? `&skip=${skip}` : ''}${before ? `&before=${encodeURIComponent(before)}` : ''}`;
async function nodeTotal(src, after, before) {
  const body = await request(`${FULL_NODE}/v2/history/get_actions?${src.qs}&limit=1&track=true&after=${encodeURIComponent(after)}${before ? `&before=${encodeURIComponent(before)}` : ''}`);
  const v = Number(body?.total?.value);
  if (!Number.isFinite(v)) throw new Error('no total in reply');
  return v;
}
async function runHyperion(name) {
  const src = HYPERION_SOURCES[name];
  const c = cursor(name, { after: src.after, skip: 0 });
  if (c.done && src.before) return true; // closed window already read
  for (;;) {
    if (outOfTime()) return false;
    let body;
    try {
      body = await request(listUrl(src, c.after, c.skip, src.before));
      if (!Array.isArray(body?.actions)) throw new Error('unexpected reply');
    } catch (e) { log(`[${name}] WARNING: history node failed (${e.message}); resuming from ${c.after} +${c.skip} next run.`); return false; }
    const acts = body.actions;
    if (acts.length < PAGE) {
      try {
        const total = await nodeTotal(src, c.after, src.before);
        if (total > c.skip + acts.length) { log(`[${name}] WARNING: node returned ${acts.length} rows but holds ${total - c.skip}; retrying next run.`); return false; }
      } catch (e) { log(`[${name}] WARNING: could not confirm end of history (${e.message}); resuming next run.`); return false; }
    }
    const rows = acts.flatMap(classifyAaAction);
    await store.add(rows);
    c.actions += acts.length;
    const last = acts.at(-1)?.['@timestamp'];
    if (last) {
      const atLast = acts.filter((a) => a['@timestamp'] === last).length;
      if (last === c.after) c.skip += acts.length; else { c.after = last; c.skip = atLast; }
    }
    await maybeSave();
    if (acts.length < PAGE) return true;
  }
}

// ---------- AtomicHub: transfers before the notify account existed ----------
async function runAhTransfers() {
  const c = cursor('ahtransfers', { lowerBound: '1' });
  if (c.done) return true;
  for (;;) {
    if (outOfTime()) return false;
    let data;
    try { data = await ah(`/atomicassets/v1/transfers?collection_name=${COLLECTION}&order=asc&limit=${AH_TRANSFER_PAGE}&lower_bound=${c.lowerBound}`); }
    catch (e) { log(`[ahtransfers] WARNING: AtomicHub failed (${e.message}); resuming next run.`); return false; }
    const keep = data.filter((t) => Number(t.created_at_time) < PRE_NOTIFY_UNTIL_MS);
    await store.add(keep.flatMap(classifyAhTransfer));
    c.actions += keep.length;
    if (data.length) c.lowerBound = String(BigInt(data.at(-1).transfer_id) + 1n);
    await maybeSave();
    if (keep.length < data.length || data.length < AH_TRANSFER_PAGE) {
      if (data.length < AH_TRANSFER_PAGE && keep.length === data.length) {
        // A short page must really be the end of the pre-notify window.
        log('[ahtransfers] WARNING: AtomicHub ended before the notify window; retrying next run.');
        return false;
      }
      return true;
    }
  }
}

// ---------- AtomicHub: snapshot of assets minted before the notify account ----------
async function runAssets() {
  const c = cursor('assets', { lowerBound: '1' });
  if (c.done) return true;
  const dir = path.join(OUT, 'assets');
  const shards = new Map();
  const shard = async (k) => {
    let s = shards.get(k);
    if (!s) shards.set(k, (s = await loadJson(path.join(dir, `${k}.json`), {})));
    return s;
  };
  const flush = async () => { for (const [k, s] of shards) await writeJsonAtomic(path.join(dir, `${k}.json`), s); };
  for (;;) {
    if (outOfTime()) { await flush(); return false; }
    let data;
    try { data = await ah(`/atomicassets/v1/assets?collection_name=${COLLECTION}&sort=asset_id&order=asc&limit=1000&lower_bound=${c.lowerBound}`); }
    catch (e) { await flush(); log(`[assets] WARNING: AtomicHub failed (${e.message}); resuming next run.`); return false; }
    let reached = false;
    for (const a of data) {
      const minted = Number(a.minted_at_time);
      if (minted >= PRE_NOTIFY_UNTIL_MS) { reached = true; break; }
      const s = await shard(shardOf(a.asset_id));
      s[a.asset_id] = [
        String(a.template?.template_id ?? ''), String(a.schema?.schema_name ?? ''), minted,
        Number(a.burned_at_time) || 0, a.burned_by_account || '', String(a.data?.sassets_id ?? a.immutable_data?.sassets_id ?? ''), a.owner || '',
      ];
      c.actions++;
    }
    if (data.length) c.lowerBound = String(BigInt(data.at(-1).asset_id) + 1n);
    if (reached) { await flush(); return true; }
    if (data.length < 1000) { await flush(); log('[assets] WARNING: AtomicHub ended before the notify window; retrying next run.'); return false; }
    if (Date.now() - lastSave > SAVE_EVERY_MS) { await flush(); await maybeSave(); }
  }
}

// ---------- AtomicMarket: settled sales, auctions, accepted buy offers ----------
const MARKET_SOURCES = {
  sales: { path: `/atomicmarket/v1/sales?collection_name=${COLLECTION}&state=3&sort=updated&order=asc&limit=${PAGE}`, kind: 'sale' },
  auctions: { path: `/atomicmarket/v1/auctions?collection_name=${COLLECTION}&state=3&sort=updated&order=asc&limit=${PAGE}`, kind: 'auction' },
  buyoffers: { path: `/atomicmarket/v1/buyoffers?collection_name=${COLLECTION}&state=3&sort=updated&order=asc&limit=${PAGE}`, kind: 'offer' },
};
async function runMarket(name) {
  const src = MARKET_SOURCES[name];
  const c = cursor(name, { afterMs: 0, page: 1 });
  for (;;) {
    if (outOfTime()) return false;
    let data;
    // after is exclusive: step back 1 ms and let row keys drop repeats.
    try { data = await ah(`${src.path}${c.afterMs > 0 ? `&after=${c.afterMs - 1}` : ''}&page=${c.page}`); }
    catch (e) { log(`[${name}] WARNING: AtomicHub failed (${e.message}); resuming next run.`); return false; }
    await store.add(data.flatMap((s) => classifyAhSale(s, src.kind)));
    c.actions += data.length;
    const last = Number(data.at(-1)?.updated_at_time);
    if (Number.isFinite(last) && last > c.afterMs) { c.afterMs = last; c.page = 1; }
    else if (data.length === PAGE) c.page++;
    await maybeSave();
    if (data.length < PAGE) { c.page = 1; return true; }
  }
}

// ---------- WinterCon pack per unbox.nft claim ----------
async function runPacks() {
  const rows = await readAllRows(OUT);
  const todo = [...new Set(rows.filter((r) => r[2] === 'mint' && r[4] === UNBOX_MINTER && r[9] && !(r[9] in packs)).map((r) => r[9]))];
  log(`[packs] ${todo.length.toLocaleString()} unbox transactions to resolve`);
  const assoc = new Map();
  for (const tx of todo) {
    if (outOfTime()) break;
    let body;
    try { body = await request(`${FULL_NODE}/v2/history/get_transaction?id=${tx}`); }
    catch (e) { log(`[packs] WARNING: transaction lookup failed (${e.message}); resuming next run.`); break; }
    if (!Array.isArray(body?.actions) || !body.actions.length) continue; // empty reply = retry next run
    const id = unboxAssocId(body.actions);
    if (id) assoc.set(tx, id); else packs[tx] = '';
  }
  const ids = [...new Set(assoc.values())];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    let data;
    try { data = await ah(`/atomicassets/v1/assets?ids=${batch.join(',')}&limit=100`); }
    catch (e) { log(`[packs] WARNING: pack template lookup failed (${e.message}); resuming next run.`); break; }
    const tpl = new Map(data.map((a) => [String(a.asset_id), String(a.template?.template_id ?? '')]));
    for (const [tx, id] of assoc) if (batch.includes(id) && tpl.get(id)) packs[tx] = tpl.get(id);
  }
  await maybeSave();
  return todo.every((tx) => tx in packs);
}

const ticker = setInterval(() => {
  log(`[aa-history] ${Math.round((Date.now() - STARTED) / 60000)} min · gap ${limiter.gap}ms · `
    + Object.entries(index.sources).map(([n, c]) => `${n}: ${c.after?.slice(0, 16) ?? c.lowerBound ?? c.afterMs} (${(c.actions || 0).toLocaleString()})`).join(' · '));
}, 60_000);

const want = (n) => !ONLY || ONLY.has(n);
const tasks = [];
for (const n of Object.keys(HYPERION_SOURCES)) if (want(n)) tasks.push([n, () => runHyperion(n)]);
if (want('ahtransfers')) tasks.push(['ahtransfers', runAhTransfers]);
if (want('assets')) tasks.push(['assets', runAssets]);
for (const n of Object.keys(MARKET_SOURCES)) if (want(n)) tasks.push([n, () => runMarket(n)]);
await Promise.all(tasks.map(async ([name, fn]) => {
  const reached = await fn();
  index.sources[name].done = reached;
  log(`[${name}] ${reached ? 'caught up' : 'paused'}`);
}));
await save();
if (want('packs') && !outOfTime()) {
  const c = cursor('packs', {});
  c.done = await runPacks();
}

clearInterval(ticker);
const ALL = [...Object.keys(HYPERION_SOURCES), 'ahtransfers', 'assets', ...Object.keys(MARKET_SOURCES), 'packs'];
index.complete = ALL.every((n) => index.sources[n]?.done);
if (index.complete) index.initialBackfillComplete = true;
await save();
log(`[aa-history] ${index.complete ? 'backfill complete' : 'more to read'} · ${Object.values(index.months).reduce((n, m) => n + m.count, 0).toLocaleString()} rows stored`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `done=${index.complete}\n`);
void hyperionMs; void NOTIFY_FROM_MS;
