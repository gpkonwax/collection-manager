import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchPendingOffers, type AtomicOffer } from '@/lib/atomicOffers';

const LAST_SEEN_PREFIX = 'gpk-trades-last-seen:';
const POLL_INTERVAL_MS = 60_000;

function readLastSeen(account: string | null): number {
  if (!account || typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(`${LAST_SEEN_PREFIX}${account}`);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeLastSeen(account: string | null, ts: number) {
  if (!account || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${LAST_SEEN_PREFIX}${account}`, String(ts));
  } catch {
    /* ignore */
  }
}

export interface UseAtomicOffersResult {
  offers: AtomicOffer[];
  incoming: AtomicOffer[];
  outgoing: AtomicOffer[];
  incomingUnreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Drop an offer from local state immediately (optimistic UI). */
  removeOfferLocally: (offerId: string) => void;
  /** Refresh now, then again a few times to outrun indexer lag. */
  refreshWithRetries: (attempts?: number, delayMs?: number) => Promise<void>;
  markAllRead: () => void;
}


/**
 * Poll pending AtomicAssets offers for the given account.
 * Read-only. Tracks per-account "last seen" timestamp in localStorage
 * so the header badge only counts newly-arrived incoming offers.
 */
export function useAtomicOffers(account: string | null): UseAtomicOffersResult {
  const [offers, setOffers] = useState<AtomicOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<number>(() => readLastSeen(account));

  const accountRef = useRef(account);
  accountRef.current = account;

  // Reset lastSeen when the active account changes.
  useEffect(() => {
    setLastSeen(readLastSeen(account));
    setOffers([]);
    setError(null);
  }, [account]);

  const refresh = useCallback(async () => {
    const acc = accountRef.current;
    if (!acc) {
      setOffers([]);
      return;
    }
    setIsLoading(true);
    try {
      const list = await fetchPendingOffers(acc);
      // Guard against stale responses if the account switched mid-flight.
      if (accountRef.current !== acc) return;
      setOffers(list);
      setError(null);
    } catch (e) {
      if (accountRef.current !== acc) return;
      setError((e as Error).message || 'Failed to load offers');
    } finally {
      if (accountRef.current === acc) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!account) return;
    void refresh();
    const id = window.setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [account, refresh]);

  const { incoming, outgoing } = useMemo(() => {
    const inc: AtomicOffer[] = [];
    const out: AtomicOffer[] = [];
    for (const o of offers) {
      if (!account) continue;
      if (o.recipient_name === account) inc.push(o);
      else if (o.sender_name === account) out.push(o);
    }
    return { incoming: inc, outgoing: out };
  }, [offers, account]);

  const incomingUnreadCount = useMemo(
    () => incoming.filter((o) => o.created_at_time > lastSeen).length,
    [incoming, lastSeen],
  );

  const markAllRead = useCallback(() => {
    if (!accountRef.current) return;
    const now = Date.now();
    writeLastSeen(accountRef.current, now);
    setLastSeen(now);
  }, []);

  const removeOfferLocally = useCallback((offerId: string) => {
    setOffers((prev) => prev.filter((o) => o.offer_id !== offerId));
  }, []);

  const refreshWithRetries = useCallback(async (attempts = 4, delayMs = 2500) => {
    const acc = accountRef.current;
    for (let i = 0; i < attempts; i++) {
      await refresh();
      if (accountRef.current !== acc) return;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
        if (accountRef.current !== acc) return;
      }
    }
  }, [refresh]);

  return {
    offers,
    incoming,
    outgoing,
    incomingUnreadCount,
    isLoading,
    error,
    refresh,
    removeOfferLocally,
    refreshWithRetries,
    markAllRead,
  };

}
