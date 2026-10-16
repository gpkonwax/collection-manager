/**
 * Full GPK AtomicAssets history (gpk.topps collection), see scripts/backfill-aa-history.mjs.
 *
 * Where each part comes from:
 *   - From 26 Jan 2021 the collection notifies "burnienotice" on every mint,
 *     transfer and burn, so one full-history Hyperion listing
 *     (account=burnienotice) covers them exactly, with mint recipient + minter.
 *   - Before that, transfers come from AtomicHub (paged by transfer id) and
 *     mints/burns from AtomicHub's asset table; Crash Gordon pack openings
 *     come from gpkcrashpack's own mintasset actions.
 *   - Sales come from AtomicMarket's settled sales, auctions and accepted buy
 *     offers only (never listings or payouts).
 *
 * Store (manifests/aa-history/):
 *   index.json           { version, updatedAt, complete, initialBackfillComplete, sources, months }
 *   events/YYYY-MM.json  { version, month, count, rows }
 *   assets/NNN.json      pre-notify asset snapshot { id: [template, schema, mintedMs, burnedMs, burnedBy, sassetsId, owner] }
 *   packs.json           { mintTx: packTemplateId | "" }   pack resolved from unbox.nft claim assoc_id
 *
 * Row: [ms, seq, kind, ids, from, to, amount, token, memo, tx, extra]
 *   mint     from = minter, to = new owner, extra = "schema:template"
 *   cmint    gpkcrashpack mintasset (no asset id), extra = "schema:template"
 *   transfer from -> to, memo
 *   burn     from = owner
 *   sale     from = seller, to = buyer, amount/token = settled price, extra = "sale"|"auction"|"offer", seq = market id
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const COLLECTION = 'gpk.topps';
export const NOTIFY = 'burnienotice';
export const NOTIFY_FROM = '2021-01-26T20:11:10.000';
export const NOTIFY_FROM_MS = Date.parse(`${NOTIFY_FROM}Z`);
/** AtomicHub-sourced rows overlap the Hyperion listing slightly; dedup keys make that safe. */
export const PRE_NOTIFY_UNTIL_MS = NOTIFY_FROM_MS + 60_000;
export const AA_START = '2020-06-30T00:00:00.000';
export const POOL = 'gpkpools1111';
export const BRIDGE = 'atomicbridge';
export const UNBOX_MINTER = 'premint.nft';

/**
 * Pack template for a mint, by minter + schema. Only these minters opened
 * packs; every listed (minter, schema) pair maps to exactly one pack. Pool
 * mints go to the pool first and reach the opener by transfer.
 */
export const PACK_RULES = {
  'gpkcrashpack:crashgordon': '13778',
  'burnieunpack:bernventures': '48479',
  'burnieunpack:mittens': '51437',
  'gpkpools1111:gamestonk': '53187',
  'gpkpools1111:foodfightb': '59072',
};
/** WinterCon packs opened through unbox.nft; the exact day comes from the claimed pack. */
export const UNBOX_PACKS = new Set(['59489', '59490', '59491', '59492']);

export const HYPERION_SOURCES = {
  notify: { qs: `account=${NOTIFY}&filter=atomicassets:logmint,atomicassets:logtransfer,atomicassets:logburnasset`, after: NOTIFY_FROM },
  crashmint: { qs: 'account=gpkcrashpack&filter=atomicassets:mintasset', after: AA_START, before: NOTIFY_FROM },
};

export function canRefreshHistory(index) {
  return !!(index.complete || index.initialBackfillComplete);
}

const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;
const ID_RE = /^\d+$/;
const acct = (v) => (typeof v === 'string' && ACCOUNT_RE.test(v) ? v : '');
const str = (v) => (typeof v === 'string' ? v : '');

export function hyperionMs(ts) {
  if (!ts) return NaN;
  const s = String(ts);
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
}
export const monthOf = (ms) => new Date(ms).toISOString().slice(0, 7);
export const shardOf = (id) => String(id).slice(-3).padStart(3, '0');

/** Raw integer amount -> plain decimal ("619000000", 8) -> "6.19". */
export function tokenDecimal(amount, precision) {
  const a = String(amount ?? '');
  const p = Number(precision);
  if (!/^\d+$/.test(a) || !Number.isInteger(p) || p < 0) return '';
  const padded = a.padStart(p + 1, '0');
  const whole = String(BigInt(padded.slice(0, padded.length - p)));
  const frac = p ? padded.slice(-p).replace(/0+$/, '') : '';
  return frac ? `${whole}.${frac}` : whole;
}

/** Pure: rows for one Hyperion action (gpk.topps only). */
export function classifyAaAction(a) {
  const act = a?.act;
  if (!act || act.account !== 'atomicassets') return [];
  const d = act.data || {};
  if (d.collection_name !== COLLECTION) return [];
  const ms = hyperionMs(a['@timestamp'] || a.timestamp);
  const seq = Number(a.global_sequence);
  if (!Number.isFinite(ms) || !Number.isFinite(seq)) return [];
  const tx = str(a.trx_id);
  const row = (kind, ids, from, to, memo = '', extra = '') => [ms, seq, kind, ids.join(','), from, to, '', '', memo, tx, extra];
  if (act.name === 'logmint') {
    const id = String(d.asset_id ?? '');
    const to = acct(d.new_asset_owner);
    if (!ID_RE.test(id) || !to) return [];
    return [row('mint', [id], acct(d.authorized_minter), to, '', `${str(d.schema_name)}:${String(d.template_id ?? '')}`)];
  }
  if (act.name === 'mintasset') {
    const to = acct(d.new_asset_owner);
    if (!to) return [];
    return [row('cmint', [], acct(d.authorized_minter), to, '', `${str(d.schema_name)}:${String(d.template_id ?? '')}`)];
  }
  if (act.name === 'logtransfer') {
    const ids = (Array.isArray(d.asset_ids) ? d.asset_ids : []).map(String).filter((v) => ID_RE.test(v));
    const from = acct(d.from); const to = acct(d.to);
    if (!ids.length || !from || !to) return [];
    return [row('transfer', ids, from, to, str(d.memo))];
  }
  if (act.name === 'logburnasset') {
    const id = String(d.asset_id ?? '');
    const owner = acct(d.asset_owner);
    if (!ID_RE.test(id) || !owner) return [];
    return [row('burn', [id], owner, '')];
  }
  return [];
}

/** Pure: AtomicHub transfer -> row. seq 0: these never carry a global sequence. */
export function classifyAhTransfer(t) {
  const ms = Number(t?.created_at_time);
  const from = acct(t?.sender_name); const to = acct(t?.recipient_name);
  const ids = (Array.isArray(t?.assets) ? t.assets : [])
    .filter((x) => x?.collection?.collection_name === COLLECTION || x?.collection_name === COLLECTION)
    .map((x) => String(x.asset_id)).filter((v) => ID_RE.test(v));
  if (!Number.isFinite(ms) || ms <= 0 || !from || !to || !ids.length) return [];
  return [[ms, 0, 'transfer', ids.join(','), from, to, '', '', str(t.memo), str(t.txid), '']];
}

function priceOf(p, fallbackAmount, fallbackSymbol) {
  const amount = str(p?.amount) || str(fallbackAmount);
  const precision = Number(p?.token_precision ?? 8);
  return [tokenDecimal(amount, precision), str(p?.token_symbol) || str(fallbackSymbol)];
}

/** Pure: settled AtomicMarket record -> sale row. kind = "sale" | "auction" | "offer". */
export function classifyAhSale(s, kind) {
  const ids = (Array.isArray(s?.assets) ? s.assets : [])
    .filter((x) => (x?.collection?.collection_name ?? COLLECTION) === COLLECTION)
    .map((x) => String(x.asset_id)).filter((v) => ID_RE.test(v));
  const ms = Number(s?.updated_at_time);
  const id = Number(kind === 'sale' ? s?.sale_id : kind === 'auction' ? s?.auction_id : s?.buyoffer_id);
  let seller; let buyer; let price;
  if (kind === 'offer') { seller = acct(s?.seller); buyer = acct(s?.buyer); price = priceOf(s?.price); }
  else if (kind === 'auction') { seller = acct(s?.seller); buyer = acct(s?.buyer); price = priceOf(s?.price); }
  else { seller = acct(s?.seller); buyer = acct(s?.buyer); price = priceOf(s?.price, s?.listing_price, s?.listing_symbol); }
  if (!ids.length || !seller || !buyer || !price[0] || !Number.isFinite(ms) || ms <= 0 || !Number.isFinite(id)) return [];
  return [[ms, id, 'sale', ids.join(','), seller, buyer, price[0], price[1], '', '', kind]];
}

/** Pure: pack asset id claimed from unbox.nft inside a transaction's actions, or "". */
export function unboxAssocId(actions) {
  for (const a of actions || []) {
    const act = a?.act;
    if (act?.account === 'unbox.nft' && act.name === 'claim' && act.data?.collection_name === COLLECTION) {
      const id = String(act.data.assoc_id ?? '');
      if (ID_RE.test(id)) return id;
    }
  }
  return '';
}

export const rowKey = (r) => (r[2] === 'sale' ? `sale|${r[10]}|${r[1]}` : `${r[2]}|${r[9]}|${r[3]}|${r[4]}|${r[5]}|${r[2] === 'cmint' ? `${r[0]}|${r[10]}|${r[1]}` : ''}`);

// ---------- store ----------
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const tmpName = (p) => `${p}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;

export async function writeJsonAtomic(p, value, pretty = false) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = tmpName(p);
  await fs.writeFile(tmp, JSON.stringify(value, null, pretty ? 2 : undefined));
  await fs.rename(tmp, p);
}

export async function loadIndex(dir) {
  const p = path.join(dir, 'index.json');
  if (!existsSync(p)) return { version: 1, updatedAt: null, complete: false, sources: {}, months: {} };
  return JSON.parse(await fs.readFile(p, 'utf8'));
}
export const writeIndex = (dir, index) => writeJsonAtomic(path.join(dir, 'index.json'), index, true);

export async function loadJson(p, fallback) {
  return existsSync(p) ? JSON.parse(await fs.readFile(p, 'utf8')) : fallback;
}

/** Month files loaded on demand; only touched months are rewritten. */
export class MonthStore {
  constructor(dir) { this.dir = dir; this.months = new Map(); this.dirty = new Set(); }
  async month(m) {
    let e = this.months.get(m);
    if (e) return e;
    const p = path.join(this.dir, 'events', `${m}.json`);
    const rows = existsSync(p) ? JSON.parse(await fs.readFile(p, 'utf8')).rows || [] : [];
    e = { rows, keys: new Set(rows.map(rowKey)) };
    this.months.set(m, e);
    return e;
  }
  async add(rows) {
    let added = 0;
    for (const r of rows) {
      const m = monthOf(r[0]);
      const e = await this.month(m);
      const k = rowKey(r);
      if (e.keys.has(k)) continue;
      e.keys.add(k); e.rows.push(r); this.dirty.add(m); added++;
    }
    return added;
  }
  async flush() {
    const out = {};
    const todo = [...this.dirty].sort();
    this.dirty.clear();
    try {
      for (const m of todo) {
        const e = this.months.get(m);
        e.rows.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const buf = Buffer.from(JSON.stringify({ version: 1, month: m, count: e.rows.length, rows: e.rows }));
        const p = path.join(this.dir, 'events', `${m}.json`);
        await fs.mkdir(path.dirname(p), { recursive: true });
        const tmp = tmpName(p);
        await fs.writeFile(tmp, buf);
        await fs.rename(tmp, p);
        out[m] = { count: e.rows.length, bytes: buf.length, sha256: sha256(buf) };
      }
    } catch (err) { for (const m of todo) if (!out[m]) this.dirty.add(m); throw err; }
    return out;
  }
}

export async function readAllRows(dir) {
  const evDir = path.join(dir, 'events');
  if (!existsSync(evDir)) return [];
  const rows = [];
  for (const f of (await fs.readdir(evDir)).filter((n) => /^\d{4}-\d{2}\.json$/.test(n)).sort()) {
    for (const r of JSON.parse(await fs.readFile(path.join(evDir, f), 'utf8')).rows || []) rows.push(r);
  }
  return rows;
}

export async function readAssetSnapshot(dir) {
  const d = path.join(dir, 'assets');
  const out = {};
  if (!existsSync(d)) return out;
  for (const f of (await fs.readdir(d)).filter((n) => /^\d{3}\.json$/.test(n))) Object.assign(out, JSON.parse(await fs.readFile(path.join(d, f), 'utf8')));
  return out;
}

// ---------- per-card views ----------
const SAME_MINT_MS = 1000;

/**
 * Pure: per-card records.
 *   assets: pre-notify snapshot { id: [template, schema, mintedMs, burnedMs, burnedBy, sassetsId, owner] }
 *   packs:  { mintTx: packTemplate | "" }
 * Returns Map<id, { m?, t, s, b? }>:
 *   m = ["open", ms, opener, minter, packTemplate, tx] | ["mint", ms, firstOwner, minter, "", tx]
 *       (bridge copies have no m: their bridge receipt already describes the mint)
 *   t = [[ms, from, to, memo, tx], ...]   s = [[ms, seller, buyer, amount, token, id, kind], ...]
 *   b = [ms, owner, tx]
 */
export function buildAaCards(rows, assets = {}, packs = {}) {
  const cards = new Map();
  const card = (id) => { let c = cards.get(id); if (!c) cards.set(id, (c = { t: [], s: [] })); return c; };
  const mints = new Map();
  const cmints = [];
  for (const r of rows) {
    const [ms, , kind, idList, from, to, amount, token, memo, tx, extra] = r;
    if (kind === 'cmint') { cmints.push(r); continue; }
    const ids = idList ? String(idList).split(',') : [];
    for (const id of ids) {
      const c = card(id);
      if (kind === 'mint') mints.set(id, r);
      else if (kind === 'transfer') c.t.push([ms, from, to, memo, tx]);
      else if (kind === 'burn') c.b = [ms, from, tx];
      else if (kind === 'sale') c.s.push([ms, from, to, amount, token, r[1], extra]);
    }
  }
  for (const [id, a] of Object.entries(assets)) {
    const c = card(id);
    if (!c.b && a[3] && a[4]) c.b = [a[3], a[4], ''];
  }
  for (const [id, c] of cards) {
    // Same transfer can arrive from AtomicHub and Hyperion; keep one.
    const seen = new Set();
    c.t = c.t.sort((x, y) => x[0] - y[0]).filter((t) => { const k = `${t[4]}|${t[1]}|${t[2]}`; if (seen.has(k)) return false; seen.add(k); return true; });
    c.s.sort((x, y) => x[0] - y[0]);
    const firstOwner = c.t[0]?.[1] || assets[id]?.[6] || c.b?.[1] || '';
    const mint = mints.get(id);
    if (mint) {
      const [ms, , , , minter, owner, , , , tx, extra] = mint;
      const schema = String(extra).split(':')[0];
      if (minter === BRIDGE) { /* bridge copy */ }
      else if (owner === POOL && PACK_RULES[`${POOL}:${schema}`]) {
        const delivery = c.t.find((t) => t[1] === POOL);
        if (delivery) c.m = ['open', delivery[0], delivery[2], minter, PACK_RULES[`${POOL}:${schema}`], delivery[4]];
      } else if (minter === UNBOX_MINTER) {
        const pack = packs[tx];
        c.m = ['open', ms, owner, minter, typeof pack === 'string' && UNBOX_PACKS.has(pack) ? pack : '', tx];
      } else if (PACK_RULES[`${minter}:${schema}`]) {
        c.m = ['open', ms, owner, minter, PACK_RULES[`${minter}:${schema}`], tx];
      } else {
        c.m = ['mint', ms, owner, minter, '', tx];
      }
    } else if (assets[id]) {
      const [template, schema, mintedMs, , , sassetsId] = assets[id];
      if (!sassetsId && firstOwner) {
        const cm = cmints.find((r) => r[5] === firstOwner && r[10] === `${schema}:${template}` && Math.abs(r[0] - mintedMs) <= SAME_MINT_MS);
        if (cm && PACK_RULES[`${cm[4]}:${schema}`]) c.m = ['open', mintedMs, firstOwner, cm[4], PACK_RULES[`${cm[4]}:${schema}`], cm[9]];
        else c.m = ['mint', mintedMs, firstOwner, '', '', ''];
      }
    }
    if (!c.t.length) delete c.t;
    if (!c.s.length) delete c.s;
    if (!c.m && !c.t && !c.s && !c.b) cards.delete(id);
  }
  return cards;
}
