import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AtomicOffer, TradeProtocol } from '@/lib/atomicOffers';
import { fetchOffersByIds } from '@/lib/atomicOffers';
import { fetchProposalOutcome, saOfferId } from '@/lib/saOffers';
import {
  classifyAaOutcome, classifySaOutcome, loadStore, markSelf, reconcileSent,
  resolvePending, saveStore, vanished, type ReplyStore, type TradeReply,
} from '@/lib/tradeReplies';

interface Inputs {
  aaOutgoing: AtomicOffer[];
  aaFetchedAt: number;
  saOutgoing: AtomicOffer[];
  saFetchedAt: number;
  incoming: AtomicOffer[];
}

export interface UseTradeRepliesResult {
  /** Replies not yet dismissed, newest first. */
  replies: TradeReply[];
  unreadReplyCount: number;
  markRepliesSeen: () => void;
  dismissReply: (id: string) => void;
  dismissAllReplies: () => void;
  /** Call when I cancel / counter my own offer so it never notifies. */
  markSelfResolved: (offerId: string) => void;
}

/** Tracks replies (accepted / declined / countered) to offers I sent. */
export function useTradeReplies(account: string | null, inputs: Inputs): UseTradeRepliesResult {
  const [store, setStore] = useState<ReplyStore>(() => loadStore(account));
  const storeRef = useRef(store);
  const accountRef = useRef(account);
  accountRef.current = account;
  const incomingRef = useRef(inputs.incoming);
  incomingRef.current = inputs.incoming;

  useEffect(() => {
    const s = loadStore(account);
    storeRef.current = s;
    setStore(s);
  }, [account]);

  const update = useCallback((acc: string, fn: (s: ReplyStore) => ReplyStore) => {
    if (accountRef.current !== acc) return;
    const next = fn(storeRef.current);
    if (next === storeRef.current) return;
    storeRef.current = next;
    saveStore(acc, next);
    setStore(next);
  }, []);

  const busy = useRef<Record<TradeProtocol, boolean>>({ atomicassets: false, simpleassets: false });

  const run = useCallback(async (protocol: TradeProtocol, outgoing: AtomicOffer[]) => {
    const acc = accountRef.current;
    if (!acc || busy.current[protocol]) return;
    busy.current[protocol] = true;
    try {
      const now = Date.now();
      update(acc, (s) => reconcileSent(s, protocol, outgoing, now, protocol === 'simpleassets' ? saOfferId : undefined));
      const gone = vanished(storeRef.current, protocol);
      if (gone.length === 0) return;

      if (protocol === 'atomicassets') {
        let found;
        try { found = await fetchOffersByIds(gone.map((p) => p.id)); } catch { return; }
        for (const p of gone) {
          const c = classifyAaOutcome(found.get(p.id) ?? null, incomingRef.current, Date.now());
          if (c.kind === 'reply') update(acc, (s) => resolvePending(s, p.id, c.outcome, c.at, c.counterOfferId));
          else if (c.kind === 'silent') update(acc, (s) => resolvePending(s, p.id, null, 0));
        }
      } else {
        for (const p of gone) {
          if (!p.proposal) { update(acc, (s) => resolvePending(s, p.id, null, 0)); continue; }
          const r = await fetchProposalOutcome(p.proposal.proposer, p.proposal.name, p.createdAt);
          const c = classifySaOutcome(r, acc, p.proposal.expiresAt, Date.now());
          if (c.kind === 'reply') update(acc, (s) => resolvePending(s, p.id, c.outcome, c.at));
          else if (c.kind === 'silent') update(acc, (s) => resolvePending(s, p.id, null, 0));
        }
      }
    } finally {
      busy.current[protocol] = false;
    }
  }, [update]);

  // Only diff after a successful poll, so an empty list during loading or an
  // outage never looks like every sent offer vanished.
  useEffect(() => {
    if (inputs.aaFetchedAt > 0) void run('atomicassets', inputs.aaOutgoing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.aaFetchedAt, run]);
  useEffect(() => {
    if (inputs.saFetchedAt > 0) void run('simpleassets', inputs.saOutgoing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.saFetchedAt, run]);

  const replies = useMemo(
    () => store.replies.filter((r) => !r.dismissed).sort((a, b) => b.repliedAt - a.repliedAt),
    [store.replies],
  );
  const unreadReplyCount = useMemo(() => replies.filter((r) => !r.seen).length, [replies]);

  const markRepliesSeen = useCallback(() => {
    const acc = accountRef.current;
    if (!acc) return;
    update(acc, (s) => s.replies.some((r) => !r.seen)
      ? { ...s, replies: s.replies.map((r) => ({ ...r, seen: true })) } : s);
  }, [update]);

  const dismissReply = useCallback((id: string) => {
    const acc = accountRef.current;
    if (!acc) return;
    update(acc, (s) => ({ ...s, replies: s.replies.map((r) => r.id === id ? { ...r, dismissed: true, seen: true } : r) }));
  }, [update]);

  const dismissAllReplies = useCallback(() => {
    const acc = accountRef.current;
    if (!acc) return;
    update(acc, (s) => ({ ...s, replies: s.replies.map((r) => ({ ...r, dismissed: true, seen: true })) }));
  }, [update]);

  const markSelfResolved = useCallback((offerId: string) => {
    const acc = accountRef.current;
    if (!acc) return;
    update(acc, (s) => markSelf(s, offerId));
  }, [update]);

  return { replies, unreadReplyCount, markRepliesSeen, dismissReply, dismissAllReplies, markSelfResolved };
}
