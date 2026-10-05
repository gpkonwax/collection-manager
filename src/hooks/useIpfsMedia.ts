import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { IPFS_GATEWAYS, extractIpfsHash, IMAGE_LOAD_TIMEOUT, RACE_GATEWAY_COUNT, RACE_TIMEOUT_MS, PRIMARY_MIRROR, BACKUP_MIRROR_A, BACKUP_MIRROR_B, getPublicGatewayCount } from '@/lib/ipfsGateways';
import {
  acquireLocalMirror,
  getLocalMirrorGeneration,
  hasLocalMirrorEntry,
  releaseLocalMirror,
  resolveLocalMirror,
  subscribeLocalMirror,
} from '@/lib/localMirror';
import { fetchVerifiedMirrorFile, getRemoteMirrorState, subscribeRemoteMirror, MIRRORS, loadMirrorPathMap, isMirrorPathMapReady, getMirrorPath } from '@/lib/remoteMirror';
import { peekThumb, getThumb, putThumb, isKnownThumbMiss } from '@/lib/thumbCache';

// Module-level cache: maps IPFS hash → index of last successful gateway
const gatewayCache = new Map<string, number>();
// Module-level cache: maps IPFS hash → exact URL that successfully loaded
const loadedUrlCache = new Map<string, string>();
// Global last-known-good gateway so new hashes skip dead gateways
let lastGoodGatewayIndex = 0;

// ---- persistence: keep the hash → known-good URL map across reloads --------
const PERSIST_KEY = 'gpk-ipfs-url-cache-v1';
const PERSIST_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PERSIST_MAX = 3000;

interface PersistedCache {
  savedAt: number;
  entries: Array<[string, string, number]>; // [hash, url, gatewayIndex]
}

function hydratePersistedCache() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedCache;
    if (!parsed?.entries || !Array.isArray(parsed.entries)) return;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > PERSIST_TTL_MS) {
      localStorage.removeItem(PERSIST_KEY);
      return;
    }
    for (const entry of parsed.entries) {
      if (!Array.isArray(entry)) continue;
      const [hash, url, idx] = entry;
      if (typeof hash !== 'string' || typeof url !== 'string') continue;
      if (url.startsWith('blob:') || url.startsWith('data:')) continue;
      loadedUrlCache.set(hash, url);
      if (typeof idx === 'number' && idx >= 0) gatewayCache.set(hash, idx);
    }
  } catch {
    /* ignore corrupt/unavailable storage */
  }
}
hydratePersistedCache();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const entries: Array<[string, string, number]> = [];
      const all = Array.from(loadedUrlCache.entries());
      const slice = all.slice(Math.max(0, all.length - PERSIST_MAX));
      for (const [hash, url] of slice) {
        if (url.startsWith('blob:') || url.startsWith('data:')) continue;
        entries.push([hash, url, gatewayCache.get(hash) ?? 0]);
      }
      localStorage.setItem(PERSIST_KEY, JSON.stringify({ savedAt: Date.now(), entries } satisfies PersistedCache));
    } catch {
      /* quota or unavailable — cache stays in-memory only */
    }
  }, 2000);
}

/** Wipe both the in-memory and persisted known-good URL maps. */
export function clearIpfsUrlCache() {
  loadedUrlCache.clear();
  gatewayCache.clear();
  lastGoodGatewayIndex = 0;
  try { localStorage.removeItem(PERSIST_KEY); } catch { /* noop */ }
}


// ---- mirror-first session state -----------------------------------------
// Every image tries our own static mirrors first (primary → backup A →
// backup B); public IPFS gateways are only the fallback.
const MIRROR_CHAIN = [PRIMARY_MIRROR, BACKUP_MIRROR_A, BACKUP_MIRROR_B].filter(Boolean);
// Hashes every mirror answered with an error (not in the snapshot) this session.
const mirrorMissSet = new Set<string>();
// Only real errors from the whole chain count — a slow, busy page of images
// queueing behind each other must never lock the mirrors out.
const MIRROR_DOWN_THRESHOLD = 25;
// Generous per-mirror timeout: mirrors are reliable, so a timeout usually
// means the browser is queueing many images, not that the mirror is down.
const MIRROR_FIRST_TIMEOUT_MS = 8000;
let mirrorConsecutiveFailures = 0;
let mirrorDown = false;

// ---- adaptive gateway health -------------------------------------------
// Public IPFS gateways degrade gracelessly: some images load, some hang.
// We score failures so that, once the network is clearly laggy, new card
// images go straight to our own mirror instead of paying the timeout tax.
//
// The score must never latch: once the session flips to mirror-first, almost
// no gateway attempts happen any more, so without decay + re-probing +
// expiry the app can never notice IPFS recovering.
/** Failure score at which the whole session is considered "IPFS degraded". */
const DEGRADED_THRESHOLD = 6;
const DEGRADED_SCORE_MAX = DEGRADED_THRESHOLD * 2;
/** Degraded mode auto-expires so a bad minute never poisons a whole session. */
const DEGRADED_TTL_MS = 90_000;
/** While degraded, every Nth card image still tries a gateway first (re-probe). */
const DEGRADED_PROBE_EVERY = 6;
/**
 * Gateways that are structurally slower than the card timeout. Their timeouts
 * say nothing about IPFS health, so they must not feed the degraded score.
 */
const SLOW_GATEWAY_HOSTS = ['gateway.pinata.cloud'];

let gatewayFailureScore = 0;
let degradedSince = 0;

function isSlowGateway(url: string | undefined): boolean {
  if (!url) return false;
  return SLOW_GATEWAY_HOSTS.some((host) => url.includes(host));
}

function noteGatewayFailure(gatewayUrl?: string) {
  // A guaranteed-slow gateway timing out is a false signal — ignore it.
  if (isSlowGateway(gatewayUrl)) return;
  gatewayFailureScore = Math.min(gatewayFailureScore + 1, DEGRADED_SCORE_MAX);
  if (gatewayFailureScore >= DEGRADED_THRESHOLD && !degradedSince) {
    degradedSince = Date.now();
  }
}

function clearDegraded() {
  gatewayFailureScore = 0;
  degradedSince = 0;
}

function noteGatewaySuccess() {
  // Successes decay faster than failures accumulate so the app drifts back to
  // public gateways as soon as IPFS recovers.
  gatewayFailureScore = Math.max(0, gatewayFailureScore - 2);
  if (gatewayFailureScore < DEGRADED_THRESHOLD) degradedSince = 0;
}

/**
 * A mirror hit also decays the score (more slowly than a gateway success).
 * Without this the score can only ever go up once mirror-first kicks in,
 * because gateways stop being attempted at all.
 */
function noteMirrorServed() {
  gatewayFailureScore = Math.max(0, gatewayFailureScore - 1);
  if (gatewayFailureScore < DEGRADED_THRESHOLD) degradedSince = 0;
}

/** True when recent gateway attempts have been failing often enough to bypass them. */
export function isIpfsDegraded(): boolean {
  if (gatewayFailureScore < DEGRADED_THRESHOLD) return false;
  if (degradedSince && Date.now() - degradedSince > DEGRADED_TTL_MS) {
    // Time-boxed: let the session measure the network again instead of
    // assuming IPFS is still broken.
    clearDegraded();
    return false;
  }
  return true;
}

/**
 * While degraded, a deterministic slice of hashes still takes the normal
 * gateway path so a recovery can actually be observed. Hash-based (not a
 * counter) so the answer is stable across re-renders of the same image.
 */
function shouldMirrorFirstWhileDegraded(hash: string): boolean {
  let sum = 0;
  for (let i = 0; i < hash.length; i++) sum = (sum + hash.charCodeAt(i)) % 100000;
  return sum % DEGRADED_PROBE_EVERY !== 0;
}


/** Test helper: reset all session-level mirror/gateway health state. */
export function resetIpfsHealthState() {
  gatewayFailureScore = 0;
  degradedSince = 0;
  mirrorMissSet.clear();
  mirrorConsecutiveFailures = 0;
  mirrorDown = false;
}

function noteMirrorMiss(hash: string) {
  mirrorMissSet.add(hash);
  mirrorConsecutiveFailures += 1;
  if (mirrorConsecutiveFailures >= MIRROR_DOWN_THRESHOLD) mirrorDown = true;
}

function noteMirrorHit() {
  mirrorConsecutiveFailures = 0;
  noteMirrorServed();
}



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
  if (gatewayCache.size > LOADED_CACHE_MAX) {
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
  schedulePersist();
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
  /**
   * Opt-in: try the primary static mirror first (short timeout) before falling
   * back to the normal public-gateway rotation. Used by Pack History thumbnails.
   */
  mirrorFirst?: boolean;
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
  const { context = 'card', enabled = true, mirrorFirst = false } = options;
  const baseTimeout = context === 'detail' ? IMAGE_LOAD_TIMEOUT.detail : IMAGE_LOAD_TIMEOUT.card;


  const hash = originalUrl ? extractIpfsHash(originalUrl) : null;
  // Mirror files may live under a different path (e.g. atomic/<cid>.jpg); wait for the map.
  const [pathsReady, setPathsReady] = useState(isMirrorPathMapReady);
  useEffect(() => {
    if (pathsReady) return;
    let alive = true;
    loadMirrorPathMap().then(() => { if (alive) setPathsReady(true); });
    return () => { alive = false; };
  }, [pathsReady]);

  // Every completed ZIP batch increments this generation. Unlike the old 0/1
  // snapshot, parts loaded after the first one always wake previously-failed cards.
  const localGeneration = useSyncExternalStore(subscribeLocalMirror, getLocalMirrorGeneration, () => 0);
  const cachedLocalUrl = hash ? resolveLocalMirror(hash) : null;
  const localEntryPresent = hasLocalMirrorEntry(hash);
  const [extractedLocalUrl, setExtractedLocalUrl] = useState<string | null>(cachedLocalUrl);
  const [localPending, setLocalPending] = useState(localEntryPresent && !cachedLocalUrl);
  const [localExtractFailed, setLocalExtractFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let acquired = false;
    setLocalExtractFailed(false);
    const immediate = hash ? resolveLocalMirror(hash) : null;
    setExtractedLocalUrl(immediate);
    if (!hash || !hasLocalMirrorEntry(hash) || !enabled) {
      setLocalPending(false);
      return;
    }
    setLocalPending(!immediate);
    acquireLocalMirror(hash).then((url) => {
      acquired = !!url;
      if (cancelled) {
        if (acquired) releaseLocalMirror(hash);
        return;
      }
      setExtractedLocalUrl(url);
      setLocalPending(false);
    }).catch((error) => {
      console.error('[useIpfsMedia] local ZIP extraction failed', error);
      if (!cancelled) {
        setLocalExtractFailed(true);
        setLocalPending(false);
      }
    });
    return () => {
      cancelled = true;
      if (acquired) releaseLocalMirror(hash);
    };
  }, [hash, localGeneration, enabled]);

  const localMirrorUrl = extractedLocalUrl ?? cachedLocalUrl;

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
    const cfg = MIRRORS.find((m) => m.key === activeMirror);
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
  }, [activeMirror, hash]);

  // Byte-level thumbnail cache (Cache Storage). Opt-in alongside mirrorFirst so
  // Pack History thumbnails repaint instantly across dialog opens and reloads.
  const [thumbBlobUrl, setThumbBlobUrl] = useState<string | null>(() =>
    mirrorFirst ? peekThumb(hash) : null
  );

  useEffect(() => {
    if (!mirrorFirst || !hash) {
      setThumbBlobUrl(null);
      return;
    }
    const immediate = peekThumb(hash);
    if (immediate) {
      setThumbBlobUrl(immediate);
      return;
    }
    setThumbBlobUrl(null);
    if (isKnownThumbMiss(hash)) return;
    let cancelled = false;
    getThumb(hash).then((url) => {
      if (cancelled || !url) return;
      setThumbBlobUrl(url);
    });
    return () => { cancelled = true; };
  }, [mirrorFirst, hash]);

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

  // Mirror-first phase: true while we're walking our own static mirrors
  // (primary → backup A → backup B). Public gateways only run afterwards.
  const mirrorEligible = (h: string | null) =>
    !!h && MIRROR_CHAIN.length > 0 && !mirrorDown && !mirrorMissSet.has(h)
    && !getCachedLoadedUrl(h) && !peekThumb(h);
  const canTryMirror = (h: string | null) => mirrorEligible(h);

  const [mirrorPhase, setMirrorPhase] = useState(() => canTryMirror(hash));
  // Which mirror in MIRROR_CHAIN is being attempted.
  const [mirrorStep, setMirrorStep] = useState(0);
  // True once any mirror in the chain merely timed out (vs. answered an error).
  const mirrorTimedOutRef = useRef(false);

  // Reset state when URL or active mirror changes
  useEffect(() => {
    const newCached = getCachedLoadedUrl(hash);
    const newStart = getCachedGatewayIndex(hash);
    setGwIdx(newStart);
    setTriedCount(0);
    setRetryRound(0);
    setFailed(false);
    setIsLoading(!newCached);
    setNonce(0);
    setVerifiedMirrorUrl(null);
    setMirrorPhase(canTryMirror(hash));
    setMirrorStep(0);
    mirrorTimedOutRef.current = false;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalUrl, hash, activeMirror, mirrorFirst]);

  // Move to the next mirror, or hand over to public gateways after the last one.
  const nextMirror = useCallback((timedOut: boolean) => {
    if (timedOut) mirrorTimedOutRef.current = true;
    attemptRef.current += 1;
    if (mirrorStep + 1 < MIRROR_CHAIN.length) {
      setMirrorStep(mirrorStep + 1);
      return;
    }
    // Only remember a miss when every mirror actually answered "not found";
    // timeouts from a busy page must not lock the mirrors out.
    if (hash && !mirrorTimedOutRef.current) noteMirrorMiss(hash);
    setMirrorPhase(false);
  }, [hash, mirrorStep]);

  // Per-mirror timeout.
  useEffect(() => {
    if (!mirrorPhase || !pathsReady || !enabled || !hash || hasLoadedRef.current) return;
    if (thumbBlobUrl) return; // served from the byte cache — no mirror miss
    const myAttempt = attemptRef.current;
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      if (myAttempt !== attemptRef.current) return;
      if (hasLoadedRef.current) return;
      nextMirror(true);
    }, MIRROR_FIRST_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [mirrorPhase, pathsReady, mirrorStep, enabled, hash, nextMirror, thumbBlobUrl]);


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
    if (mirrorPhase) return; // gateways only race after every mirror missed
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
  }, [hash, enabled, context, mirrorPhase]);

  // Timeout-based fallback — only when enabled and not yet loaded
  useEffect(() => {
    if (mirrorPhase) return; // the mirror attempt runs its own short timer
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
  }, [gwIdx, isLoading, failed, hash, baseTimeout, triedCount, enabled, mirrorPhase]);


  const advance = useCallback(() => {
    // Don't rotate if we've already successfully loaded this hash
    if (hasLoadedRef.current) return;
    // A gateway attempt just failed/timed out — feed the health score.
    // Structurally slow gateways (Pinata) are excluded inside the helper.
    noteGatewayFailure(IPFS_GATEWAYS[gwIdx % IPFS_GATEWAYS.length]);

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
  }, [triedCount, retryRound, gwIdx]);

  const onError = useCallback(() => {
    // Ignore errors once we've already loaded successfully (sticky URL)
    if (hasLoadedRef.current) return;
    if (!enabled) return; // ignore cancellations from being disabled
    if (mirrorPhase) {
      // This mirror doesn't have the file — try the next mirror, then gateways.
      nextMirror(false);
      return;
    }
    advance();
  }, [advance, enabled, mirrorPhase, nextMirror]);

  const usingMirrorFirst = mirrorPhase && enabled && !!hash && !verifiedMirrorUrl && !localMirrorUrl && !cachedLoadedUrl && !thumbBlobUrl;

  let src: string;
  if (verifiedMirrorUrl) {
    // Active backup mirror with a hash-verified file — use it in preference to gateways.
    src = verifiedMirrorUrl;
  } else if (localMirrorUrl) {
    // Local ZIP mirror hit — bypass every gateway attempt, fully offline.
    src = localMirrorUrl;
  } else if (thumbBlobUrl) {
    // Byte cache hit (Cache Storage) — instant, no network at all.
    src = thumbBlobUrl;
  } else if (cachedLoadedUrl) {
    // Already successfully loaded once — reuse the exact known-good URL (browser HTTP cache will serve it)
    src = cachedLoadedUrl;
  } else if (localPending) {
    // The ZIP index has this exact image. Wait for local extraction and never
    // leak into network fallbacks while the fully-offline source is pending.
    src = '/placeholder.svg';
  } else if (localExtractFailed) {
    // A known local entry failed CRC/decompression. Keep the failure local and
    // visible rather than disguising it as an IPFS outage.
    src = '/placeholder.svg';
  } else if (!enabled) {
    // Not visible yet — return placeholder, don't trigger any loading
    src = '/placeholder.svg';
  } else if (failed || !originalUrl) {
    src = '/placeholder.svg';
  } else if (usingMirrorFirst && hash && !pathsReady) {
    src = '/placeholder.svg';
  } else if (usingMirrorFirst && hash) {
    // Mirror-first: our own static mirrors before any public gateway.
    src = `${MIRROR_CHAIN[Math.min(mirrorStep, MIRROR_CHAIN.length - 1)]}${getMirrorPath(hash)}`;
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
      if (usingMirrorFirst) {
        // Mirror served it — remember the exact URL, and record the mirror's slot
        // in the rotation so a later miss resumes from the public gateways.
        noteMirrorHit();
        setCachedLoadedUrl(hash, src);
        gatewayCache.set(hash, getPublicGatewayCount() % IPFS_GATEWAYS.length);
        // Persist the bytes only for opt-in consumers (Pack History).
        if (mirrorFirst) void putThumb(hash, src);
      } else {
        // A public gateway served it — the network is healthy-ish again.
        noteGatewaySuccess();
        setCachedGateway(hash, gwIdx);
        setCachedLoadedUrl(hash, src);
        // Only mirrorFirst consumers (Pack History) opt into the byte cache.
        if (mirrorFirst) void putThumb(hash, src);
      }

    }
  }, [hash, gwIdx, src, usingMirrorFirst, mirrorFirst]);


  return {
    src,
    onError,
    onLoad: onLoadFinal,
    isLoading: localPending ? true : (verifiedMirrorUrl || localMirrorUrl || thumbBlobUrl || cachedLoadedUrl || hasLoadedRef.current ? false : (enabled ? isLoading : true)),
    failed: localExtractFailed || (verifiedMirrorUrl || localMirrorUrl || thumbBlobUrl || hasLoadedRef.current ? false : failed),
  };
}
