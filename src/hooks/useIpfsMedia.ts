import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { IPFS_GATEWAYS, extractIpfsHash, IMAGE_LOAD_TIMEOUT, RACE_GATEWAY_COUNT, RACE_TIMEOUT_MS } from '@/lib/ipfsGateways';
import { resolveLocalMirror, subscribeLocalMirror, hasLocalMirror } from '@/lib/localMirror';
import { fetchVerifiedMirrorFile, getRemoteMirrorState, subscribeRemoteMirror, type MirrorKey } from '@/lib/remoteMirror';

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

/**
 * Race the first N gateways in parallel for a given hash.
 * Resolves with the winning gateway index (relative to IPFS_GATEWAYS) as soon
 * as one Image finishes loading, or null if all N time out / error.
 * Winning URL is also written to the module caches so subsequent renders
 * short-circuit immediately.
 */
export function raceGateways(
  hash: string,
  startIdx = 0,
  count = RACE_GATEWAY_COUNT,
  perTimeoutMs = RACE_TIMEOUT_MS,
): Promise<{ url: string; gwIdx: number } | null> {
  // Already cached — resolve synchronously.
  const cached = loadedUrlCache.get(hash);
  if (cached) {
    return Promise.resolve({ url: cached, gwIdx: gatewayCache.get(hash) ?? 0 });
  }

  const total = Math.min(count, IPFS_GATEWAYS.length);
  return new Promise((resolve) => {
    let settled = false;
    let losses = 0;
    const images: HTMLImageElement[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const cleanup = () => {
      timers.forEach(clearTimeout);
      images.forEach((img) => {
        img.onload = null;
        img.onerror = null;
        // Detach src so the browser can cancel in-flight requests we didn't win.
        try { img.src = ''; } catch { /* noop */ }
      });
    };

    const win = (idx: number, url: string) => {
      if (settled) return;
      settled = true;
      setCachedGateway(hash, idx);
      setCachedLoadedUrl(hash, url);
      cleanup();
      resolve({ url, gwIdx: idx });
    };

    const lose = () => {
      if (settled) return;
      losses += 1;
      if (losses >= total) {
        settled = true;
        cleanup();
        resolve(null);
      }
    };

    for (let i = 0; i < total; i++) {
      const gwIdx = (startIdx + i) % IPFS_GATEWAYS.length;
      const url = `${IPFS_GATEWAYS[gwIdx]}${hash}`;
      const img = new Image();
      images.push(img);
      img.onload = () => win(gwIdx, url);
      img.onerror = () => lose();
      timers.push(setTimeout(() => lose(), perTimeoutMs));
      img.src = url;
    }
  });
}

/**
 * Fire-and-forget prefetch of an IPFS URL using the parallel race.
 * Safe to call for many items; no-op when the hash is already cached.
 */
export function prefetchIpfsImage(rawUrl: string | undefined): void {
  if (!rawUrl) return;
  const hash = extractIpfsHash(rawUrl);
  if (!hash) return;
  if (loadedUrlCache.has(hash)) return;
  const startIdx = gatewayCache.get(hash) ?? lastGoodGatewayIndex;
  // Errors are swallowed intentionally — prefetch is best-effort.
  raceGateways(hash, startIdx).catch(() => {});
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

  // Subscribe to local mirror so newly-ingested ZIPs cause mounted images
  // to re-render and pick up their blob: URL without needing a page reload.
  useSyncExternalStore(subscribeLocalMirror, () => (hasLocalMirror() ? 1 : 0), () => 0);
  const localMirrorUrl = hash ? resolveLocalMirror(hash) : null;

  // Subscribe to the manually-selected remote mirror. If a backup mirror is active,
  // fetch and verify the file from that mirror before falling back to gateways.
  const remoteState = useSyncExternalStore(subscribeRemoteMirror, getRemoteMirrorState, getRemoteMirrorState);
  const activeMirror = remoteState.active;
  const [verifiedMirrorUrl, setVerifiedMirrorUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMirror || !hash) {
      setVerifiedMirrorUrl(null);
      return;
    }
    const cfg = remoteState.mirrors.find((m: { key: MirrorKey; url: string }) => m.key === activeMirror);
    if (!cfg?.url) {
      setVerifiedMirrorUrl(null);
      return;
    }
    let cancelled = false;
    fetchVerifiedMirrorFile(hash, cfg.url).then((url) => {
      if (cancelled) return;
      setVerifiedMirrorUrl(url);
    });
    return () => { cancelled = true; };
  }, [activeMirror, hash, remoteState.mirrors]);

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
  // Track the active attempt; stale onError/timeouts are ignored
  const attemptRef = useRef(0);
  // Track whether this hash has ever successfully rendered in this hook instance
  const hasLoadedRef = useRef(!!cachedLoadedUrl);

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
    hasLoadedRef.current = !!newCached;
    attemptRef.current += 1;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [originalUrl, hash]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Stop all timers when disabled or already loaded
  useEffect(() => {
    if (!enabled || hasLoadedRef.current || cachedLoadedUrl) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    }
  }, [enabled, cachedLoadedUrl]);

  // Parallel gateway race for detail context — dramatically cuts back-of-card load time.
  const raceDoneRef = useRef(context !== 'detail');
  useEffect(() => {
    if (context !== 'detail') { raceDoneRef.current = true; return; }
    raceDoneRef.current = false;
    if (!enabled || !hash || cachedLoadedUrl || hasLoadedRef.current) {
      raceDoneRef.current = true;
      return;
    }
    const myAttempt = attemptRef.current;
    let cancelled = false;
    raceGateways(hash, startIdx).then((result) => {
      if (cancelled || !mountedRef.current) return;
      if (myAttempt !== attemptRef.current) return;
      raceDoneRef.current = true;
      if (result) {
        // Cache is already primed by raceGateways; nudge state so <img> renders the winning URL.
        setGwIdx(result.gwIdx);
        setNonce((n) => n + 1);
      } else {
        // All raced gateways lost — advance past them so sequential rotation resumes with fresh ones.
        setTriedCount((t) => Math.max(t, RACE_GATEWAY_COUNT));
        setGwIdx((prev) => (prev + RACE_GATEWAY_COUNT) % IPFS_GATEWAYS.length);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, enabled, context]);

  // Timeout-based fallback — only when enabled and not yet loaded
  useEffect(() => {
    if (!enabled || failed || !isLoading || !hash) return;
    // For detail context, defer the serial timer until the parallel race resolves —
    // otherwise it would rotate gwIdx mid-race and waste attempts.
    if (context === 'detail' && !raceDoneRef.current) return;
    if (hasLoadedRef.current) return; // sticky: already loaded once
    if (timerRef.current) clearTimeout(timerRef.current);

    const timeout = Math.min(baseTimeout + triedCount * IMAGE_LOAD_TIMEOUT.increment, IMAGE_LOAD_TIMEOUT.max);
    const myAttempt = attemptRef.current;

    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      if (myAttempt !== attemptRef.current) return; // stale timer
      advance();
    }, timeout);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gwIdx, isLoading, failed, hash, baseTimeout, triedCount, enabled]);

  const advance = useCallback(() => {
    // Don't rotate if we've already successfully loaded this hash
    if (hasLoadedRef.current) return;
    attemptRef.current += 1;
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
        if (hasLoadedRef.current) return;
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
    // Ignore errors once we've already loaded successfully (sticky URL)
    if (hasLoadedRef.current) return;
    if (!enabled) return; // ignore cancellations from being disabled
    advance();
  }, [advance, enabled]);

  let src: string;
  if (localMirrorUrl) {
    // Local ZIP mirror hit — bypass every gateway attempt, fully offline.
    src = localMirrorUrl;
  } else if (cachedLoadedUrl) {
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
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    hasLoadedRef.current = true;
    setIsLoading(false);
    setFailed(false);
    if (hash && !src.startsWith('blob:')) {
      setCachedGateway(hash, gwIdx);
      setCachedLoadedUrl(hash, src);
    }
  }, [hash, gwIdx, src]);

  return {
    src,
    onError,
    onLoad: onLoadFinal,
    isLoading: localMirrorUrl || cachedLoadedUrl || hasLoadedRef.current ? false : (enabled ? isLoading : true),
    failed: localMirrorUrl || hasLoadedRef.current ? false : failed,
  };
}
