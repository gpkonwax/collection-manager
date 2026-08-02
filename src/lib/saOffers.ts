// SimpleAssets ↔ SimpleAssets offers = eosio.msig proposals holding exactly two
// simpleassets::transfer actions between the two parties.
//
// Discovery: eosio.msig proposals are scoped by proposer and the chain has no
// "proposals awaiting me" index, so we scan recent `eosio.msig::propose`
// actions in history (chain-wide volume is tiny) and keep the ones where I am
// the proposer or a requested approver. No on-chain beacon is needed, which
// means proposing works even with a zero liquid WAX balance. A local cache of
// proposals we created ourselves is kept as a fallback if history is down.

import { Serializer, Transaction } from '@wharfkit/antelope';
import { fetchTableRows, HYPERION_ENDPOINTS } from '@/lib/waxRpcFallback';
import { getIpfsUrl, extractIpfsHash } from '@/lib/ipfsGateways';
import { normalizeGpkVariant } from '@/lib/gpkVariant';
import type { AtomicOffer, OfferAsset } from '@/lib/atomicOffers';
import {
  MSIG_CONTRACT,
  SIMPLEASSETS_CONTRACT,
  getContractAbi,
  parseCounterRef,
  stripCounterRef,
} from '@/lib/saTradeActions';


const LOOKBACK_DAYS = 30;
const CACHE_PREFIX = 'gpk-sa-proposals:';
const HIDDEN_PREFIX = 'gpk-sa-hidden:';

export interface SaProposalRef {
  proposer: string;
  name: string;
  createdAt: number;
}

/** Offer id used throughout the UI for a SimpleAssets proposal. */
export function saOfferId(proposer: string, name: string): string {
  return `sa:${proposer}:${name}`;
}

export function parseSaOfferId(offerId: string): { proposer: string; name: string } | null {
  const parts = offerId.split(':');
  if (parts.length !== 3 || parts[0] !== 'sa') return null;
  return { proposer: parts[1], name: parts[2] };
}

/* ----------------------------- local caches ----------------------------- */

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function rememberProposal(account: string, ref: SaProposalRef) {
  const key = `${CACHE_PREFIX}${account}`;
  const list = readJson<SaProposalRef[]>(key, []);
  if (!list.some((p) => p.proposer === ref.proposer && p.name === ref.name)) {
    list.push(ref);
  }
  const cutoff = Date.now() - LOOKBACK_DAYS * 86_400_000;
  writeJson(key, list.filter((p) => p.createdAt >= cutoff));
}

export function hideProposalLocally(account: string, proposer: string, name: string) {
  const key = `${HIDDEN_PREFIX}${account}`;
  const list = readJson<string[]>(key, []);
  const id = saOfferId(proposer, name);
  if (!list.includes(id)) list.push(id);
  writeJson(key, list.slice(-500));
}

function readHidden(account: string): Set<string> {
  return new Set(readJson<string[]>(`${HIDDEN_PREFIX}${account}`, []));
}

/* --------------------------- history discovery -------------------------- */

interface HyperionProposeAction {
  timestamp?: string;
  act?: {
    account?: string;
    name?: string;
    data?: {
      proposer?: string;
      proposal_name?: string;
      requested?: Array<{ actor?: string; permission?: string }>;
    };
  };
}

/**
 * Keep the `eosio.msig::propose` actions in which `account` is the proposer or
 * a requested approver. Exported for tests.
 */
export function filterProposeActions(
  actions: HyperionProposeAction[],
  account: string,
): SaProposalRef[] {
  const out: SaProposalRef[] = [];
  for (const a of actions) {
    if (a.act?.account !== MSIG_CONTRACT || a.act?.name !== 'propose') continue;
    const proposer = String(a.act?.data?.proposer || '');
    const name = String(a.act?.data?.proposal_name || '');
    if (!proposer || !name) continue;
    const requested = (a.act?.data?.requested || []).map((r) => String(r.actor || ''));
    if (proposer !== account && !requested.includes(account)) continue;
    out.push({
      proposer,
      name,
      createdAt: a.timestamp ? new Date(`${a.timestamp.replace(/Z$/, '')}Z`).getTime() : 0,
    });
  }
  return out;
}

async function fetchProposeActions(account: string): Promise<SaProposalRef[]> {
  const after = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const path =
    `/v2/history/get_actions?filter=${encodeURIComponent(`${MSIG_CONTRACT}:propose`)}` +
    `&limit=1000&sort=desc&after=${encodeURIComponent(after)}`;

  let actions: HyperionProposeAction[] | null = null;
  for (const base of HYPERION_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const resp = await fetch(`${base}${path}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) continue;
      const json = await resp.json();
      if (Array.isArray(json?.actions)) {
        actions = json.actions as HyperionProposeAction[];
        break;
      }
    } catch {
      /* try next endpoint */
    }
  }
  if (!actions) return [];
  return filterProposeActions(actions, account);
}


/* ----------------------------- msig hydration ---------------------------- */

interface MsigProposalRow {
  proposal_name: string;
  packed_transaction: string;
}

interface Approval {
  level?: { actor?: string; permission?: string };
  actor?: string;
  permission?: string;
}

interface MsigApprovalsRow {
  proposal_name: string;
  requested_approvals?: Approval[];
  provided_approvals?: Approval[];
}

function approvalActor(a: Approval): string {
  return String(a.level?.actor ?? a.actor ?? '');
}

async function fetchProposalRow(proposer: string, name: string): Promise<MsigProposalRow | null> {
  try {
    const res = await fetchTableRows<MsigProposalRow>({
      code: 'eosio.msig', scope: proposer, table: 'proposal',
      lower_bound: name, upper_bound: name, limit: 1,
    });
    const row = res.rows?.[0];
    return row && row.proposal_name === name ? row : null;
  } catch {
    return null;
  }
}

async function fetchApprovals(proposer: string, name: string): Promise<MsigApprovalsRow | null> {
  try {
    const res = await fetchTableRows<MsigApprovalsRow>({
      code: 'eosio.msig', scope: proposer, table: 'approvals2',
      lower_bound: name, upper_bound: name, limit: 1,
    });
    const row = res.rows?.[0];
    return row && row.proposal_name === name ? row : null;
  } catch {
    return null;
  }
}

export interface DecodedSwap {
  expiration: number;
  transfers: Array<{ from: string; to: string; assetIds: string[]; memo: string }>;
}

interface ObjectifiedAction {
  account: string;
  name: string;
  data: string;
}

/**
 * Decode a packed msig transaction and assert it is a clean two-sided
 * SimpleAssets swap between exactly two accounts. Anything else is rejected so
 * the UI never renders (or offers to approve) an unrecognised proposal.
 */
export async function decodeSwapTransaction(packedHex: string): Promise<DecodedSwap | null> {
  try {
    const abi = await getContractAbi(SIMPLEASSETS_CONTRACT);
    const tx = Serializer.decode({ data: packedHex, type: Transaction });
    const obj = Serializer.objectify(tx) as {
      expiration: string;
      actions: ObjectifiedAction[];
      context_free_actions?: unknown[];
    };
    if ((obj.context_free_actions || []).length > 0) return null;
    const actions = obj.actions || [];
    if (actions.length !== 2) return null;
    if (!actions.every((a) => a.account === SIMPLEASSETS_CONTRACT && a.name === 'transfer')) return null;

    const transfers = actions.map((a) => {
      const decoded = Serializer.objectify(
        Serializer.decode({ data: a.data, abi, type: 'transfer' }),
      ) as { from: string; to: string; assetids: Array<string | number>; memo?: string };
      return {
        from: String(decoded.from),
        to: String(decoded.to),
        assetIds: (decoded.assetids || []).map((id) => String(id)),
        memo: String(decoded.memo ?? ''),
      };
    });

    const [a, b] = transfers;
    if (a.from !== b.to || a.to !== b.from) return null;
    if (a.from === a.to) return null;
    if (a.assetIds.length === 0 || b.assetIds.length === 0) return null;

    return {
      expiration: new Date(`${obj.expiration.replace(/Z$/, '')}Z`).getTime(),
      transfers,
    };
  } catch {
    return null;
  }
}

/* --------------------------- asset metadata ----------------------------- */

interface RawSAsset {
  id: string;
  owner: string;
  author: string;
  category: string;
  idata: string;
  mdata: string;
}

function parseJsonSafe(str: string): Record<string, unknown> {
  try { return JSON.parse(str) || {}; } catch { return {}; }
}

function resolveImage(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  const hash = extractIpfsHash(raw);
  if (hash) return getIpfsUrl(hash);
  if (raw.startsWith('Qm') || raw.startsWith('bafy') || raw.startsWith('bafk')) return getIpfsUrl(raw);
  return null;
}

async function loadOwnerAssets(owner: string): Promise<Map<string, OfferAsset>> {
  const index = new Map<string, OfferAsset>();
  let lowerBound = '';
  let hasMore = true;
  while (hasMore) {
    const res = await fetchTableRows<RawSAsset>({
      code: 'simpleassets', scope: owner, table: 'sassets',
      limit: 100, lower_bound: lowerBound || undefined,
    });
    for (const row of res.rows || []) {
      const combined = { ...parseJsonSafe(row.idata), ...parseJsonSafe(row.mdata) } as Record<string, unknown>;
      const cardid = String(combined.cardid ?? '');
      const side = String(combined.quality ?? '').toLowerCase();
      index.set(row.id, {
        asset_id: row.id,
        name: String(combined.name ?? `Asset #${row.id}`),
        image: resolveImage(
          (combined.img as string) || (combined.image as string) || (combined.icon as string) || null,
        ),
        collection_name: row.author || '',
        schema_name: row.category || '',
        template_id: null,
        mint: combined.mint != null ? String(combined.mint) : null,
        variant: normalizeGpkVariant(combined.variant as string | undefined),
        cardid: `${cardid}${side}`,
      });
    }
    hasMore = Boolean(res.more) && (res.rows?.length ?? 0) > 0;
    if (hasMore) {
      const lastId = res.rows[res.rows.length - 1].id;
      lowerBound = String(BigInt(lastId) + 1n);
    }
  }
  return index;
}

function placeholderAsset(assetId: string): OfferAsset {
  return {
    asset_id: assetId,
    name: `Asset #${assetId}`,
    image: null,
    collection_name: '',
    schema_name: '',
    template_id: null,
    mint: null,
  };
}

/* ------------------------------ main fetch ------------------------------ */

/**
 * Pending SimpleAssets swap proposals involving `account`, returned in the same
 * shape as AtomicAssets offers so the Trades UI can render both with one path.
 */
export async function fetchSaOffers(account: string): Promise<AtomicOffer[]> {
  if (!account) return [];

  const discovered = await fetchProposeActions(account);
  const hidden = readHidden(account);

  const candidates = new Map<string, SaProposalRef>();
  for (const ref of readJson<SaProposalRef[]>(`${CACHE_PREFIX}${account}`, [])) {
    candidates.set(saOfferId(ref.proposer, ref.name), ref);
  }
  for (const ref of discovered) {
    const id = saOfferId(ref.proposer, ref.name);
    if (!candidates.has(id)) candidates.set(id, ref);
  }

  const live = Array.from(candidates.entries()).filter(([id]) => !hidden.has(id));


  const ownerCache = new Map<string, Promise<Map<string, OfferAsset>>>();
  const assetsFor = (owner: string) => {
    if (!ownerCache.has(owner)) ownerCache.set(owner, loadOwnerAssets(owner).catch(() => new Map()));
    return ownerCache.get(owner)!;
  };

  const offers = await Promise.all(live.map(async ([id, ref]) => {
    const [row, approvals] = await Promise.all([
      fetchProposalRow(ref.proposer, ref.name),
      fetchApprovals(ref.proposer, ref.name),
    ]);
    if (!row) return null; // executed, cancelled or expired away

    const swap = await decodeSwapTransaction(row.packed_transaction);
    if (!swap) return null;
    if (swap.expiration < Date.now()) return null;

    const mine = swap.transfers.find((t) => t.from === ref.proposer);
    const theirs = swap.transfers.find((t) => t.to === ref.proposer);
    if (!mine || !theirs) return null;

    const recipient = mine.to;
    if (account !== ref.proposer && account !== recipient) return null;

    const [senderIndex, recipientIndex] = await Promise.all([
      assetsFor(ref.proposer),
      assetsFor(recipient),
    ]);

    // Both parties must still own everything they promised.
    const senderAssets = mine.assetIds.map((aid) => senderIndex.get(aid));
    const recipientAssets = theirs.assetIds.map((aid) => recipientIndex.get(aid));
    if (senderAssets.some((a) => !a) || recipientAssets.some((a) => !a)) return null;

    const provided = new Set((approvals?.provided_approvals || []).map(approvalActor));

    const offer: AtomicOffer = {
      offer_id: id,
      sender_name: ref.proposer,
      recipient_name: recipient,
      memo: mine.memo || theirs.memo || '',
      state: 0,
      sender_assets: senderAssets.map((a, i) => a ?? placeholderAsset(mine.assetIds[i])),
      recipient_assets: recipientAssets.map((a, i) => a ?? placeholderAsset(theirs.assetIds[i])),
      is_sender_contract: false,
      is_recipient_contract: false,
      created_at_time: ref.createdAt || swap.expiration - 7 * 86_400_000,
      updated_at_time: ref.createdAt || 0,
      protocol: 'simpleassets',
      proposal: {
        proposer: ref.proposer,
        name: ref.name,
        expiresAt: swap.expiration,
        approvedBy: Array.from(provided),
      },
    };
    return offer;
  }));

  return applySupersession(offers.filter((o): o is AtomicOffer => o !== null), account);
}

/**
 * A counter-offer carries `re:<name>` in its memo. Any live proposal referenced
 * that way has been replaced: drop it from my Received list, and flag it in my
 * Sent list so I can see it was countered (and cancel it). The marker is
 * stripped from the memo shown in the UI.
 */
export function applySupersession(offers: AtomicOffer[], account: string): AtomicOffer[] {
  const supersededBy = new Map<string, string>();
  for (const o of offers) {
    const target = parseCounterRef(o.memo);
    if (target && o.proposal?.name) supersededBy.set(target, o.proposal.name);
  }

  const out: AtomicOffer[] = [];
  for (const o of offers) {
    const cleanMemo = stripCounterRef(o.memo);
    const name = o.proposal?.name;
    const replacedBy = name ? supersededBy.get(name) : undefined;
    if (replacedBy) {
      // Only the proposer can act on it (cancel); for the recipient it is gone.
      if (o.sender_name !== account) continue;
      out.push({ ...o, memo: cleanMemo, proposal: { ...o.proposal!, supersededBy: replacedBy } });
      continue;
    }
    out.push({ ...o, memo: cleanMemo });
  }
  return out;
}

