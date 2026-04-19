import { useState, useEffect, useRef, useCallback } from 'react';
import { IPFS_GATEWAYS, extractIpfsHash, IMAGE_LOAD_TIMEOUT, MAX_GATEWAY_ATTEMPTS } from '@/lib/ipfsGateways';
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
  /** Manually retry from scratch */
  retry: () => void;
  /** Number of automatic retry cycles attempted while mounted */
  retryCycle: number;
}

// Backoff schedule (ms) for automatic retries while mounted.
const AUTO_RETRY_BACKOFF = [4_000, 10_000, 30_000, 60_000];

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
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [retryCycle, setRetryCycle] = useState(0);
  // Last successfully loaded src (preserved across re-fetch misses)
  const [lastGoodSrc, setLastGoodSrc] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const slotHeldRef = useRef(false);
  const prevUrlRef = useRef<string | undefined>(originalUrl);

  // Reset state ONLY when the URL actually changes (not on every render).
  useEffect(() => {
    if (prevUrlRef.current === originalUrl) return;
    prevUrlRef.current = originalUrl;
    const newStart = getCachedGatewayIndex(hash);
    setGwIdx(newStart);
    setTriedCount(0);
    setFailed(false);
    setIsLoading(true);
    setHasLoadedOnce(false);
    setRetryCycle(0);
    setLastGoodSrc(null);
  }, [originalUrl, hash]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (slotHeldRef.current) {
        releaseSlot();
        slotHeldRef.current = false;
      }
      if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Acquire a global concurrency slot before allowing the <img> to mount.
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
  }, [enabled, failed, hash, retryCycle]);

  // Timeout-based fallback — only when enabled and we hold a slot
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

  const startAutoRetry = useCallback(() => {
    if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
    const delay = AUTO_RETRY_BACKOFF[Math.min(retryCycle, AUTO_RETRY_BACKOFF.length - 1)];
    autoRetryTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      // Reset gateway sweep but keep retryCycle counter for backoff and lastGoodSrc preserved.
      const restartIdx = getCachedGatewayIndex(hash);
      setGwIdx(restartIdx);
      setTriedCount(0);
      setFailed(false);
      setIsLoading(true);
      setRetryCycle((c) => c + 1);
    }, delay);
  }, [hash, retryCycle]);

  const maxAttempts = context === 'detail' ? MAX_GATEWAY_ATTEMPTS.detail : MAX_GATEWAY_ATTEMPTS.card;

  const advance = useCallback(() => {
    if (triedCount + 1 >= maxAttempts) {
      // Exhausted this sweep — mark failed and schedule auto-retry while mounted.
      setFailed(true);
      setIsLoading(false);
      startAutoRetry();
    } else {
      setTriedCount(prev => prev + 1);
      setGwIdx(prev => (prev + 1) % IPFS_GATEWAYS.length);
    }
  }, [triedCount, startAutoRetry, maxAttempts]);

  const onError = useCallback(() => {
    advance();
  }, [advance]);

  const onLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsLoading(false);
    setHasLoadedOnce(true);
    if (hash) setCachedGateway(hash, gwIdx);
    if (originalUrl && hash) {
      setLastGoodSrc(`${IPFS_GATEWAYS[gwIdx]}${hash}`);
    } else if (originalUrl) {
      setLastGoodSrc(originalUrl);
    }
    // Release slot — image is decoded and cached by the browser; no more network needed.
    if (slotHeldRef.current) {
      releaseSlot();
      slotHeldRef.current = false;
    }
  }, [hash, gwIdx, originalUrl]);

  // Release slot on failure too
  useEffect(() => {
    if (failed && slotHeldRef.current) {
      releaseSlot();
      slotHeldRef.current = false;
    }
  }, [failed]);

  const retry = useCallback(() => {
    if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
    const restartIdx = getCachedGatewayIndex(hash);
    setGwIdx(restartIdx);
    setTriedCount(0);
    setFailed(false);
    setIsLoading(true);
    setRetryCycle((c) => c + 1);
  }, [hash]);

  // Once loaded, stay rendered. Otherwise need both enabled + slot held.
  const ready = enabled && (hasLoadedOnce || hasSlot || failed || !hash);

  const FALLBACK = `${import.meta.env.BASE_URL}card-fallback.svg`;
  let src: string;
  if (!enabled) {
    src = lastGoodSrc || FALLBACK;
  } else if (failed || !originalUrl) {
    // Preserve previously loaded art instead of swapping to placeholder
    src = lastGoodSrc || FALLBACK;
  } else if (hash) {
    src = `${IPFS_GATEWAYS[gwIdx]}${hash}`;
  } else {
    src = originalUrl;
  }

  return { src, onError, onLoad, isLoading: enabled ? isLoading : true, failed, ready, retry, retryCycle };
}
