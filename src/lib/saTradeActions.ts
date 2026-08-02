// SimpleAssets ↔ SimpleAssets P2P trading (SA↔SA only, never mixed with AA).
//
// SimpleAssets has no two-sided escrow like AtomicAssets' `createoffer`, so a
// swap is executed as an atomic eosio.msig proposal containing BOTH transfers:
//
//   simpleassets::transfer(me   -> them, myAssetIds)
//   simpleassets::transfer(them -> me,   theirAssetIds)
//
// The proposal only ever executes once both parties have approved, so neither
// side can walk away holding both cards.
//
// Discovery: no on-chain beacon is used (a dust token transfer would fail for
// accounts with zero liquid WAX). Incoming proposals are found by scanning
// recent `eosio.msig::propose` actions in history — see saOffers.ts.

import { ABI, Action, Serializer, Transaction } from '@wharfkit/antelope';
import { waxRpcCall } from '@/lib/waxRpcFallback';
import type { WaxAction } from '@/lib/atomicTradeActions';

export const SIMPLEASSETS_CONTRACT = 'simpleassets';
export const MSIG_CONTRACT = 'eosio.msig';

/** Soft cap per side, mirroring the AtomicAssets composer. */
export const SA_MAX_ASSETS_PER_SIDE = 30;
export const SA_MAX_MEMO_LENGTH = 256;

/** Proposals stay valid on-chain for 7 days. */
export const SA_PROPOSAL_EXPIRY_SECONDS = 7 * 24 * 60 * 60;


function auth(actor: string): Array<{ actor: string; permission: string }> {
  return [{ actor, permission: 'active' }];
}

/* ------------------------------------------------------------------ *
 * Pure builders (unit-testable, no network)
 * ------------------------------------------------------------------ */

export function buildSaTransferAction(
  from: string,
  to: string,
  assetIds: string[],
  memo = '',
): WaxAction {
  return {
    account: SIMPLEASSETS_CONTRACT,
    name: 'transfer',
    authorization: auth(from),
    data: {
      from,
      to,
      assetids: assetIds,
      memo: memo.slice(0, SA_MAX_MEMO_LENGTH),
    },
  };
}

export function buildMsigApproveAction(
  approver: string,
  proposer: string,
  proposalName: string,
): WaxAction {
  return {
    account: MSIG_CONTRACT,
    name: 'approve',
    authorization: auth(approver),
    data: {
      proposer,
      proposal_name: proposalName,
      level: { actor: approver, permission: 'active' },
    },
  };
}

export function buildMsigUnapproveAction(
  approver: string,
  proposer: string,
  proposalName: string,
): WaxAction {
  return {
    account: MSIG_CONTRACT,
    name: 'unapprove',
    authorization: auth(approver),
    data: {
      proposer,
      proposal_name: proposalName,
      level: { actor: approver, permission: 'active' },
    },
  };
}

export function buildMsigExecAction(
  executer: string,
  proposer: string,
  proposalName: string,
): WaxAction {
  return {
    account: MSIG_CONTRACT,
    name: 'exec',
    authorization: auth(executer),
    data: { proposer, proposal_name: proposalName, executer },
  };
}

export function buildMsigCancelAction(
  canceler: string,
  proposer: string,
  proposalName: string,
): WaxAction {
  return {
    account: MSIG_CONTRACT,
    name: 'cancel',
    authorization: auth(canceler),
    data: { proposer, proposal_name: proposalName, canceler },
  };
}


const NAME_CHARS = 'abcdefghijklmnopqrstuvwxyz12345';

/**
 * Deterministic-ish 12-char eosio name for a proposal: `g` + base31(timestamp)
 * + 3 random chars. Only uses characters legal in an eosio name.
 */
export function makeProposalName(seed: number = Date.now(), rand: number = Math.random()): string {
  let n = Math.floor(Math.abs(seed));
  let ts = '';
  while (n > 0 && ts.length < 8) {
    ts = NAME_CHARS[n % NAME_CHARS.length] + ts;
    n = Math.floor(n / NAME_CHARS.length);
  }
  ts = ts.padStart(8, 'a');
  let x = Math.floor(Math.min(Math.max(rand, 0), 0.999999) * NAME_CHARS.length ** 3);
  let suffix = '';
  for (let i = 0; i < 3; i++) {
    suffix = NAME_CHARS[x % NAME_CHARS.length] + suffix;
    x = Math.floor(x / NAME_CHARS.length);
  }
  return `g${ts}${suffix}`.slice(0, 12);
}

export interface SaOfferValidation {
  ok: boolean;
  reason?: string;
}

export function validateSaOffer(
  me: string,
  counterparty: string,
  myIds: string[],
  theirIds: string[],
): SaOfferValidation {
  if (!me || !counterparty) return { ok: false, reason: 'Missing account' };
  if (me === counterparty) return { ok: false, reason: "You can't trade with yourself" };
  if (myIds.length === 0 || theirIds.length === 0) {
    return { ok: false, reason: 'SimpleAssets swaps need at least one card on each side' };
  }
  if (myIds.length > SA_MAX_ASSETS_PER_SIDE || theirIds.length > SA_MAX_ASSETS_PER_SIDE) {
    return { ok: false, reason: `Max ${SA_MAX_ASSETS_PER_SIDE} cards per side` };
  }
  if (new Set(myIds).size !== myIds.length || new Set(theirIds).size !== theirIds.length) {
    return { ok: false, reason: 'Duplicate asset in selection' };
  }
  if (myIds.some((id) => theirIds.includes(id))) {
    return { ok: false, reason: 'The same asset appears on both sides' };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Chain helpers
 * ------------------------------------------------------------------ */

const abiCache = new Map<string, ABI>();

export async function getContractAbi(account: string): Promise<ABI> {
  const cached = abiCache.get(account);
  if (cached) return cached;
  const res = await waxRpcCall<{ abi?: unknown }>('/v1/chain/get_abi', { account_name: account }, 10000);
  if (!res?.abi) throw new Error(`Could not load ABI for ${account}`);
  const abi = ABI.from(res.abi as ABI.Def);
  abiCache.set(account, abi);
  return abi;
}

export interface TransactionHeader {
  expiration: string;
  ref_block_num: number;
  ref_block_prefix: number;
}

/**
 * TAPOS header built by hand from get_info (the typed antelope API client is
 * not used here so all chain reads keep going through the RPC fallback list).
 */
export function makeTransactionHeader(
  headBlockTimeIso: string,
  lastIrreversibleBlockNum: number,
  lastIrreversibleBlockId: string,
  expireSeconds: number,
): TransactionHeader {
  const base = new Date(`${headBlockTimeIso.replace(/Z$/, '')}Z`).getTime();
  const expiration = new Date(base + expireSeconds * 1000)
    .toISOString()
    .replace(/\.\d+Z$/, '');
  // ref_block_prefix = little-endian uint32 from bytes 8..12 of the block id.
  const prefixHex = lastIrreversibleBlockId.slice(16, 24);
  const bytes = prefixHex.match(/../g) || [];
  let prefix = 0;
  for (let i = bytes.length - 1; i >= 0; i--) {
    prefix = prefix * 256 + parseInt(bytes[i], 16);
  }
  return {
    expiration,
    ref_block_num: lastIrreversibleBlockNum & 0xffff,
    ref_block_prefix: prefix >>> 0,
  };
}

interface ChainInfo {
  head_block_time: string;
  last_irreversible_block_num: number;
  last_irreversible_block_id: string;
}

async function getTransactionHeader(expireSeconds: number): Promise<TransactionHeader> {
  const info = await waxRpcCall<ChainInfo>('/v1/chain/get_info', {}, 10000);
  return makeTransactionHeader(
    info.head_block_time,
    info.last_irreversible_block_num,
    info.last_irreversible_block_id,
    expireSeconds,
  );
}


/** Serialize the two-transfer swap transaction that the proposal will hold. */
export async function buildSwapTransactionObject(params: {
  me: string;
  counterparty: string;
  myAssetIds: string[];
  theirAssetIds: string[];
  memo?: string;
  expireSeconds?: number;
}): Promise<{ trx: Record<string, unknown>; expiresAt: number }> {
  const abi = await getContractAbi(SIMPLEASSETS_CONTRACT);
  const expireSeconds = params.expireSeconds ?? SA_PROPOSAL_EXPIRY_SECONDS;
  const header = await getTransactionHeader(expireSeconds);

  const memo = (params.memo || '').slice(0, SA_MAX_MEMO_LENGTH);
  const inner = [
    buildSaTransferAction(params.me, params.counterparty, params.myAssetIds, memo),
    buildSaTransferAction(params.counterparty, params.me, params.theirAssetIds, memo),
  ].map((a) => Action.from(a, abi));

  const transaction = Transaction.from({ ...header, actions: inner });
  const trx = Serializer.objectify(transaction) as Record<string, unknown>;
  const expiresAt = new Date(`${String(trx.expiration)}Z`).getTime();
  return { trx, expiresAt };
}

export interface SaSwapBundle {
  actions: WaxAction[];
  proposalName: string;
  expiresAt: number;
}

/**
 * Full action bundle for proposing a swap: msig propose + my approval.
 * Costs no tokens — only CPU/NET. When countering my own earlier proposal it is
 * cancelled in the same transaction; someone else's proposal can't be cancelled
 * by me, so it is simply hidden locally by the caller.
 */
export async function buildSaSwapActions(params: {
  me: string;
  counterparty: string;
  myAssetIds: string[];
  theirAssetIds: string[];
  memo?: string;
  /** Existing proposal being countered. */
  counterProposal?: { proposer: string; name: string } | null;
  proposalName?: string;
}): Promise<SaSwapBundle> {
  const proposalName = params.proposalName || makeProposalName();
  const { trx, expiresAt } = await buildSwapTransactionObject(params);

  const actions: WaxAction[] = [];

  if (params.counterProposal && params.counterProposal.proposer === params.me) {
    actions.push(buildMsigCancelAction(params.me, params.me, params.counterProposal.name));
  }

  actions.push({
    account: MSIG_CONTRACT,
    name: 'propose',
    authorization: auth(params.me),
    data: {
      proposer: params.me,
      proposal_name: proposalName,
      requested: [
        { actor: params.me, permission: 'active' },
        { actor: params.counterparty, permission: 'active' },
      ],
      trx,
    },
  });
  actions.push(buildMsigApproveAction(params.me, params.me, proposalName));

  return { actions, proposalName, expiresAt };
}

/** Accept: approve then execute in a single signed transaction. */
export function buildSaAcceptActions(me: string, proposer: string, proposalName: string): WaxAction[] {
  return [
    buildMsigApproveAction(me, proposer, proposalName),
    buildMsigExecAction(me, proposer, proposalName),
  ];
}

/**
 * Decline (recipient): withdraw my approval if I had given one, otherwise there
 * is nothing to sign — the offer is just hidden locally.
 */
export function buildSaDeclineActions(
  me: string,
  proposer: string,
  proposalName: string,
  hasApproved = false,
): WaxAction[] {
  return hasApproved ? [buildMsigUnapproveAction(me, proposer, proposalName)] : [];
}

/** Cancel (proposer): remove the proposal from the chain. */
export function buildSaCancelActions(me: string, proposalName: string): WaxAction[] {
  return [buildMsigCancelAction(me, me, proposalName)];
}

