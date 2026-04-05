import { useState, useEffect, useRef, useCallback } from 'react';
import { IPFS_GATEWAYS, extractIpfsHash, IMAGE_LOAD_TIMEOUT } from '@/lib/ipfsGateways';

// Module-level cache: maps IPFS hash → index of last successful gateway
const gatewayCache = new Map<string, number>();
// Global last-known-good gateway so new hashes skip dead gateways
let lastGoodGatewayIndex = 0;

export function getCachedGatewayIndex(hash: string | null): number {
  if (!hash) return lastGoodGatewayIndex;
  return gatewayCache.get(hash) ?? lastGoodGatewayIndex;
}

function setCachedGateway(hash: string, idx: number) {
  gatewayCache.set(hash, idx);
  lastGoodGatewayIndex = idx;
  // Keep cache bounded
  if (gatewayCache.size > 500) {
    const first = gatewayCache.keys().next().value;
    if (first) gatewayCache.delete(first);
  }
}

interface UseIpfsMediaOptions {
  /** Timeout in ms before trying next gateway */
  timeout?: number;
  /** Context for timeout config */
  context?: 'card' | 'detail';
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
  const { context = 'card' } = options;
  const baseTimeout = context === 'detail' ? IMAGE_LOAD_TIMEOUT.detail : IMAGE_LOAD_TIMEOUT.card;

  const hash = originalUrl ? extractIpfsHash(originalUrl) : null;
  const startIdx = getCachedGatewayIndex(hash);

  const [gwIdx, setGwIdx] = useState(startIdx);
  const [failed, setFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Reset state when URL changes
  useEffect(() => {
    const newStart = getCachedGatewayIndex(hash);
    setGwIdx(newStart);
    setFailed(false);
    setIsLoading(true);
  }, [originalUrl, hash]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Timeout-based fallback
  useEffect(() => {
    if (failed || !isLoading || !hash) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    const retryCount = gwIdx - startIdx;
    const timeout = Math.min(baseTimeout + retryCount * IMAGE_LOAD_TIMEOUT.increment, IMAGE_LOAD_TIMEOUT.max);

    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      advance();
    }, timeout);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gwIdx, isLoading, failed, hash, baseTimeout, startIdx]);

  const advance = useCallback(() => {
    if (gwIdx < IPFS_GATEWAYS.length - 1) {
      setGwIdx(prev => prev + 1);
    } else {
      setFailed(true);
      setIsLoading(false);
    }
  }, [gwIdx]);

  const onError = useCallback(() => {
    advance();
  }, [advance]);

  const onLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsLoading(false);
    if (hash) setCachedGateway(hash, gwIdx);
  }, [hash, gwIdx]);

  let src: string;
  if (failed || !originalUrl) {
    src = '/placeholder.svg';
  } else if (hash) {
    src = `${IPFS_GATEWAYS[gwIdx]}${hash}`;
  } else {
    src = originalUrl;
  }

  return { src, onError, onLoad, isLoading, failed };
}
