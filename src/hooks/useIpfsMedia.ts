import { useState, useEffect, useRef, useCallback } from 'react';
import { IPFS_GATEWAYS, extractIpfsHash, IMAGE_LOAD_TIMEOUT } from '@/lib/ipfsGateways';
import { acquireSlot, releaseSlot, shardIndexForHash } from '@/lib/ipfsConcurrency';

// Module-level cache: maps IPFS hash → index of last successful gateway
const gatewayCache = new Map<string, number>();
// Global last-known-good gateway so new hashes skip dead gateways
let lastGoodGatewayIndex = 0;

export function getCachedGatewayIndex(hash: string | null): number {
  if (!hash) return lastGoodGatewayIndex;
  const cached = gatewayCache.get(hash);
  if (cached !== undefined) return cached;
  // Shard new hashes across all gateways instead of stampeding the last-good one
  return shardIndexForHash(hash, IPFS_GATEWAYS.length);
}

function setCachedGateway(hash: string, idx: number) {
  gatewayCache.set(hash, idx);
  lastGoodGatewayIndex = idx;
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
  /** True when ready to actually load (visible + concurrency slot held) */
  ready: boolean;
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
  const [hasSlot, setHasSlot] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const slotHeldRef = useRef(false);

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
    return () => {
      mountedRef.current = false;
      if (slotHeldRef.current) {
        releaseSlot();
        slotHeldRef.current = false;
      }
    };
  }, []);

  // Acquire a global concurrency slot before allowing the <img> to mount.
  // This caps how many IPFS requests are in flight at once across the page.
  useEffect(() => {
    if (!enabled || failed || !hash) {
      if (slotHeldRef.current) {
        releaseSlot();
        slotHeldRef.current = false;
        setHasSlot(false);
      }
      return;
    }
    if (slotHeldRef.current) return;
    let cancelled = false;
    acquireSlot().then(() => {
      if (cancelled || !mountedRef.current) {
        releaseSlot();
        return;
      }
      slotHeldRef.current = true;
      setHasSlot(true);
    });
    return () => { cancelled = true; };
  }, [enabled, failed, hash]);

  // Timeout-based fallback — only when enabled and we hold a slot (i.e., actually loading)
  useEffect(() => {
    if (!enabled || failed || !isLoading || !hash || !hasSlot) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    const timeout = Math.min(baseTimeout + triedCount * IMAGE_LOAD_TIMEOUT.increment, IMAGE_LOAD_TIMEOUT.max);

    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      advance();
    }, timeout);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gwIdx, isLoading, failed, hash, baseTimeout, triedCount, enabled, hasSlot]);

  const advance = useCallback(() => {
    if (triedCount + 1 >= IPFS_GATEWAYS.length) {
      setFailed(true);
      setIsLoading(false);
    } else {
      setTriedCount(prev => prev + 1);
      setGwIdx(prev => (prev + 1) % IPFS_GATEWAYS.length);
    }
  }, [triedCount]);

  const onError = useCallback(() => {
    advance();
  }, [advance]);

  const onLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsLoading(false);
    if (hash) setCachedGateway(hash, gwIdx);
    if (slotHeldRef.current) {
      releaseSlot();
      slotHeldRef.current = false;
      setHasSlot(false);
    }
  }, [hash, gwIdx]);

  // When we exhaust gateways and fail, also release the slot
  useEffect(() => {
    if (failed && slotHeldRef.current) {
      releaseSlot();
      slotHeldRef.current = false;
      setHasSlot(false);
    }
  }, [failed]);

  const ready = enabled && (hasSlot || failed || !hash);

  let src: string;
  if (!enabled) {
    src = '/placeholder.svg';
  } else if (failed || !originalUrl) {
    src = '/placeholder.svg';
  } else if (hash) {
    src = `${IPFS_GATEWAYS[gwIdx]}${hash}`;
  } else {
    src = originalUrl;
  }

  return { src, onError, onLoad, isLoading: enabled ? isLoading : true, failed, ready };
}
