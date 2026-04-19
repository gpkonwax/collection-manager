import { useState, useEffect, useRef, useCallback } from 'react';
import { IPFS_GATEWAYS, extractIpfsHash, IMAGE_LOAD_TIMEOUT, DEFAULT_GATEWAY_INDEX } from '@/lib/ipfsGateways';

// Module-level cache: maps IPFS hash → index of last successful gateway for THAT hash.
// We intentionally do NOT track a global "last good gateway" anymore — that approach
// poisoned the whole session whenever a single image happened to succeed on a slower
// fallback gateway, biasing every new load toward a failing endpoint.
const gatewayCache = new Map<string, number>();

export function getCachedGatewayIndex(hash: string | null): number {
  if (!hash) return DEFAULT_GATEWAY_INDEX;
  return gatewayCache.get(hash) ?? DEFAULT_GATEWAY_INDEX;
}

function setCachedGateway(hash: string, idx: number) {
  gatewayCache.set(hash, idx);
  if (gatewayCache.size > 500) {
    const first = gatewayCache.keys().next().value;
    if (first) gatewayCache.delete(first);
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
  const startIdx = getCachedGatewayIndex(hash);

  const [gwIdx, setGwIdx] = useState(startIdx);
  const [triedCount, setTriedCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Reset state when URL changes
  useEffect(() => {
    const newStart = getCachedGatewayIndex(hash);
    setGwIdx(newStart);
    setTriedCount(0);
    setFailed(false);
    setIsLoading(true);
  }, [originalUrl, hash]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
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
    setTriedCount(prev => {
      const next = prev + 1;
      if (next >= IPFS_GATEWAYS.length) {
        setFailed(true);
        setIsLoading(false);
        return prev;
      }
      setGwIdx(g => (g + 1) % IPFS_GATEWAYS.length);
      return next;
    });
  }, []);

  const onError = useCallback(() => {
    advance();
  }, [advance]);

  const onLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsLoading(false);
    if (hash) setCachedGateway(hash, gwIdx);
  }, [hash, gwIdx]);

  let src: string;
  if (!enabled) {
    // Not visible yet — return placeholder, don't trigger any loading
    src = '/placeholder.svg';
  } else if (failed || !originalUrl) {
    src = '/placeholder.svg';
  } else if (hash) {
    src = `${IPFS_GATEWAYS[gwIdx]}${hash}`;
  } else {
    src = originalUrl;
  }

  return { src, onError, onLoad, isLoading: enabled ? isLoading : true, failed };
}
