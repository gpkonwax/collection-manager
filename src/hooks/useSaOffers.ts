import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSaOffers } from '@/lib/saOffers';
import type { AtomicOffer } from '@/lib/atomicOffers';

const POLL_INTERVAL_MS = 60_000;

export interface UseSaOffersResult {
  offers: AtomicOffer[];
  incoming: AtomicOffer[];
  outgoing: AtomicOffer[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  removeOfferLocally: (offerId: string) => void;
  refreshWithRetries: (attempts?: number, delayMs?: number) => Promise<void>;
}

/**
 * Poll pending SimpleAssets swap proposals (eosio.msig) for the given account.
 * Mirrors the surface of `useAtomicOffers` so both protocols can be merged.
 */
export function useSaOffers(account: string | null): UseSaOffersResult {
  const [offers, setOffers] = useState<AtomicOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountRef = useRef(account);
  accountRef.current = account;

  useEffect(() => {
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
      const list = await fetchSaOffers(acc);
      if (accountRef.current !== acc) return;
      setOffers(list);
      setError(null);
    } catch (e) {
      if (accountRef.current !== acc) return;
      setError((e as Error).message || 'Failed to load SimpleAssets offers');
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

  return { offers, incoming, outgoing, isLoading, error, refresh, removeOfferLocally, refreshWithRetries };
}
