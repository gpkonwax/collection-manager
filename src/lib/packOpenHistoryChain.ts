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
import { packLabel } from './gpkPackMeta';


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

/** Pack symbol guessed from the SA category + the real pack sizes. */
function guessSaPackSymbol(category: string, count: number): string | null {
  const c = (category || '').toLowerCase();
  if (c === 'five' || c === 'series1') return count >= 20 ? 'GPKMEGA' : 'GPKFIVE';
  if (c.startsWith('gpktwo') || c === 'series2') {
    if (count >= 50) return 'GPKTWOC';
    if (count >= 20) return 'GPKTWOB';
    return 'GPKTWOA';
  }
  if (c.startsWith('exotic')) return count >= 20 ? 'EXOMEGA' : 'EXOFIVE';
  return null;
}

/** Pack label guessed from the SA category + how many cards landed in one claim. */
function guessSaPackName(category: string, count: number): string {
  const symbol = guessSaPackSymbol(category, count);
  if (symbol === 'EXOMEGA') return 'Tiger King Mega Pack';
  if (symbol === 'EXOFIVE') return 'Tiger King Pack';
  if (symbol) return packLabel(symbol);
  return `${category || 'GPK'} pack`;
}

interface TrxActionsResponse {
  actions?: HyperionAction[];
  trx_id?: string;
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

interface SaMintedCard {
  card: PackHistoryCard;
  matcher: RevealMatcher | null;
  category: string;
}

/**
 * One fragment per `getcards` action in a transaction.
 *
 * A single pack (`unboxing` id) can be claimed across several transactions, so
 * fragments are merged by unboxing id later — never per transaction.
 *
 * SimpleAssets logs each minted card twice (`create` + `createlog`); only
 * `createlog` carries the asset id, so it is the single source of truth. The
 * card payload lives in `mdata`, with `idata` kept as a fallback for older
 * assets.
 */
interface SaClaimFragment {
  unboxing: string | null;
  trxId: string;
  openedAt: number;
  cards: SaMintedCard[];
}

async function reconstructSaOpening(
  account: string,
  trxId: string,
  openedAt: number,
): Promise<SaClaimFragment[]> {
  const json = await hyperionGet<TrxActionsResponse>(
    `/v2/history/get_transaction?id=${encodeURIComponent(trxId)}`,
  );
  const actions = json.actions || [];
  const minted: SaMintedCard[] = [];
  const claims: { unboxing: string | null; size: number }[] = [];

  for (const a of actions) {
    if (a.act?.account === 'gpk.topps' && a.act?.name === 'getcards') {
      const data = (a.act?.data || {}) as Record<string, unknown>;
      if (String(data.from ?? '') !== account) continue;
      const ids = Array.isArray(data.cardids) ? data.cardids.length : 0;
      if (ids > 0) {
        claims.push({ unboxing: data.unboxing != null ? String(data.unboxing) : null, size: ids });
      }
      continue;
    }
    if (a.act?.account !== 'simpleassets' || a.act?.name !== 'createlog') continue;
    const data = (a.act?.data || {}) as Record<string, unknown>;
    if (String(data.owner ?? '') !== account) continue;

    const idata = parseJsonObject(data.idata);
    const mdata = parseJsonObject(data.mdata);
    const pick = (key: string): unknown => (mdata[key] != null ? mdata[key] : idata[key]);

    const category = String(data.category ?? '');
    const cardid = pick('cardid') != null ? String(pick('cardid')) : null;
    // SimpleAssets GPK cards store the card SIDE in `quality` and the print
    // variant in `variant` — the same mapping the collection reader uses.
    // `side` is only present on a handful of assets, so it is a fallback.
    const rawSide = pick('quality') ?? pick('side');
    const side = rawSide != null ? String(rawSide).toLowerCase() : null;
    const rawVariant = pick('variant');
    const variant = rawVariant != null ? normalizeGpkVariant(String(rawVariant)) : null;
    const assetId = data.assetid != null ? String(data.assetid) : null;

    minted.push({
      category,
      card: {
        id: assetId,
        name: String(pick('name') ?? (cardid ? `Card #${cardid}${side ?? ''}` : 'Card')),
        image: resolveImage(pick('img') ?? pick('image')),
        cardid,
        side,
        variant,
        category: category || null,
      },
      matcher: cardid || assetId
        ? {
            kind: 'sa',
            assetId,
            cardid: cardid ?? '',
            side: side ?? '',
            variant: variant ?? '',
            category: category || null,
          }
        : null,
    });

  }

  if (minted.length === 0) return [];

  // Split the minted cards across the claims in this transaction. When the
  // per-claim counts don't add up (partial history), fall back to one group.
  const totalClaimed = claims.reduce((sum, c) => sum + c.size, 0);
  if (claims.length > 1 && totalClaimed === minted.length) {
    const fragments: SaClaimFragment[] = [];
    let cursor = 0;
    for (const claim of claims) {
      fragments.push({
        unboxing: claim.unboxing,
        trxId,
        openedAt,
        cards: minted.slice(cursor, cursor + claim.size),
      });
      cursor += claim.size;
    }
    return fragments;
  }

  return [{ unboxing: claims[0]?.unboxing ?? null, trxId, openedAt, cards: minted }];
}

/** Merge claim fragments that belong to the same pack (`unboxing` id). */
function mergeSaFragments(account: string, fragments: SaClaimFragment[]): PackHistoryEntry[] {
  const byPack = new Map<string, SaClaimFragment[]>();
  fragments.forEach((f, index) => {
    const key = f.unboxing ? `u:${f.unboxing}` : `t:${f.trxId}#${index}`;
    const list = byPack.get(key);
    if (list) list.push(f);
    else byPack.set(key, [f]);
  });

  const entries: PackHistoryEntry[] = [];
  for (const [key, list] of byPack) {
    // Oldest claim first so cards read in the order they were collected.
    list.sort((a, b) => a.openedAt - b.openedAt);
    const merged = list.flatMap((f) => f.cards);
    if (merged.length === 0) continue;
    const category = merged.find((m) => m.category)?.category ?? '';
    const symbol = guessSaPackSymbol(category, merged.length);
    const unboxing = list[0].unboxing;
    entries.push({
      txId: unboxing ? `unboxing:${unboxing}` : key.slice(2),
      account,
      source: 'simpleassets',
      packId: symbol,
      packName: guessSaPackName(category, merged.length),
      // Bundled SA artwork is resolved from the symbol at render time — never persisted.
      packImage: null,
      openedAt: list[0].openedAt,
      matchers: merged.map((m) => m.matcher).filter((m): m is RevealMatcher => m !== null),
      cards: merged.map((m) => m.card),
      fromChain: true,
    });
  }
  return entries;
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

/** Resolve a burned/transferred AtomicAssets pack asset to its name + art. */
async function fetchPackAssetMeta(
  assetId: string,
): Promise<{ name: string; image: string | null } | null> {
  try {
    const path = `${ATOMIC_API.paths.assets}/${assetId}`;
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 10000);
    const json = await response.json();
    const data = json?.data;
    if (!data) return null;
    if (String(data.collection?.collection_name ?? '') !== 'gpk.topps') return null;
    if (!String(data.schema?.schema_name ?? '').toLowerCase().includes('pack')) return null;
    const idata = {
      ...(data.template?.immutable_data || {}),
      ...(data.immutable_data || {}),
    } as Record<string, unknown>;
    return {
      name: String(idata.name || 'GPK Pack'),
      image: resolveImage(idata.img || idata.image),
    };
  } catch {
    return null;
  }
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

  const saFragments = (
    await mapPool(saTrxs, 4, async (t) => {
      try {
        return await reconstructSaOpening(account, t.trxId, t.openedAt);
      } catch {
        return [] as SaClaimFragment[];
      } finally {
        done++;
        report({ stage: 'reconstructing', message: `Rebuilding openings… ${done}/${total}`, done, total });
      }
    })
  ).flat();

  // One pack can be claimed across several transactions — merge by unboxing id.
  const saEntries = mergeSaFragments(account, saFragments);


  // Resolve every distinct AA template once.
  const templateIds = Array.from(new Set(aaGroups.flatMap((g) => g.rows.map((r) => r.templateId)).filter(Boolean)));
  const templateMeta = new Map<string, { name: string; image: string | null }>();
  await mapPool(templateIds, 6, async (tid) => {
    templateMeta.set(tid, await fetchTemplateMeta(tid));
  });

  // The pack NFT itself is transferred to the unbox contract shortly before the
  // cards are minted — use that asset to recover the pack's real name + art.
  const packMetaByGroup = new Map<string, { name: string; image: string | null }>();
  if (aaGroups.length > 0) {
    let transfers: HyperionAction[] = [];
    try {
      transfers = await fetchAllActions(account, 'atomicassets:transfer', maxOpenings * 4);
    } catch {
      /* pack art is best effort */
    }
    const outgoing = transfers
      .filter((a) => String(((a.act?.data || {}) as Record<string, unknown>).from ?? '') === account)
      .map((a) => {
        const data = (a.act?.data || {}) as Record<string, unknown>;
        const ids = Array.isArray(data.asset_ids) ? data.asset_ids.map((v) => String(v)) : [];
        return { at: toMs(a), assetIds: ids };
      })
      .filter((t) => t.assetIds.length > 0)
      .sort((a, b) => b.at - a.at);

    const WINDOW_MS = 6 * 60 * 60 * 1000;
    const used = new Map<number, number>();
    const candidates: { key: string; assetId: string }[] = [];
    for (const g of aaGroups) {
      const index = outgoing.findIndex(
        (t, i) => t.at <= g.openedAt + 120_000 && t.at >= g.openedAt - WINDOW_MS && (used.get(i) ?? 0) < t.assetIds.length,
      );
      if (index === -1) continue;
      const slot = used.get(index) ?? 0;
      used.set(index, slot + 1);
      candidates.push({ key: g.trxId, assetId: outgoing[index].assetIds[slot] });
    }

    const assetCache = new Map<string, { name: string; image: string | null } | null>();
    const uniqueAssetIds = Array.from(new Set(candidates.map((c) => c.assetId)));
    await mapPool(uniqueAssetIds, 6, async (assetId) => {
      assetCache.set(assetId, await fetchPackAssetMeta(assetId));
    });
    for (const c of candidates) {
      const meta = assetCache.get(c.assetId);
      if (meta) packMetaByGroup.set(c.key, meta);
    }
  }

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
    const packMeta = packMetaByGroup.get(g.trxId);
    const schema = g.rows[0]?.schema || 'GPK';
    return {
      txId: g.trxId,
      account,
      source: 'atomicassets',
      packId: null,
      packName: packMeta?.name || `${schema} pack`,
      packImage: packMeta?.image ?? null,
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
