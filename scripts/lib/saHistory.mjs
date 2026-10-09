/**
 * Full GPK SimpleAssets market + ownership history (see scripts/backfill-sa-history.mjs).
 *
 * Store (manifests/sa-history/):
 *   index.json           { version, updatedAt, complete, sources: { <name>: cursor }, months: { "YYYY-MM": { count, bytes, sha256 } }, gaps }
 *   events/YYYY-MM.json  { version, month, count, rows: [row, ...] }   rows sorted by global sequence
 *
 * Row (one per chain action; a SimpleMarket buylog gives one row per seller):
 *   [ms, seq, kind, ids, from, to, amount, token, market, memo, tx]
 *   ids    comma-joined GPK SimpleAssets ids ("" for pack tokens)
 *   amount decimal string without trailing zeros ("" when none)
 *   market "gpk" (gpkmarket111) | "sm" (simplemarket) | "cio" (collectables.io market.place) | ""
 *   memo   kept only where it carries information the kind doesn't
 *
 * Kinds:
 *   list      card sent to a market for sale (amount = asking price)
 *   cancel    market returned an unsold card to its seller
 *   sale      card sold: from = seller ("" if not on this row), to = buyer, amount = price
 *   pay       market paid the seller (amount = seller's share)
 *   buy       buyer paid the market
 *   fee       market fee / Topps fee (memo says which)
 *   split     SimpleMarket percentage payout before buylogs existed (memo keeps the %)
 *   refund    market refunded a card or payment
 *   reprice   SimpleMarket price change
 *   transfer, offer, unoffer, claim, burn
 *   bridge    sent to atomicbridge (SimpleAssets -> AtomicAssets)
 *   unbridge  returned by atomicbridge (AtomicAssets -> SimpleAssets)
 *   pack      packs.topps token transfer (amount + token = pack count + symbol)
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const START = '2020-05-11T00:00:00.000'; // first GPK SimpleAssets cards: 12 May 2020
export const FULL_NODE = 'https://wax.eosdac.io';
export const PAGE = 100; // eosdac maximum
export const GPK_MARKET = 'gpkmarket111';
export const SIMPLE_MARKET = 'simplemarket';
export const BRIDGE = 'atomicbridge';
export const MARKETS = { [GPK_MARKET]: 'gpk', [SIMPLE_MARKET]: 'sm', 'market.place': 'cio' };
export const BUYLOG_FROM = '2020-07-01T00:00:00.000'; // SimpleMarket buylog exists from 30 Jun 2020

/** Each source is one ascending Hyperion listing with its own bookmark. */
export const SOURCES = {
  gpkmarket: { qs: `account=${GPK_MARKET}` },
  smbuylog: { qs: 'filter=simplemarket:buylog,simplemarket:updateprice' },
  smpay: { qs: `account=${SIMPLE_MARKET}&filter=eosio.token:transfer`, before: BUYLOG_FROM },
  transfer: { qs: 'filter=simpleassets:transfer' },
  offer: { qs: 'filter=simpleassets:offer,simpleassets:canceloffer' },
  claim: { qs: 'filter=simpleassets:claim' },
  burn: { qs: 'filter=simpleassets:burn' },
  packs: { qs: 'filter=packs.topps:transfer' },
};

const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;
const ID_RE = /^\d+$/;
const WEEK_MS = 7 * 864e5;
const START_MS = Date.parse(`${START}Z`);

export function hyperionMs(ts) {
  if (!ts) return NaN;
  const s = String(ts);
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
}
export const monthOf = (ms) => new Date(ms).toISOString().slice(0, 7);
export const weekOf = (ms) => new Date(START_MS + Math.floor((ms - START_MS) / WEEK_MS) * WEEK_MS).toISOString().slice(0, 10);

/** "59.00000000" -> "59"; "0.14100000" -> "0.141". */
export function trimAmount(v) {
  const s = String(v ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return '';
  const [w, f = ''] = s.split('.');
  const frac = f.replace(/0+$/, '');
  return `${String(Number(w))}${frac ? `.${frac}` : ''}`;
}
/** "53.10000000 WAX" -> ["53.1", "WAX"]. */
export function parseQuantity(q) {
  const m = /^\s*(\d+(?:\.\d+)?)\s+([A-Z][A-Z0-9]{0,6})\s*$/.exec(String(q ?? ''));
  return m ? [trimAmount(m[1]), m[2]] : ['', ''];
}
const acct = (v) => (typeof v === 'string' && ACCOUNT_RE.test(v) ? v : '');
const memoOf = (d) => (typeof d?.memo === 'string' ? d.memo : '');
const idsOf = (list, isGpk) => (Array.isArray(list) ? list.map(String).filter((id) => ID_RE.test(id) && isGpk(id)) : []);
const idInMemo = (memo) => (/(\d{15,})/.exec(memo) || [])[1] || '';

/**
 * Pure: rows for one Hyperion action. `isGpk(id)` decides which SimpleAssets
 * ids count. Returns [] for anything not about GPK.
 */
export function classifyAction(a, isGpk) {
  const act = a?.act;
  if (!act) return [];
  const d = act.data || {};
  const ms = hyperionMs(a['@timestamp'] || a.timestamp);
  const seq = Number(a.global_sequence);
  if (!Number.isFinite(ms) || !Number.isFinite(seq)) return [];
  const tx = typeof a.trx_id === 'string' ? a.trx_id : '';
  const row = (kind, ids, from, to, amount = '', token = '', market = '', memo = '') =>
    [ms, seq, kind, ids.join(','), from, to, amount, token, market, memo, tx];
  const key = `${act.account}:${act.name}`;

  if (key === 'simpleassets:transfer' || key === 'simpleassets:offer') {
    const from = acct(key === 'simpleassets:offer' ? d.owner : d.from);
    const to = acct(key === 'simpleassets:offer' ? d.newowner : d.to);
    const ids = idsOf(d.assetids, isGpk);
    if (!ids.length || !from || !to) return [];
    const memo = memoOf(d);
    const plain = key === 'simpleassets:offer' ? 'offer' : 'transfer';
    if (to === BRIDGE) return [row('bridge', ids, from, to, '', '', '', memo)];
    if (from === BRIDGE) return [row('unbridge', ids, from, to, '', '', '', memo)];
    if (to === GPK_MARKET) {
      const [amt, tok] = parseQuantity(memo);
      return [amt ? row('list', ids, from, to, amt, tok, 'gpk') : row(plain, ids, from, to, '', '', 'gpk', memo)];
    }
    if (from === GPK_MARKET) {
      const sold = /^Purchased for\s+(\d+(?:\.\d+)?)\s+([A-Z][A-Z0-9]{0,6})/i.exec(memo);
      if (sold) return [row('sale', ids, '', to, trimAmount(sold[1]), sold[2], 'gpk')];
      if (/cancel/i.test(memo) && !/refund/i.test(memo)) return [row('cancel', ids, from, to, '', '', 'gpk')];
      if (/refund/i.test(memo)) return [row('refund', ids, from, to, '', '', 'gpk', memo)];
      return [row(plain, ids, from, to, '', '', 'gpk', memo)];
    }
    if (to === SIMPLE_MARKET) {
      let price = '';
      try { const j = JSON.parse(memo); price = typeof j?.price === 'string' ? j.price : ''; } catch { /* not a listing */ }
      const [amt, tok] = parseQuantity(price);
      return [amt ? row('list', ids, from, to, amt, tok, 'sm', memo.includes('offerprice') ? memo : '') : row(plain, ids, from, to, '', '', 'sm', memo)];
    }
    if (from === SIMPLE_MARKET) {
      if (/cancel|revoke/i.test(memo)) return [row('cancel', ids, from, to, '', '', 'sm')];
      return [row(plain, ids, from, to, '', '', 'sm', memo)];
    }
    const market = MARKETS[to] || MARKETS[from] || '';
    return [row(plain, ids, from, to, '', '', market, memo)];
  }
  if (key === 'simpleassets:canceloffer') {
    const ids = idsOf(d.assetids, isGpk);
    const owner = acct(d.owner);
    return ids.length && owner ? [row('unoffer', ids, owner, '')] : [];
  }
  if (key === 'simpleassets:claim') {
    const ids = idsOf(d.assetids, isGpk);
    const claimer = acct(d.claimer);
    return ids.length && claimer ? [row('claim', ids, '', claimer)] : [];
  }
  if (key === 'simpleassets:burn') {
    const ids = idsOf(d.assetids, isGpk);
    const owner = acct(d.owner);
    return ids.length && owner ? [row('burn', ids, owner, '', '', '', '', memoOf(d))] : [];
  }
  if (key === 'packs.topps:transfer') {
    const from = acct(d.from); const to = acct(d.to);
    const [amt, tok] = parseQuantity(d.quantity);
    if (!from || !to || !amt) return [];
    return [row('pack', [], from, to, amt, tok, MARKETS[to] || MARKETS[from] || '', memoOf(d))];
  }
  if (key === 'simplemarket:buylog') {
    const buyer = acct(d.from);
    let sellers = {};
    try { sellers = typeof d.assets_seller === 'string' ? JSON.parse(d.assets_seller) : (d.assets_seller || {}); } catch { return []; }
    const out = [];
    for (const [seller, list] of Object.entries(sellers || {})) {
      if (!acct(seller) || !Array.isArray(list)) continue;
      for (const item of list) {
        const id = String(Array.isArray(item) ? item[0] : '');
        if (!ID_RE.test(id) || !isGpk(id)) continue;
        const [amt, tok] = parseQuantity(Array.isArray(item) ? item[1] : '');
        out.push(row('sale', [id], seller, buyer, amt, tok, 'sm'));
      }
    }
    return out;
  }
  if (key === 'simplemarket:updateprice') {
    const id = String(d.saleid ?? '');
    if (!ID_RE.test(id) || !isGpk(id)) return [];
    const [amt, tok] = parseQuantity(d.newprice);
    return [row('reprice', [id], '', '', amt, tok, 'sm', d.offerprice ? JSON.stringify({ offerprice: d.offerprice, offertime: d.offertime }) : '')];
  }
  if (key === 'eosio.token:transfer') {
    const from = acct(d.from); const to = acct(d.to);
    const memo = memoOf(d);
    const [amt, tok] = parseQuantity(d.quantity);
    if (!from || !to || !amt) return [];
    if (from === GPK_MARKET || to === GPK_MARKET) {
      const id = idInMemo(memo);
      // gpkmarket111 only ever sold GPK cards; keep its money rows even for ids we haven't seen.
      const ids = id ? [id] : [];
      if (to === GPK_MARKET && /^Purchase#/i.test(memo)) return [row('buy', ids, from, to, amt, tok, 'gpk')];
      if (from === GPK_MARKET && /^Payment for sale/i.test(memo)) return [row('pay', ids, from, to, amt, tok, 'gpk')];
      if (from === GPK_MARKET && /fee/i.test(memo)) return [row('fee', ids, from, to, amt, tok, 'gpk', memo.replace(/\s*#?\d{15,}.*$/, ''))];
      if (from === GPK_MARKET && /refund/i.test(memo)) return [row('refund', ids, from, to, amt, tok, 'gpk', memo)];
      return [row(from === GPK_MARKET ? 'pay' : 'buy', ids, from, to, amt, tok, 'gpk', memo)];
    }
    if (from === SIMPLE_MARKET || to === SIMPLE_MARKET) {
      let id = idInMemo(memo);
      try { const j = JSON.parse(memo); if (j?.nftid != null) id = String(j.nftid); } catch { /* plain memo */ }
      if (!id || !isGpk(id)) return [];
      if (to === SIMPLE_MARKET) return [row('buy', [id], from, to, amt, tok, 'sm')];
      return [row('split', [id], from, to, amt, tok, 'sm', (/^([\d.]+%)/.exec(memo) || [])[1] || memo)];
    }
  }
  return [];
}

export const rowKey = (r) => `${r[1]}|${r[2]}|${r[3]}|${r[4]}|${r[5]}`;

// ---------- store ----------
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export async function loadIndex(dir) {
  const p = path.join(dir, 'index.json');
  if (!existsSync(p)) return { version: 1, updatedAt: null, complete: false, sources: {}, months: {}, gaps: [] };
  return JSON.parse(await fs.readFile(p, 'utf8'));
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
  /** Returns rows actually added. */
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
  /** Writes dirty months; returns { month: meta } for them. */
  async flush() {
    const out = {};
    await fs.mkdir(path.join(this.dir, 'events'), { recursive: true });
    for (const m of [...this.dirty].sort()) {
      const e = this.months.get(m);
      e.rows.sort((a, b) => a[1] - b[1] || (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0) || (a[4] < b[4] ? -1 : 1));
      const buf = Buffer.from(JSON.stringify({ version: 1, month: m, count: e.rows.length, rows: e.rows }));
      const p = path.join(this.dir, 'events', `${m}.json`);
      await fs.writeFile(`${p}.tmp`, buf);
      await fs.rename(`${p}.tmp`, p);
      out[m] = { count: e.rows.length, bytes: buf.length, sha256: sha256(buf) };
    }
    this.dirty.clear();
    return out;
  }
}

export async function writeIndex(dir, index) {
  const p = path.join(dir, 'index.json');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(`${p}.tmp`, JSON.stringify(index, null, 2));
  await fs.rename(`${p}.tmp`, p);
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

// ---------- derived views ----------
const SALE_MATCH_MS = 60 * 60_000;

/**
 * Pure: per-card timelines. Sales get their seller filled in from the market's
 * payout row (GPK market) or the largest percentage split (early SimpleMarket);
 * unmatched sellers stay "". Money-only rows (pay/buy/fee/split) are folded in.
 * Returns Map<id, [[ms, kind, from, to, amount, token, market, tx], ...]> oldest first.
 */
export function buildTimelines(rows) {
  const byId = new Map();
  const push = (id, r) => { let l = byId.get(id); if (!l) byId.set(id, (l = [])); l.push(r); };
  for (const r of rows) {
    if (r[2] === 'pack' || !r[3]) continue;
    for (const id of r[3].split(',')) push(id, r);
  }
  const out = new Map();
  for (const [id, list] of byId) {
    list.sort((a, b) => a[1] - b[1]);
    const pays = list.filter((r) => r[2] === 'pay');
    const splits = list.filter((r) => r[2] === 'split');
    const used = new Set();
    const timeline = [];
    const hasSaleInTx = new Set(list.filter((r) => r[2] === 'sale').map((r) => r[10]));
    for (const r of list) {
      if (r[2] === 'sale') {
        let seller = r[4];
        if (!seller && r[8] === 'gpk') {
          let best = null;
          for (const p of pays) {
            if (used.has(p) || Math.abs(p[0] - r[0]) > SALE_MATCH_MS) continue;
            if (!best || Math.abs(p[0] - r[0]) < Math.abs(best[0] - r[0])) best = p;
          }
          if (best) { used.add(best); seller = best[5]; }
        }
        timeline.push([r[0], 'sale', seller, r[5], r[6], r[7], r[8], r[10]]);
      } else if (r[2] === 'buy' && r[8] === 'sm' && !hasSaleInTx.has(r[10])) {
        // Early SimpleMarket (before buylog): buyer paid; seller = biggest split.
        const near = splits.filter((s) => !used.has(s) && s[0] >= r[0] && s[0] - r[0] <= SALE_MATCH_MS);
        const top = near.sort((a, b) => Number(b[6]) - Number(a[6]))[0];
        if (top) used.add(top);
        timeline.push([r[0], 'sale', top ? top[5] : '', r[4], r[6], r[7], 'sm', r[10]]);
      } else if (!['pay', 'buy', 'fee', 'split'].includes(r[2])) {
        timeline.push([r[0], r[2], r[4], r[5], r[6], r[7], r[8], r[10]]);
      }
    }
    out.set(id, timeline);
  }
  return out;
}

/** Pure: headline totals + per-day sales, for the future analytics page. */
export function buildSummary(rows, timelines) {
  const days = {};
  const totals = { sales: 0, listings: 0, cancels: 0, transfers: 0, offers: 0, claims: 0, burns: 0, bridges: 0, unbridges: 0, packTransfers: 0 };
  const volume = {}; const fees = {}; const markets = {};
  const buyers = new Set(); const sellers = new Set();
  const counterparties = {};
  for (const [, tl] of timelines) {
    for (const [ms, kind, from, to, amount, token, market] of tl) {
      if (kind === 'sale') {
        totals.sales++;
        const d = new Date(ms).toISOString().slice(0, 10);
        const day = (days[d] ??= { n: 0, vol: {} });
        day.n++;
        if (amount && token) { day.vol[token] = +((day.vol[token] || 0) + Number(amount)).toFixed(8); volume[token] = +((volume[token] || 0) + Number(amount)).toFixed(8); }
        markets[market || 'other'] = (markets[market || 'other'] || 0) + 1;
        if (to) buyers.add(to); if (from) sellers.add(from);
      }
    }
  }
  for (const r of rows) {
    const k = r[2];
    if (k === 'list') totals.listings++;
    else if (k === 'cancel') totals.cancels++;
    else if (k === 'transfer') totals.transfers++;
    else if (k === 'offer') totals.offers++;
    else if (k === 'claim') totals.claims++;
    else if (k === 'burn') totals.burns++;
    else if (k === 'bridge') totals.bridges++;
    else if (k === 'unbridge') totals.unbridges++;
    else if (k === 'pack') totals.packTransfers++;
    else if (k === 'fee') { const f = `${r[9] || 'fee'} (${r[7]})`; fees[f] = +((fees[f] || 0) + Number(r[6] || 0)).toFixed(8); }
    if ((k === 'transfer' || k === 'offer') && !r[8]) counterparties[r[5]] = (counterparties[r[5]] || 0) + 1;
  }
  const topRecipients = Object.entries(counterparties).sort((a, b) => b[1] - a[1]).slice(0, 50);
  return { version: 1, generatedAt: new Date().toISOString(), cards: timelines.size, totals, volume, fees, markets, uniqueBuyers: buyers.size, uniqueSellers: sellers.size, topRecipients, days };
}

export const shardOf = (id) => String(id).slice(-3).padStart(3, '0');
