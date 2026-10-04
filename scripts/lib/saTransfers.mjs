/**
 * Forward-looking log of GPK SimpleAssets transfers (plain sends and the
 * transfers executed inside this app's msig P2P trades — both appear as
 * simpleassets::transfer actions, inline or not).
 *
 * Store: manifests/sa-transfers.json
 *   { version, cursor, updatedAt, count, assets: { "<assetid>": [[ms, from, to, memo, txid], ...] } }
 */
import fs from 'node:fs/promises';

export const FULL_NODE = 'https://wax.eosdac.io';
export const PAGE_LIMIT = 100;
const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;

/** Hyperion timestamps are UTC without a zone suffix. */
export const hyperionMs = (ts) => {
  if (typeof ts !== 'string' || !ts) return NaN;
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts}Z`);
};

/** Pure: GPK transfer rows from one page of actions. */
export function extractGpkTransfers(actions, isGpk) {
  const rows = [];
  for (const a of actions || []) {
    if (a?.act?.account !== 'simpleassets' || a?.act?.name !== 'transfer') continue;
    const d = a.act.data || {};
    const t = hyperionMs(a['@timestamp'] || a.timestamp);
    if (!ACCOUNT_RE.test(d.from || '') || !ACCOUNT_RE.test(d.to || '') || !Number.isFinite(t)) continue;
    const tx = typeof a.trx_id === 'string' ? a.trx_id : '';
    for (const raw of Array.isArray(d.assetids) ? d.assetids : []) {
      const id = String(raw);
      if (/^\d+$/.test(id) && isGpk(id)) rows.push({ id, row: [t, d.from, d.to, typeof d.memo === 'string' ? d.memo : '', tx] });
    }
  }
  return rows;
}

/** Merge rows into the store; de-dupes by txid+from+to per asset, keeps newest first. Returns rows added. */
export function mergeTransfers(store, rows) {
  let added = 0;
  for (const { id, row } of rows) {
    const list = (store.assets[id] ??= []);
    if (list.some((r) => r[4] === row[4] && r[1] === row[1] && r[2] === row[2])) continue;
    list.push(row);
    list.sort((a, b) => b[0] - a[0]);
    added++;
  }
  store.count = Object.values(store.assets).reduce((n, l) => n + l.length, 0);
  return added;
}

export async function loadTransferStore(file) {
  try {
    const s = JSON.parse(await fs.readFile(file, 'utf8'));
    if (s && typeof s.assets === 'object') return s;
  } catch { /* fresh */ }
  return { version: 1, cursor: null, updatedAt: null, count: 0, assets: {} };
}

export async function writeTransferStore(file, store) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store));
  await fs.rename(tmp, file);
}

/**
 * Pages simpleassets::transfer ascending after `afterIso` on the full-history
 * node. Returns { rows, cursor, complete }; the cursor only advances to the
 * last fully read timestamp, so an outage keeps the old bookmark.
 */
export async function readTransfersSince(afterIso, isGpk, { fetchJson, log = () => {}, maxPages = 200 }) {
  const rows = [];
  let after = afterIso;
  for (let page = 0; page < maxPages; page++) {
    const qs = `filter=simpleassets:transfer&sort=asc&limit=${PAGE_LIMIT}&after=${encodeURIComponent(after)}`;
    let body;
    try {
      body = await fetchJson(`${FULL_NODE}/v2/history/get_actions?${qs}`, 30_000);
      if (!Array.isArray(body?.actions)) throw new Error('unexpected response shape');
    } catch (e) {
      log(`[SA-transfers] WARNING: history node failed (${e.message}); keeping bookmark ${after}.`);
      return { rows, cursor: after, complete: false };
    }
    rows.push(...extractGpkTransfers(body.actions, isGpk));
    const last = body.actions.at(-1);
    const lastTs = last?.['@timestamp'] || last?.timestamp;
    if (body.actions.length < PAGE_LIMIT || !lastTs) {
      return { rows, cursor: lastTs || after, complete: true };
    }
    if (lastTs === after) {
      log('[SA-transfers] WARNING: a full page shares one timestamp; resuming next run.');
      return { rows, cursor: after, complete: false };
    }
    // Re-reading the boundary timestamp is safe: merge de-dupes.
    after = lastTs;
  }
  log(`[SA-transfers] page cap reached; continuing from ${after} next run.`);
  return { rows, cursor: after, complete: false };
}
