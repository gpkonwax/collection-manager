/**
 * Export-only reconstruction of an account's past pack openings from WAX
 * history (Hyperion).
 *
 * This module deliberately never writes to `packOpenHistory`'s local store.
 * The Pack History dialog runs it once, hands the user a downloaded JSON file,
 * and the user loads that file back in. That keeps "load the JSON" the normal
 * path instead of hammering history nodes on every visit.
 */

import { getIpfsUrl, extractIpfsHash } from './ipfsGateways';
import { ATOMIC_API } from './waxConfig';
import { fetchWithFallback } from './fetchWithFallback';
import type { PackHistoryCard, PackHistoryEntry } from './packOpenHistory';
import type { RevealMatcher } from './packReveal';
import { normalizeGpkVariant } from './gpkVariant';

const HYPERION_ENDPOINTS = [
  'https://wax.api.eosnation.io',
  'https://wax.eosphere.io',
  'https://api.hivebp.io',
  'https://wax.eosdac.io',
  'https://wax.pink.gg',
  'https://wax.eosusa.io',
  'https://api.wax.alohaeos.com',
];

interface HyperionAction {
  '@timestamp'?: string;
  timestamp?: string;
  trx_id?: string;
  act?: { account?: string; name?: string; data?: Record<string, unknown> };
}

export class HistoryUnavailableError extends Error {
  constructor(message = 'No WAX history node could be reached. Try again in a minute.') {
    super(message);
    this.name = 'HistoryUnavailableError';
  }
}

/** Fetch JSON from the first reachable Hyperion endpoint, preferring a sticky winner. */
let preferredEndpoint: string | null = null;

async function hyperionGet<T>(path: string, timeout = 15000): Promise<T> {
  const ordered = preferredEndpoint
    ? [preferredEndpoint, ...HYPERION_ENDPOINTS.filter((e) => e !== preferredEndpoint)]
    : HYPERION_ENDPOINTS;
  let lastError: unknown = null;
  for (const baseUrl of ordered) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) { lastError = new Error(`${baseUrl} responded ${res.status}`); continue; }
      preferredEndpoint = baseUrl;
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
    }
  }
  throw new HistoryUnavailableError(
    lastError instanceof Error ? `History nodes unreachable: ${lastError.message}` : undefined,
  );
}

function resolveImage(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw : '';
  if (!value) return null;
  if (value.startsWith('http')) return value;
  const hash = extractIpfsHash(value);
  if (hash) return getIpfsUrl(hash);
  if (value.startsWith('Qm') || value.startsWith('bafy') || value.startsWith('bafk')) return getIpfsUrl(value);
  return value;
}

function toMs(action: HyperionAction): number {
  const ts = action['@timestamp'] || action.timestamp;
  if (!ts) return Date.now();
  const withZone = /(Z|[+-]\d{2}:?\d{2})$/.test(ts) ? ts : `${ts}Z`;
  const ms = Date.parse(withZone);
  return Number.isFinite(ms) ? ms : Date.now();
}

/** Page through an account's actions for one action filter. */
async function fetchAllActions(
  account: string,
  filter: string,
  maxActions: number,
  onProgress?: (fetched: number) => void,
): Promise<HyperionAction[]> {
  const out: HyperionAction[] = [];
  const pageSize = 100;
  for (let skip = 0; skip < maxActions; skip += pageSize) {
    const path =
      `/v2/history/get_actions?account=${encodeURIComponent(account)}` +
      `&filter=${encodeURIComponent(filter)}&limit=${pageSize}&skip=${skip}&sort=desc`;
    const json = await hyperionGet<{ actions?: HyperionAction[] }>(path);
    const actions = json.actions || [];
    out.push(...actions);
    onProgress?.(out.length);
    if (actions.length < pageSize) break;
  }
  return out;
}

/** Run tasks with bounded concurrency, preserving input order in the result. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------- SimpleAssets

/** Pack label guessed from the SA category + how many cards landed in one claim. */
function guessSaPackName(category: string, count: number): string {
  const c = (category || '').toLowerCase();
  if (c === 'five' || c === 'series1') return count >= 20 ? 'GPK Series 1 Mega Pack' : 'GPK Series 1 Pack';
  if (c.startsWith('gpktwo') || c === 'series2') {
    if (count >= 50) return 'GPK Series 2C Pack';
    if (count >= 20) return 'GPK Series 2B Pack';
    return 'GPK Series 2A Pack';
  }
  if (c.startsWith('exotic')) return count >= 20 ? 'Tiger King Mega Pack' : 'Tiger King Pack';
  return `${category || 'GPK'} pack`;
}

interface TrxActionsResponse {
  actions?: HyperionAction[];
  trx_id?: string;
}

async function reconstructSaOpening(
  account: string,
  trxId: string,
  openedAt: number,
): Promise<PackHistoryEntry | null> {
  const json = await hyperionGet<TrxActionsResponse>(
    `/v2/history/get_transaction?id=${encodeURIComponent(trxId)}`,
  );
  const actions = json.actions || [];
  const cards: PackHistoryCard[] = [];
  const matchers: RevealMatcher[] = [];
  let category = '';

  for (const a of actions) {
    if (a.act?.account !== 'simpleassets') continue;
    if (a.act?.name !== 'createlog' && a.act?.name !== 'create') continue;
    const data = (a.act?.data || {}) as Record<string, unknown>;
    if (String(data.owner ?? '') !== account) continue;
    let idata: Record<string, unknown> = {};
    const rawIdata = data.idata;
    if (typeof rawIdata === 'string') {
      try { idata = JSON.parse(rawIdata) || {}; } catch { idata = {}; }
    } else if (rawIdata && typeof rawIdata === 'object') {
      idata = rawIdata as Record<string, unknown>;
    }
    category = String(data.category ?? category);
    const cardid = idata.cardid != null ? String(idata.cardid) : null;
    const side = idata.side != null ? String(idata.side) : null;
    const variant = idata.variant != null ? String(idata.variant) : (idata.quality != null ? String(idata.quality) : null);
    cards.push({
      id: data.assetid != null ? String(data.assetid) : null,
      name: String(idata.name ?? (cardid ? `Card #${cardid}${side ?? ''}` : 'Card')),
      image: resolveImage(idata.img ?? idata.image),
      cardid,
      side,
      variant,
      category: String(data.category ?? '') || null,
    });
    if (cardid) {
      matchers.push({
        kind: 'sa',
        cardid,
        side: (side ?? '').toLowerCase(),
        variant: normalizeGpkVariant(String(variant ?? '')),
        category: String(data.category ?? '') || null,
      });
    }
  }

  if (cards.length === 0) return null;
  return {
    txId: trxId,
    account,
    source: 'simpleassets',
    packId: null,
    packName: guessSaPackName(category, cards.length),
    packImage: null,
    openedAt,
    matchers,
    cards,
    fromChain: true,
  };
}

// --------------------------------------------------------------- AtomicAssets

async function fetchTemplateMeta(templateId: string): Promise<{ name: string; image: string | null }> {
  try {
    const path = `${ATOMIC_API.paths.templates}/gpk.topps/${templateId}`;
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 10000);
    const json = await response.json();
    if (json.success && json.data) {
      const idata = json.data.immutable_data || {};
      return { name: String(idata.name || `Card #${templateId}`), image: resolveImage(idata.img || idata.image) };
    }
  } catch {
    /* best effort */
  }
  return { name: `Card #${templateId}`, image: null };
}

interface AaMintGroup {
  trxId: string;
  openedAt: number;
  rows: { assetId: string; templateId: string; schema: string }[];
}

function groupAaMints(actions: HyperionAction[], account: string): AaMintGroup[] {
  const groups = new Map<string, AaMintGroup>();
  for (const a of actions) {
    const data = (a.act?.data || {}) as Record<string, unknown>;
    if (String(data.new_asset_owner ?? '') !== account) continue;
    if (String(data.collection_name ?? '') !== 'gpk.topps') continue;
    const trxId = a.trx_id || '';
    if (!trxId) continue;
    const group = groups.get(trxId) || { trxId, openedAt: toMs(a), rows: [] };
    group.rows.push({
      assetId: String(data.asset_id ?? ''),
      templateId: String(data.template_id ?? ''),
      schema: String(data.schema_name ?? ''),
    });
    groups.set(trxId, group);
  }
  // A mint of the pack NFT itself isn't an opening.
  return Array.from(groups.values()).filter(
    (g) => g.rows.length > 0 && !g.rows.every((r) => r.schema.toLowerCase().includes('pack')),
  );
}

// ------------------------------------------------------------------- Public API

export interface ChainExportProgress {
  stage: 'scanning' | 'reconstructing' | 'done';
  message: string;
  done: number;
  total: number;
}

export interface ChainExportResult {
  entries: PackHistoryEntry[];
  saOpenings: number;
  aaOpenings: number;
  /** Non-fatal problems (e.g. one protocol failed while the other succeeded). */
  warnings: string[];
}

/**
 * Rebuild the account's past openings from chain history.
 * Returns entries sorted newest first. Never touches local storage.
 */
export async function exportPackHistoryFromChain(
  account: string,
  onProgress?: (p: ChainExportProgress) => void,
  options?: { maxOpenings?: number },
): Promise<ChainExportResult> {
  const maxOpenings = options?.maxOpenings ?? 300;
  const warnings: string[] = [];
  const report = (p: ChainExportProgress) => onProgress?.(p);

  report({ stage: 'scanning', message: 'Scanning WAX history for SimpleAssets pack claims…', done: 0, total: 0 });

  let saClaims: HyperionAction[] = [];
  try {
    saClaims = await fetchAllActions(account, 'gpk.topps:getcards', maxOpenings * 2, (n) =>
      report({ stage: 'scanning', message: `Found ${n} SimpleAssets claim actions…`, done: 0, total: 0 }),
    );
  } catch (err) {
    if (err instanceof HistoryUnavailableError) throw err;
    warnings.push('SimpleAssets history scan failed.');
  }

  report({ stage: 'scanning', message: 'Scanning WAX history for AtomicAssets mints…', done: 0, total: 0 });

  let aaMints: HyperionAction[] = [];
  try {
    aaMints = await fetchAllActions(account, 'atomicassets:logmint', maxOpenings * 20, (n) =>
      report({ stage: 'scanning', message: `Found ${n} AtomicAssets mint actions…`, done: 0, total: 0 }),
    );
  } catch (err) {
    if (err instanceof HistoryUnavailableError && saClaims.length === 0) throw err;
    warnings.push('AtomicAssets history scan failed.');
  }

  const saTrxs = Array.from(
    new Map(
      saClaims
        .filter((a) => String(((a.act?.data || {}) as Record<string, unknown>).from ?? '') === account)
        .map((a) => [a.trx_id || '', { trxId: a.trx_id || '', openedAt: toMs(a) }]),
    ).values(),
  )
    .filter((t) => t.trxId)
    .slice(0, maxOpenings);

  const aaGroups = groupAaMints(aaMints, account).slice(0, maxOpenings);

  const total = saTrxs.length + aaGroups.length;
  let done = 0;
  report({ stage: 'reconstructing', message: `Rebuilding ${total} opening${total === 1 ? '' : 's'}…`, done, total });

  const saEntries = (
    await mapPool(saTrxs, 4, async (t) => {
      try {
        return await reconstructSaOpening(account, t.trxId, t.openedAt);
      } catch {
        return null;
      } finally {
        done++;
        report({ stage: 'reconstructing', message: `Rebuilding openings… ${done}/${total}`, done, total });
      }
    })
  ).filter((e): e is PackHistoryEntry => e !== null);

  // Resolve every distinct AA template once.
  const templateIds = Array.from(new Set(aaGroups.flatMap((g) => g.rows.map((r) => r.templateId)).filter(Boolean)));
  const templateMeta = new Map<string, { name: string; image: string | null }>();
  await mapPool(templateIds, 6, async (tid) => {
    templateMeta.set(tid, await fetchTemplateMeta(tid));
  });

  const aaEntries: PackHistoryEntry[] = aaGroups.map((g) => {
    const cards: PackHistoryCard[] = g.rows.map((r) => {
      const meta = templateMeta.get(r.templateId) || { name: `Card #${r.templateId}`, image: null };
      return {
        id: r.assetId || null,
        name: meta.name,
        image: meta.image,
        templateId: r.templateId || null,
        category: r.schema || null,
      };
    });
    done++;
    report({ stage: 'reconstructing', message: `Rebuilding openings… ${done}/${total}`, done, total });
    return {
      txId: g.trxId,
      account,
      source: 'atomicassets',
      packId: null,
      packName: `${g.rows[0]?.schema || 'GPK'} pack (${cards.length} card${cards.length === 1 ? '' : 's'})`,
      packImage: null,
      openedAt: g.openedAt,
      matchers: g.rows
        .filter((r) => r.assetId)
        .map((r) => ({ kind: 'aa-asset' as const, assetId: r.assetId })),
      cards,
      fromChain: true,
    };
  });

  const entries = [...saEntries, ...aaEntries].sort((a, b) => b.openedAt - a.openedAt);
  report({ stage: 'done', message: `Rebuilt ${entries.length} opening${entries.length === 1 ? '' : 's'}.`, done: total, total });

  return { entries, saOpenings: saEntries.length, aaOpenings: aaEntries.length, warnings };
}
