import { useState, useEffect, useRef, useCallback } from 'react';
import { IPFS_GATEWAYS, extractIpfsHash, IMAGE_LOAD_TIMEOUT } from '@/lib/ipfsGateways';

// Module-level cache: maps IPFS hash → index of last successful gateway
const gatewayCache = new Map<string, number>();
// Module-level cache: maps IPFS hash → exact URL that successfully loaded
const loadedUrlCache = new Map<string, string>();
// Global last-known-good gateway so new hashes skip dead gateways
let lastGoodGatewayIndex = 0;

const MAX_RETRY_ROUNDS = 10;
const LOADED_CACHE_MAX = 2000;

export function getCachedGatewayIndex(hash: string | null): number {
  if (!hash) return lastGoodGatewayIndex;
  return gatewayCache.get(hash) ?? lastGoodGatewayIndex;
}

export function getCachedLoadedUrl(hash: string | null): string | null {
  if (!hash) return null;
  return loadedUrlCache.get(hash) ?? null;
}

function setCachedGateway(hash: string, idx: number) {
  gatewayCache.set(hash, idx);
  lastGoodGatewayIndex = idx;
  if (gatewayCache.size > 500) {
    const first = gatewayCache.keys().next().value;
    if (first) gatewayCache.delete(first);
  }
}

function setCachedLoadedUrl(hash: string, url: string) {
  loadedUrlCache.set(hash, url);
  if (loadedUrlCache.size > LOADED_CACHE_MAX) {
    const first = loadedUrlCache.keys().next().value;
    if (first) loadedUrlCache.delete(first);
  }
}

interface UseIpfsMediaOptions {
  timeout?: number;
  context?: 'card' | 'detail';
  /** When false, skip all loading/gateway rotation until enabled */
  enabled?: boolean;
}

interface UseIpfsMediaResult {
  src: string;
  onError: () => void;
  onLoad: () => void;
  isLoading: boolean;
  failed: boolean;
}

export function useIpfsMedia(
  originalUrl: string | undefined,
  options: UseIpfsMediaOptions = {}
): UseIpfsMediaResult {
  const { context = 'card', enabled = true } = options;
  const baseTimeout = context === 'detail' ? IMAGE_LOAD_TIMEOUT.detail : IMAGE_LOAD_TIMEOUT.card;

  const hash = originalUrl ? extractIpfsHash(originalUrl) : null;
  const cachedLoadedUrl = getCachedLoadedUrl(hash);
  const startIdx = getCachedGatewayIndex(hash);

  const [gwIdx, setGwIdx] = useState(startIdx);
  const [triedCount, setTriedCount] = useState(0);
  const [retryRound, setRetryRound] = useState(0);
  // `failed` only becomes true after MAX_RETRY_ROUNDS are exhausted
  const [failed, setFailed] = useState(false);
  // If we already have a known-good URL for this hash, skip loading state entirely
  const [isLoading, setIsLoading] = useState(!cachedLoadedUrl);
  // Cache-busting nonce so the browser actually refetches between rounds
  const [nonce, setNonce] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Reset state when URL changes
  useEffect(() => {
    const newCached = getCachedLoadedUrl(hash);
    const newStart = getCachedGatewayIndex(hash);
    setGwIdx(newStart);
    setTriedCount(0);
    setRetryRound(0);
    setFailed(false);
    setIsLoading(!newCached);
    setNonce(0);
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [originalUrl, hash]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Timeout-based fallback — only when enabled
  useEffect(() => {
    if (!enabled || failed || !isLoading || !hash) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    const timeout = Math.min(baseTimeout + triedCount * IMAGE_LOAD_TIMEOUT.increment, IMAGE_LOAD_TIMEOUT.max);

    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      advance();
    }, timeout);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gwIdx, isLoading, failed, hash, baseTimeout, triedCount, enabled]);

  const advance = useCallback(() => {
    if (triedCount + 1 >= IPFS_GATEWAYS.length) {
      // Finished a full rotation — schedule a delayed retry instead of giving up.
      if (retryRound + 1 >= MAX_RETRY_ROUNDS) {
        setFailed(true);
        setIsLoading(false);
        return;
      }
      const backoff = Math.min(2000 * Math.pow(2, retryRound), 30000);
      setIsLoading(false); // pause loading during the wait
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setRetryRound(r => r + 1);
        setTriedCount(0);
        setGwIdx(0);
        setNonce(n => n + 1);
        setIsLoading(true);
      }, backoff);
    } else {
      setTriedCount(prev => prev + 1);
      setGwIdx(prev => (prev + 1) % IPFS_GATEWAYS.length);
    }
  }, [triedCount, retryRound]);

  const onError = useCallback(() => {
    advance();
  }, [advance]);

  let src: string;
  if (cachedLoadedUrl) {
    // Already successfully loaded once — reuse the exact known-good URL (browser HTTP cache will serve it)
    src = cachedLoadedUrl;
  } else if (!enabled) {
    // Not visible yet — return placeholder, don't trigger any loading
    src = '/placeholder.svg';
  } else if (failed || !originalUrl) {
    src = '/placeholder.svg';
  } else if (hash) {
    const base = `${IPFS_GATEWAYS[gwIdx]}${hash}`;
    // Append cache-buster only on retry rounds so browsers refetch
    src = nonce > 0 ? `${base}${base.includes('?') ? '&' : '?'}_r=${nonce}` : base;
  } else {
    src = originalUrl;
  }

  const onLoadFinal = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsLoading(false);
    if (hash) {
      setCachedGateway(hash, gwIdx);
      setCachedLoadedUrl(hash, src);
    }
  }, [hash, gwIdx, src]);

  return {
    src,
    onError,
    onLoad: onLoadFinal,
    isLoading: cachedLoadedUrl ? false : (enabled ? isLoading : true),
    failed,
  };
}
