#!/usr/bin/env node
/**
 * Build / extend the full GPK SimpleAssets history (manifests/sa-history/).
 * File format and event kinds: scripts/lib/saHistory.mjs.
 *
 * Reads every source in SOURCES in time order from the full-history node,
 * each with its own bookmark (timestamp + how many actions at that timestamp
 * were already read). Sources run side by side through one shared, polite
 * request limiter.
 *
 * Flags:
 *   --max-minutes <n>   stop cleanly after n minutes (default 320)
 *   --incremental       only run if the backfill already finished (twice-daily job)
 *   --verify            after reading, compare weekly action counts with the
 *                       node's own totals and re-read any week that differs
 *   --only <a,b>        run only these sources
 *   --from <iso> --until <iso> --out <dir>   test runs over a fixed window
 *
 * Writes done=true|false to $GITHUB_OUTPUT. Network trouble keeps bookmarks
 * and never exits 1; an empty or short reply before the end of history counts
 * as a failure, never as "nothing there".
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SOURCES, START, FULL_NODE, PAGE, MonthStore, loadIndex, writeIndex,
  classifyAction, hyperionMs, weekOf,
} from './lib/saHistory.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (n) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : undefined; };
const OUT = path.resolve(ROOT, argVal('--out') || 'manifests/sa-history');
const MAX_MS = (Number(argVal('--max-minutes')) || 320) * 60_000;
const INCREMENTAL = args.includes('--incremental');
const VERIFY = args.includes('--verify');
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const FROM = argVal('--from') || START;
const UNTIL = argVal('--until') || null;
const STARTED = Date.now();
const SAVE_EVERY_MS = 5 * 60_000;
const log = (m) => process.stdout.write(`${m}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outOfTime = () => Date.now() - STARTED > MAX_MS;

// ---------- polite shared limiter ----------
const limiter = { gap: 150, inflight: 0, max: 3, next: 0, pausedUntil: 0 };
async function request(url, timeout = 30_000) {
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      limiter.gap = Math.max(100, limiter.gap - 2);
      return body;
    } catch (e) {
      lastErr = e;
      await sleep(1000 * 2 ** attempt);
    } finally { clearTimeout(t); limiter.inflight--; }
  }
  throw lastErr;
}

// ---------- known GPK SimpleAssets ids ----------
async function loadGpkIds() {
  const ids = new Set();
  const listFile = path.join(ROOT, 'manifests', 'gpk-sa-asset-ids.txt');
  if (existsSync(listFile)) for (const id of (await fs.readFile(listFile, 'utf8')).split(/\s+/)) if (id) ids.add(id);
  for (const sub of ['provenance', 'mints']) {
    const dir = path.join(ROOT, 'manifests', sub);
    if (!existsSync(dir)) continue;
    for (const f of (await fs.readdir(dir)).filter((n) => /^\d{3}\.json$/.test(n))) {
      for (const id of Object.keys(JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')))) if (id.length >= 15) ids.add(id);
    }
  }
  return ids;
}

const index = await loadIndex(OUT);
if (INCREMENTAL && !index.complete) {
  log('[sa-history] backfill not finished yet — incremental run skipped.');
  process.exit(0);
}
const gpk = await loadGpkIds();
log(`[sa-history] ${gpk.size.toLocaleString()} known GPK SimpleAssets ids`);
const isGpk = (id) => gpk.has(id);
const store = new MonthStore(OUT);
index.sources ??= {};
index.gaps ??= [];
index.months ??= {};

let lastSave = Date.now();
// All sources share one store; saves are chained so two sources finishing a
// page in the same moment can never write the same .tmp file at once.
let saveChain = Promise.resolve();
function save() {
  lastSave = Date.now();
  const run = saveChain.then(async () => {
    Object.assign(index.months, await store.flush());
    index.updatedAt = new Date().toISOString();
    await writeIndex(OUT, index);
    lastSave = Date.now();
  });
  saveChain = run.catch(() => {});
  return run;
}
async function periodicSave() {
  try { await save(); } catch (e) { log(`[sa-history] WARNING: periodic save failed (${e.message}); will retry.`); }
}

const listUrl = (src, after, skip, before) =>
  `${FULL_NODE}/v2/history/get_actions?${src.qs}&sort=asc&limit=${PAGE}&after=${encodeURIComponent(after)}`
  + `${skip ? `&skip=${skip}` : ''}${before ? `&before=${encodeURIComponent(before)}` : ''}`;

/** Total actions the node holds for [after(+skip), before]. */
async function nodeTotal(src, after, before) {
  const body = await request(`${FULL_NODE}/v2/history/get_actions?${src.qs}&limit=1&track=true&after=${encodeURIComponent(after)}${before ? `&before=${encodeURIComponent(before)}` : ''}`);
  const v = Number(body?.total?.value);
  if (!Number.isFinite(v)) throw new Error('no total in reply');
  return v;
}

/**
 * Pages one source from cursor c until caught up / out of time / failure.
 * c = { after, skip, done, actions, weeks: { "YYYY-MM-DD": n } }
 * Returns true when it reached the end of history.
 */
async function runSource(name, src, c, endIso, onPage = () => {}) {
  let added = 0;
  for (;;) {
    if (outOfTime()) return false;
    let body;
    try {
      body = await request(listUrl(src, c.after, c.skip, endIso));
      if (!Array.isArray(body?.actions)) throw new Error('unexpected reply');
    } catch (e) {
      log(`[${name}] WARNING: history node failed (${e.message}); resuming from ${c.after} +${c.skip} next run.`);
      return false;
    }
    const acts = body.actions;
    if (acts.length < PAGE) {
      // Confirm a short page really is the end, so a flaky reply can't skip history.
      try {
        const total = await nodeTotal(src, c.after, endIso);
        if (total > c.skip + acts.length) {
          log(`[${name}] WARNING: node returned ${acts.length} rows but holds ${total - c.skip}; retrying next run.`);
          return false;
        }
      } catch (e) {
        log(`[${name}] WARNING: could not confirm end of history (${e.message}); resuming next run.`);
        return false;
      }
    }
    const rows = [];
    for (const a of acts) {
      rows.push(...classifyAction(a, isGpk));
      const w = weekOf(hyperionMs(a['@timestamp']));
      c.weeks[w] = (c.weeks[w] || 0) + 1;
      c.actions = (c.actions || 0) + 1;
    }
    // gpkmarket111 only sold GPK cards: learn ids it listed.
    if (name === 'gpkmarket') for (const r of rows) if (r[2] === 'list') for (const id of r[3].split(',')) gpk.add(id);
    added += await store.add(rows);
    const last = acts.at(-1)?.['@timestamp'];
    if (last) {
      const atLast = acts.filter((a) => a['@timestamp'] === last).length;
      if (last === c.after) c.skip += acts.length; else { c.after = last; c.skip = atLast; }
    }
    onPage(added);
    if (Date.now() - lastSave > SAVE_EVERY_MS) await periodicSave();
    if (acts.length < PAGE) return true;
  }
}

const names = Object.keys(SOURCES).filter((n) => !ONLY || ONLY.has(n));
const progress = {};
const ticker = setInterval(() => {
  log(`[sa-history] ${Math.round((Date.now() - STARTED) / 60000)} min · gap ${limiter.gap}ms · `
    + names.map((n) => `${n}: ${index.sources[n]?.after?.slice(0, 16)} +${(progress[n] || 0).toLocaleString()}`).join(' · '));
}, 60_000);

await Promise.all(names.map(async (name) => {
  const src = SOURCES[name];
  const c = (index.sources[name] ??= { after: FROM, skip: 0, done: false, actions: 0, weeks: {} });
  const end = [UNTIL, src.before].filter(Boolean).sort()[0] || null;
  if (c.done && src.before) return; // closed window already read
  const reached = await runSource(name, src, c, end, (n) => { progress[name] = n; });
  c.done = reached;
  log(`[${name}] ${reached ? 'caught up' : 'paused'} at ${c.after} · +${(progress[name] || 0).toLocaleString()} rows`);
}));

// ---------- weekly verification ----------
if (VERIFY && !outOfTime()) {
  const WEEK = 7 * 864e5;
  for (const name of names) {
    const src = SOURCES[name];
    const c = index.sources[name];
    const lastMs = hyperionMs(c.after);
    for (let w = hyperionMs(FROM); w + WEEK <= lastMs; w += WEEK) {
      if (outOfTime()) break;
      const key = new Date(w).toISOString().slice(0, 10);
      if (c.verified?.[key]) continue;
      const a = new Date(w).toISOString().slice(0, 23);
      const b = new Date(Math.min(w + WEEK, src.before ? hyperionMs(src.before) : Infinity) - 1).toISOString().slice(0, 23);
      if (hyperionMs(b) < w) continue;
      let total;
      try { total = await nodeTotal(src, a, b); } catch { break; }
      if (total !== (c.weeks[key] || 0)) {
        log(`[${name}] week ${key}: node ${total}, read ${c.weeks[key] || 0} — re-reading.`);
        const tmp = { after: a, skip: 0, weeks: {}, actions: 0 };
        const ok = await runSource(name, src, tmp, b);
        if (!ok) { index.gaps = [...new Set([...index.gaps, `${name}:${key}`])]; continue; }
        c.weeks[key] = tmp.weeks[key] || 0;
        if (c.weeks[key] !== total) { index.gaps = [...new Set([...index.gaps, `${name}:${key}`])]; continue; }
      }
      (c.verified ??= {})[key] = true;
      index.gaps = index.gaps.filter((g) => g !== `${name}:${key}`);
    }
  }
}

clearInterval(ticker);
index.complete = Object.keys(SOURCES).every((n) => index.sources[n]?.done) && !UNTIL;
await save();
const done = index.complete;
log(`[sa-history] ${done ? 'backfill complete' : 'more to read'} · ${Object.values(index.months).reduce((n, m) => n + m.count, 0).toLocaleString()} rows stored · gaps: ${index.gaps.length}`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `done=${done}\n`);
