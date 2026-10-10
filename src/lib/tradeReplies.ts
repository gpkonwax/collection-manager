// Replies to trade offers I sent: accepted, declined or countered.
//
// Each poll snapshots my pending sent offers. When one disappears from the
// pending list its outcome is looked up (AtomicAssets offer state, or the
// eosio.msig history for SimpleAssets swaps) and turned into a reply the
// Trades button badge and Trades dialog can show. Offers I cancelled or
// countered myself from this app never produce a reply.

import type { AtomicOffer, OfferAsset, OfferPack, TradeProtocol } from '@/lib/atomicOffers';

export type ReplyOutcome = 'accepted' | 'declined' | 'countered';

export interface PendingSent {
  id: string;
  protocol: TradeProtocol;
  counterparty: string;
  sent: OfferAsset[];
  sentPacks: OfferPack[];
  receivedCount: number;
  createdAt: number;
  proposal?: { proposer: string; name: string; expiresAt: number };
  /** When it first went missing from the pending list (0 = still pending). */
  vanishedAt: number;
}

export interface TradeReply {
  id: string;
  protocol: TradeProtocol;
  outcome: ReplyOutcome;
  counterparty: string;
  sent: OfferAsset[];
  sentPacks: OfferPack[];
  receivedCount: number;
  repliedAt: number;
  /** Offer id of the counter-offer in Received, when countered. */
  counterOfferId?: string;
  seen: boolean;
  dismissed: boolean;
}

export interface ReplyStore {
  pending: Record<string, PendingSent>;
  replies: TradeReply[];
  /** Offers I resolved myself (cancel / own counter) — never notify. */
  self: string[];
}

export const MAX_REPLIES = 50;
const MAX_SELF = 200;
/** Give up looking up an outcome after this long. */
export const GIVE_UP_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
/** A counter-offer must arrive within this window of the decline. */
export const COUNTER_WINDOW_MS = 3 * 60 * 1000;
/** Wait this long after a decline before deciding it was not a counter. */
export const COUNTER_GRACE_MS = 5 * 60 * 1000;

const STORE_PREFIX = 'gpk-trade-replies:';

export function emptyStore(): ReplyStore {
  return { pending: {}, replies: [], self: [] };
}

export function loadStore(account: string | null): ReplyStore {
  if (!account || typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.localStorage.getItem(`${STORE_PREFIX}${account}`);
    if (!raw) return emptyStore();
    const p = JSON.parse(raw);
    return {
      pending: p?.pending && typeof p.pending === 'object' ? p.pending : {},
      replies: Array.isArray(p?.replies) ? p.replies : [],
      self: Array.isArray(p?.self) ? p.self : [],
    };
  } catch {
    return emptyStore();
  }
}

export function saveStore(account: string | null, store: ReplyStore) {
  if (!account || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORE_PREFIX}${account}`, JSON.stringify(store));
  } catch { /* ignore */ }
}

function snapshot(o: AtomicOffer, protocol: TradeProtocol): PendingSent {
  return {
    id: o.offer_id,
    protocol,
    counterparty: o.recipient_name,
    sent: o.sender_assets,
    sentPacks: o.sender_packs || [],
    receivedCount: o.recipient_assets.length
      + (o.recipient_packs || []).reduce((n, p) => n + p.amount, 0),
    createdAt: o.created_at_time,
    proposal: o.proposal
      ? { proposer: o.proposal.proposer, name: o.proposal.name, expiresAt: o.proposal.expiresAt }
      : undefined,
    vanishedAt: 0,
  };
}

export function makeReply(
  p: PendingSent, outcome: ReplyOutcome, repliedAt: number, counterOfferId?: string,
): TradeReply {
  return {
    id: p.id, protocol: p.protocol, outcome, counterparty: p.counterparty,
    sent: p.sent, sentPacks: p.sentPacks, receivedCount: p.receivedCount,
    repliedAt, counterOfferId, seen: false, dismissed: false,
  };
}

function addReply(store: ReplyStore, reply: TradeReply): ReplyStore {
  if (store.replies.some((r) => r.id === reply.id)) return store;
  return { ...store, replies: [reply, ...store.replies].slice(0, MAX_REPLIES) };
}

/**
 * Compare a fresh pending-sent list for one protocol with the stored snapshot.
 * Returns the updated store; offers that went missing are flagged with
 * `vanishedAt` so the caller can look up their outcome.
 */
export function reconcileSent(
  store: ReplyStore,
  protocol: TradeProtocol,
  outgoing: AtomicOffer[],
  now: number,
  saOfferIdFor?: (proposer: string, name: string) => string,
): ReplyStore {
  const self = new Set(store.self);
  const replied = new Set(store.replies.map((r) => r.id));
  let next: ReplyStore = { ...store, pending: { ...store.pending } };
  const live = new Set<string>();

  for (const o of outgoing) {
    if (self.has(o.offer_id) || replied.has(o.offer_id)) continue;
    live.add(o.offer_id);
    const snap = next.pending[o.offer_id] ?? snapshot(o, protocol);
    // A SimpleAssets counter-offer marks the original as superseded while it
    // is still live on-chain — that alone means they countered.
    const sup = o.proposal?.supersededBy;
    if (sup && saOfferIdFor) {
      delete next.pending[o.offer_id];
      next = addReply(next, makeReply(snap, 'countered', now, saOfferIdFor(o.recipient_name, sup)));
      continue;
    }
    next.pending[o.offer_id] = { ...snap, vanishedAt: 0 };
  }

  for (const [id, p] of Object.entries(next.pending)) {
    if (p.protocol !== protocol) continue;
    if (self.has(id)) { delete next.pending[id]; continue; }
    if (live.has(id)) continue;
    if (!p.vanishedAt) next.pending[id] = { ...p, vanishedAt: now };
    else if (now - p.vanishedAt > GIVE_UP_AFTER_MS) delete next.pending[id];
  }
  return next;
}

export function vanished(store: ReplyStore, protocol: TradeProtocol): PendingSent[] {
  return Object.values(store.pending).filter((p) => p.protocol === protocol && p.vanishedAt > 0);
}

/** Record the outcome of a vanished offer (null outcome = drop silently). */
export function resolvePending(
  store: ReplyStore, id: string, outcome: ReplyOutcome | null, repliedAt: number, counterOfferId?: string,
): ReplyStore {
  const p = store.pending[id];
  if (!p) return store;
  const pending = { ...store.pending };
  delete pending[id];
  const next = { ...store, pending };
  return outcome ? addReply(next, makeReply(p, outcome, repliedAt, counterOfferId)) : next;
}

export function markSelf(store: ReplyStore, id: string): ReplyStore {
  if (store.self.includes(id)) return store;
  const pending = { ...store.pending };
  delete pending[id];
  return { ...store, pending, self: [id, ...store.self].slice(0, MAX_SELF) };
}

// ---------- outcome classification ----------

export type Classification =
  | { kind: 'reply'; outcome: ReplyOutcome; at: number; counterOfferId?: string }
  | { kind: 'silent' }   // cancelled by me — no notification
  | { kind: 'wait' };    // not known yet — try again on the next poll

/**
 * AtomicAssets: 3 accepted, 4 declined, 5 cancelled (by me).
 * A counter declines the original and creates a new offer back to me in one
 * transaction, so a decline followed closely by an incoming offer from the
 * same trader is a counter.
 */
export function classifyAaOutcome(
  offer: Pick<AtomicOffer, 'state' | 'recipient_name' | 'updated_at_time'> | null,
  incoming: Pick<AtomicOffer, 'offer_id' | 'sender_name' | 'created_at_time'>[],
  now: number,
): Classification {
  if (!offer) return { kind: 'wait' };
  const at = offer.updated_at_time || now;
  if (offer.state === 3) return { kind: 'reply', outcome: 'accepted', at };
  if (offer.state === 5) return { kind: 'silent' };
  if (offer.state === 4) {
    const counter = incoming.find((o) =>
      o.sender_name === offer.recipient_name
      && Math.abs(o.created_at_time - at) <= COUNTER_WINDOW_MS);
    if (counter) return { kind: 'reply', outcome: 'countered', at, counterOfferId: counter.offer_id };
    if (now - at < COUNTER_GRACE_MS) return { kind: 'wait' };
    return { kind: 'reply', outcome: 'declined', at };
  }
  return { kind: 'wait' };
}

export type MsigOutcome =
  | { type: 'executed'; at: number }
  | { type: 'cancelled'; by: string; at: number }
  | { type: 'none' }       // history reachable, nothing found
  | { type: 'unknown' };   // history unreachable

/** SimpleAssets swap proposal outcome. */
export function classifySaOutcome(
  result: MsigOutcome, me: string, expiresAt: number, now: number,
): Classification {
  if (result.type === 'executed') return { kind: 'reply', outcome: 'accepted', at: result.at };
  if (result.type === 'cancelled') {
    return result.by === me ? { kind: 'silent' } : { kind: 'reply', outcome: 'declined', at: result.at };
  }
  if (result.type === 'none' && expiresAt > 0 && expiresAt < now) {
    return { kind: 'reply', outcome: 'declined', at: expiresAt };
  }
  return { kind: 'wait' };
}
