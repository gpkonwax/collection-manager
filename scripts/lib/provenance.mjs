/**
 * Pack-opening provenance: who opened the pack a card came from, when the
 * card was minted, and which pack. Pure parsers + the sharded store.
 *
 * Store (manifests/provenance/):
 *   index.json  { version, generatedAt, count, shards: { "000": { count, bytes, sha256 } }, cursors, complete }
 *   000.json … 999.json   { "<asset id>": { o, t?, p?, n?, b? } }
 *     o = account that opened the pack (received the card from the pack)
 *     t = epoch ms the card was minted
 *     p = pack code (SimpleAssets category, AtomicAssets schema, or pool pack name)
 *     n = number of cards in that pack opening
 *     b = account that bridged this AtomicAssets copy (keyed by AA asset id)
 * Keys: SimpleAssets id for SimpleAssets pack cards, AtomicAssets id otherwise.
 * Shard = last 3 digits of the id (same rule as the mint backup).
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const AUTHOR = 'gpk.topps';
export const POOL_ACCOUNT = 'gpkpools1111';
/** Contracts that mint cards straight into the opener's wallet (verified via logmint). */
export const PACK_MINTERS = new Set(['gpkcrashpack', 'burnieunpack']);
export const MINTED_PACK_SCHEMAS = ['crashgordon', 'mittens', 'bernventures'];
const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;
const ID_RE = /^\d+$/;

export const shardOf = (id) => String(id).slice(-3).padStart(3, '0');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** Hyperion timestamps have no zone suffix but are UTC. */
export function hyperionMs(ts) {
  if (!ts) return NaN;
  const s = String(ts);
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
}

/**
 * One SimpleAssets pack-opening transaction (Hyperion get_transaction actions).
 * Returns [{ id, o, t, p, n }] for every gpk.topps createlog in it.
 */
export function parsePackTransaction(actions, fallbackOpener) {
  const logs = (actions || []).filter((a) => a?.act?.account === 'simpleassets'
    && a.act.name === 'createlog' && a.act.data?.author === AUTHOR);
  const rows = [];
  for (const a of logs) {
    const d = a.act.data;
    const id = d.assetid != null ? String(d.assetid) : '';
    const o = ACCOUNT_RE.test(d.owner || '') ? d.owner : fallbackOpener;
    const t = hyperionMs(a['@timestamp'] || a.timestamp);
    if (!ID_RE.test(id) || !ACCOUNT_RE.test(o || '')) continue;
    rows.push({ id, o, ...(Number.isFinite(t) ? { t } : {}), ...(d.category ? { p: String(d.category) } : {}) });
  }
  // createlog can appear twice for one asset on some nodes — de-duplicate.
  const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
  return unique.map((r) => ({ ...r, n: unique.length }));
}

/** gpkpools1111 → opener transfer with memo "<Pack> Pack Opening". */
export function parsePoolTransfer(tr) {
  if (!tr || tr.sender_name !== POOL_ACCOUNT) return [];
  const m = /^(.+?) Pack Opening$/.exec(String(tr.memo || '').trim());
  const o = tr.recipient_name;
  if (!m || !ACCOUNT_RE.test(o || '')) return [];
  const assets = (tr.assets || []).filter((a) => a?.collection?.collection_name === undefined || a.collection.collection_name === AUTHOR);
  return assets
    .filter((a) => ID_RE.test(String(a.asset_id)))
    .map((a) => {
      const t = Number(a.minted_at_time);
      return { id: String(a.asset_id), o, ...(Number.isFinite(t) && t > 0 ? { t } : {}), p: m[1], n: assets.length };
    });
}

/** AtomicAssets logmint log → { o, t } only when minted by a pack contract. */
export function parsePackMintLog(log) {
  if (log?.name !== 'logmint') return null;
  const d = log.data || {};
  if (!PACK_MINTERS.has(d.authorized_minter)) return null;
  if (!ACCOUNT_RE.test(d.new_asset_owner || '')) return null;
  const t = Number(log.created_at_time);
  return { o: d.new_asset_owner, ...(Number.isFinite(t) && t > 0 ? { t } : {}) };
}

/** AtomicAssets logmint log → bridging account (new owner at mint). */
export function parseBridgeMintLog(log) {
  if (log?.name !== 'logmint') return null;
  const o = log.data?.new_asset_owner;
  return ACCOUNT_RE.test(o || '') ? o : null;
}

/** Merge rows into the store. Recorded opener/mint/pack never change; `b` fills in. */
export function mergeRows(entries, rows) {
  let added = 0;
  for (const { id, ...rest } of rows) {
    const prev = entries.get(id);
    if (!prev) { entries.set(id, rest); added++; continue; }
    const next = { ...prev };
    for (const [k, v] of Object.entries(rest)) if (next[k] === undefined) next[k] = v;
    entries.set(id, next);
  }
  return added;
}

export async function loadStore(dir) {
  const entries = new Map();
  const idxPath = path.join(dir, 'index.json');
  if (!existsSync(idxPath)) return { entries, cursors: {}, complete: {} };
  const index = JSON.parse(await fs.readFile(idxPath, 'utf8'));
  for (const key of Object.keys(index.shards || {})) {
    const p = path.join(dir, `${key}.json`);
    if (!existsSync(p)) continue;
    for (const [id, v] of Object.entries(JSON.parse(await fs.readFile(p, 'utf8')))) entries.set(id, v);
  }
  return { entries, cursors: index.cursors || {}, complete: index.complete || {} };
}

/** Write via a staging folder and swap, so a killed run never leaves half a store. */
export async function writeStore(dir, { entries, cursors, complete }) {
  const shards = new Map();
  for (const [id, v] of entries) {
    const k = shardOf(id);
    if (!shards.has(k)) shards.set(k, {});
    shards.get(k)[id] = v;
  }
  const stage = `${dir}.tmp`;
  await fs.rm(stage, { recursive: true, force: true });
  await fs.mkdir(stage, { recursive: true });
  const index = { version: 1, generatedAt: new Date().toISOString(), count: entries.size, shardCount: 0, cursors, complete, shards: {} };
  for (const k of [...shards.keys()].sort()) {
    const obj = shards.get(k);
    const sorted = Object.fromEntries(Object.keys(obj).sort().map((id) => [id, obj[id]]));
    const buf = Buffer.from(JSON.stringify(sorted));
    await fs.writeFile(path.join(stage, `${k}.json`), buf);
    index.shards[k] = { count: Object.keys(sorted).length, bytes: buf.length, sha256: sha256(buf) };
  }
  index.shardCount = Object.keys(index.shards).length;
  await fs.writeFile(path.join(stage, 'index.json'), JSON.stringify(index, null, 2));
  await fs.rm(dir, { recursive: true, force: true });
  await fs.rename(stage, dir);
  return index;
}
