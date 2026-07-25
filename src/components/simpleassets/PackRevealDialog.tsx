import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Download } from 'lucide-react';
import { playCardRevealSound } from '@/lib/fartSounds';
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { buildGpkCardImageUrl, getGpkCategoryForBoxtype, normalizePendingGpkCardId } from '@/lib/gpkCardImages';
import { BACKUP_MIRROR_A, BACKUP_MIRROR_B, PRIMARY_MIRROR, PUBLIC_IPFS_GATEWAYS, extractIpfsHash } from '@/lib/ipfsGateways';
import { resolveLocalMirror } from '@/lib/localMirror';
import { loadPinnedManifest } from '@/lib/remoteMirror';
import { Session } from '@wharfkit/session';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { usePackRevealAudio } from '@/hooks/usePackRevealAudio';
import { normalizeGpkVariant } from '@/lib/gpkVariant';
import type { RevealResult } from '@/lib/packReveal';

const EXPECTED_CARDS: Record<string, number> = {
  GPKFIVE: 5, GPKMEGA: 30, GPKTWOA: 8, GPKTWOB: 25, GPKTWOC: 35,
  EXOFIVE: 5, EXOMEGA: 25,
};

const SYMBOL_TO_BOXTYPE: Record<string, string> = {
  GPKFIVE: 'five', GPKMEGA: 'thirty',
  GPKTWOA: 'gpktwoeight', GPKTWOB: 'gpktwo25', GPKTWOC: 'gpktwo55',
  EXOFIVE: 'exotic5', EXOMEGA: 'exotic25',
};

export interface RevealCard {
  asset_id: string;
  name: string;
  image: string | null;
  originalImage?: string | null;
  rarity: string;
}

interface PendingNftRow {
  id: number;
  unboxingid: number;
  draw: number;
  boxtype: string;
  user: string;
  variant: string;
  quality: string;
  done: number;
  cardid: number;
}

interface PackRevealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packSymbol: string;
  packLabel: string;
  packImage?: string;
  accountName: string;
  preOpenUnboxingIds: Set<number>;
  onComplete: (txId?: string | null, reveal?: RevealResult) => void;
  onDemoCollect?: () => void;
  demoCards?: RevealCard[];
  session?: Session | null;
}

function RevealCardImage({ card, isRevealed, packImage }: { card: RevealCard; isRevealed: boolean; packImage?: string }) {
  const [gwIdx, setGwIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [fallbacks, setFallbacks] = useState<string[]>(() => buildRevealImageCandidates(card.originalImage ?? card.image, card.image));
  const currentSrc = fallbacks[gwIdx] ?? null;

  useEffect(() => {
    let cancelled = false;
    const baseUrl = card.originalImage ?? card.image;
    setGwIdx(0);
    setLoaded(false);
    setFallbacks(buildRevealImageCandidates(baseUrl, card.image));
    loadPinnedManifest().then((manifest) => {
      if (cancelled) return;
      setFallbacks(buildRevealImageCandidates(baseUrl, card.image, manifest));
    });
    return () => { cancelled = true; };
  }, [card.image, card.originalImage]);

  // Hang-swap: if the current gateway hasn't fired load or error within 4s,
  // rotate to the next one so a silently-stalled request doesn't leave a blank
  // tile mid-reveal.
  useEffect(() => {
    if (!currentSrc || loaded) return;
    const t = setTimeout(() => {
      setGwIdx((g) => (g < fallbacks.length - 1 ? g + 1 : g));
    }, 3500);
    return () => clearTimeout(t);
  }, [currentSrc, loaded, gwIdx, fallbacks.length]);

  return (
    <div className="relative aspect-[2/3]"
      style={{ transformStyle: 'preserve-3d', transition: 'transform 0.6s ease-out', transform: isRevealed ? 'rotateY(0deg)' : 'rotateY(180deg)' }}>
      <div className="absolute inset-0 border border-border bg-transparent shadow-md" style={{ backfaceVisibility: 'hidden' }}>
        {currentSrc ? (
          <img src={currentSrc} alt={card.name} className="w-full h-full object-contain object-center"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onLoad={() => setLoaded(true)}
            onError={() => { setLoaded(false); setGwIdx((g) => (g < fallbacks.length - 1 ? g + 1 : g)); }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-2xl">🃏</div>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center shadow-md border border-zinc-700/50 rounded-sm"
        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
        {packImage ? (
          <img src={packImage} alt="card back" className="w-3/4 h-3/4 object-contain opacity-15" style={{ filter: 'grayscale(1) contrast(1.5) brightness(0.8)' }} />
        ) : (
          <span className="text-4xl opacity-20">🃏</span>
        )}
        <div className="absolute inset-0 border border-zinc-600/30 rounded-sm" />
      </div>
    </div>
  );
}

type PinnedManifestForReveal = Awaited<ReturnType<typeof loadPinnedManifest>>;

type ImageCandidate = {
  url: string;
  label: string;
  tier: 'preferred' | 'local' | 'mirror' | 'gateway';
};

type PreloadResult = {
  url: string | null;
  label: string | null;
  elapsedMs: number;
};

const PRELOAD_CARD_CONCURRENCY = 3;
const LOCAL_PRELOAD_TIMEOUT_MS = 1200;
const MIRROR_PRELOAD_TIMEOUT_MS = 7000;
const GATEWAY_PRELOAD_TIMEOUT_MS = 5500;

function addCandidate(list: ImageCandidate[], seen: Set<string>, candidate: ImageCandidate) {
  if (!candidate.url || seen.has(candidate.url)) return;
  seen.add(candidate.url);
  list.push(candidate);
}

function getManifestPath(hash: string, manifest?: PinnedManifestForReveal): string {
  return manifest?.files?.[hash]?.path ?? hash;
}

function buildImageCandidates(originalUrl: string | null | undefined, preferredUrl?: string | null, manifest?: PinnedManifestForReveal): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>();

  if (preferredUrl) {
    addCandidate(candidates, seen, { url: preferredUrl, label: 'resolved winner', tier: 'preferred' });
  }

  const hash = originalUrl ? extractIpfsHash(originalUrl) : null;
  if (!hash) {
    if (originalUrl) addCandidate(candidates, seen, { url: originalUrl, label: 'original URL', tier: 'gateway' });
    return candidates;
  }

  const localUrl = resolveLocalMirror(hash);
  if (localUrl) addCandidate(candidates, seen, { url: localUrl, label: 'local ZIP mirror', tier: 'local' });

  const mirrorPath = getManifestPath(hash, manifest);
  const mirrors = [
    { base: PRIMARY_MIRROR, label: 'primary mirror' },
    { base: BACKUP_MIRROR_A, label: 'backup mirror A' },
    { base: BACKUP_MIRROR_B, label: 'backup mirror B' },
  ];
  for (const mirror of mirrors) {
    if (!mirror.base || !/^https:\/\//i.test(mirror.base)) continue;
    addCandidate(candidates, seen, { url: `${mirror.base}${mirrorPath}`, label: mirror.label, tier: 'mirror' });
  }

  for (const gateway of PUBLIC_IPFS_GATEWAYS) {
    addCandidate(candidates, seen, { url: `${gateway}${hash}`, label: new URL(gateway).hostname, tier: 'gateway' });
  }

  if (originalUrl) addCandidate(candidates, seen, { url: originalUrl, label: 'original URL', tier: 'gateway' });
  return candidates;
}

function buildRevealImageCandidates(originalUrl: string | null | undefined, preferredUrl?: string | null, manifest?: PinnedManifestForReveal): string[] {
  return buildImageCandidates(originalUrl, preferredUrl, manifest).map((candidate) => candidate.url);
}

function loadImageCandidate(candidate: ImageCandidate, timeoutMs: number, signal: AbortSignal): Promise<ImageCandidate | null> {
  if (signal.aborted) return Promise.resolve(null);

  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      img.onload = null;
      img.onerror = null;
      try {
        img.removeAttribute('src');
        img.src = '';
      } catch {
        /* noop */
      }
    };

    const finish = (result: ImageCandidate | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onAbort = () => finish(null);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish(null), timeoutMs);
    img.onload = () => finish(candidate);
    img.onerror = () => finish(null);
    img.src = candidate.url;
  });
}

async function raceCandidateGroup(candidates: ImageCandidate[], timeoutMs: number, parentSignal: AbortSignal): Promise<ImageCandidate | null> {
  if (candidates.length === 0 || parentSignal.aborted) return null;

  const controller = new AbortController();
  const abortLocal = () => controller.abort();
  parentSignal.addEventListener('abort', abortLocal, { once: true });

  return new Promise((resolve) => {
    let settled = false;
    let losses = 0;

    const finish = (winner: ImageCandidate | null) => {
      if (settled) return;
      settled = true;
      parentSignal.removeEventListener('abort', abortLocal);
      controller.abort();
      resolve(winner);
    };

    candidates.forEach((candidate) => {
      loadImageCandidate(candidate, timeoutMs, controller.signal).then((winner) => {
        if (settled) return;
        if (winner) {
          finish(winner);
          return;
        }
        losses += 1;
        if (losses >= candidates.length) finish(null);
      });
    });
  });
}

/**
 * Preload a single image URL with mirror-first priority. We race a small
 * source group at a time instead of walking every gateway serially, and every
 * attempt is abort-aware so "Reveal now" can cut over immediately.
 */
async function preloadCardImage(
  originalUrl: string | null,
  manifest: PinnedManifestForReveal,
  signal: AbortSignal,
  onStatus?: (status: string) => void,
): Promise<PreloadResult> {
  const startedAt = performance.now();
  const candidates = buildImageCandidates(originalUrl, null, manifest);
  const local = candidates.filter((candidate) => candidate.tier === 'local' || candidate.tier === 'preferred');
  const mirrors = candidates.filter((candidate) => candidate.tier === 'mirror');
  const gateways = candidates.filter((candidate) => candidate.tier === 'gateway');

  const groups = [
    { label: 'Checking local backup…', candidates: local, timeout: LOCAL_PRELOAD_TIMEOUT_MS },
    { label: 'Checking backup mirrors…', candidates: mirrors.slice(0, 3), timeout: MIRROR_PRELOAD_TIMEOUT_MS },
    { label: 'Falling back to IPFS gateways…', candidates: gateways.slice(0, 3), timeout: GATEWAY_PRELOAD_TIMEOUT_MS },
    { label: 'Trying remaining IPFS gateways…', candidates: gateways.slice(3), timeout: GATEWAY_PRELOAD_TIMEOUT_MS },
  ];

  for (const group of groups) {
    if (signal.aborted) break;
    if (group.candidates.length === 0) continue;
    onStatus?.(group.label);
    const winner = await raceCandidateGroup(group.candidates, group.timeout, signal);
    if (winner) {
      return { url: winner.url, label: winner.label, elapsedMs: performance.now() - startedAt };
    }
  }

  return { url: null, label: null, elapsedMs: performance.now() - startedAt };
}

/**
 * Concurrency-limited preload pool. Fans out only a few cards at once while
 * each card performs a tiny mirror/gateway race. The returned `done` promise
 * resolves when the pool naturally finishes or when its AbortController is
 * aborted by the instant reveal fallback.
 */
async function preloadWithPool<T>(
  items: T[],
  getUrl: (item: T) => string | null,
  onCardDone: (index: number, item: T, result: PreloadResult) => void,
  opts: {
    concurrency?: number;
    manifest: PinnedManifestForReveal;
    signal: AbortSignal;
    onStatus?: (status: string) => void;
  },
): Promise<PreloadResult[]> {
  const { concurrency = PRELOAD_CARD_CONCURRENCY, manifest, signal, onStatus } = opts;
  const resultDetails: PreloadResult[] = new Array(items.length).fill(null).map(() => ({ url: null, label: null, elapsedMs: 0 }));
  let cursor = 0;

  async function worker() {
    while (true) {
      if (signal.aborted) return;
      const i = cursor++;
      if (i >= items.length) return;
      const item = items[i];
      const result = await preloadCardImage(getUrl(item), manifest, signal, onStatus);
      resultDetails[i] = result;
      if (!signal.aborted) onCardDone(i, item, result);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return resultDetails;
}


const POLL_INTERVAL = 3000;

/**
 * Fetch pendingnft.a rows for an owner, paginating through the table.
 *
 * Why pagination matters: WAX `get_table_rows` returns at most a few hundred
 * rows per call. Accounts that have opened a lot of packs — especially
 * without clicking "Collect Assets" every time — can accumulate thousands of
 * stale `done=0` rows. Without pagination the newest rows (highest primary
 * keys) never appear in an ascending scan, so the reveal dialog polls forever
 * and Collect Unclaimed / Recover Stuck Cards can't see them either.
 *
 * We cap at MAX_PAGES (100k rows) to avoid runaway loops if the table is
 * truly enormous, and surface a `truncated` flag so callers can warn the user
 * when the scan did not reach the end of the table.
 *
 * When `descending: true`, the scan walks the table newest-first via
 * `reverse: true` — guaranteed to include the most recent unboxings even when
 * the account has more rows than the ceiling.
 */

export interface FetchPendingNftsOptions {
  descending?: boolean;
  /** Stop early when this many rows have been collected (defensive early-exit). */
  maxRows?: number;
  /** Stop early when the callback returns true after each page. */
  shouldStop?: (rowsSoFar: PendingNftRow[]) => boolean;
}

export interface FetchPendingNftsResult {
  rows: PendingNftRow[];
  truncated: boolean;
  pagesFetched: number;
  lastError: Error | null;
}

const PENDING_NFTS_MAX_PAGES = 200; // 200 * 500 = 100,000 row ceiling
const PENDING_NFTS_PAGE_SIZE = 500;

export async function fetchPendingNftsDetailed(
  owner: string,
  options?: FetchPendingNftsOptions,
): Promise<FetchPendingNftsResult> {
  const descending = !!options?.descending;
  const maxRows = options?.maxRows ?? Number.POSITIVE_INFINITY;
  const shouldStop = options?.shouldStop;

  const all: PendingNftRow[] = [];
  let bound: string | undefined = undefined;
  let lastError: Error | null = null;
  let page = 0;
  let more = false;

  for (page = 0; page < PENDING_NFTS_MAX_PAGES; page++) {
    let result: { rows: PendingNftRow[]; more: boolean; next_key?: string } | null = null;
    // One retry with short backoff — fetchTableRows already fails over RPC
    // endpoints, so a total failure here is real network trouble.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await fetchTableRows<PendingNftRow>({
          code: 'gpk.topps',
          scope: owner,
          table: 'pendingnft.a',
          limit: PENDING_NFTS_PAGE_SIZE,
          ...(descending
            ? { reverse: true, ...(bound ? { upper_bound: bound } : {}) }
            : { ...(bound ? { lower_bound: bound } : {}) }),
        });
        lastError = null;
        break;
      } catch (e) {
        lastError = e as Error;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }
    if (!result) {
      console.error('[pack-reveal] fetchPendingNftsDetailed page failed', { page, lastError });
      // Truncated due to network failure — bail out but keep partial rows.
      more = true;
      break;
    }
    if (result.rows.length > 0) all.push(...result.rows);
    more = !!result.more && !!result.next_key;
    if (!more) break;
    if (all.length >= maxRows) break;
    if (shouldStop && shouldStop(all)) break;
    bound = String(result.next_key);
  }

  const truncated = more || page >= PENDING_NFTS_MAX_PAGES;
  return { rows: all, truncated, pagesFetched: page + 1, lastError };
}

/**
 * Backward-compatible wrapper — returns just the rows.
 * Callers that need truncation info should use `fetchPendingNftsDetailed`.
 */
export async function fetchPendingNfts(
  owner: string,
  options?: FetchPendingNftsOptions,
): Promise<PendingNftRow[]> {
  const { rows } = await fetchPendingNftsDetailed(owner, options);
  return rows;
}

export function PackRevealDialog({
  open, onOpenChange, packSymbol, packLabel, packImage,
  accountName, preOpenUnboxingIds, onComplete, onDemoCollect, demoCards, session,
}: PackRevealDialogProps) {
  const [phase, setPhase] = useState<'waiting' | 'preloading' | 'revealing' | 'collect' | 'collecting' | 'done'>('waiting');
  const [newCards, setNewCards] = useState<RevealCard[]>([]);
  const [pendingRowIds, setPendingRowIds] = useState<number[]>([]);
  const [unboxingId, setUnboxingId] = useState<number | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [waitMessage, setWaitMessage] = useState('');
  const [collectError, setCollectError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [showEscape, setShowEscape] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [preloadStatus, setPreloadStatus] = useState('Checking backup mirrors…');
  const [showPreloadEscape, setShowPreloadEscape] = useState(false);
  const preloadSkipRef = useRef(false);
  const preloadRunRef = useRef<{
    controller: AbortController;
    cards: RevealCard[];
    winners: Array<string | null>;
    finalized: boolean;
  } | null>(null);

  const pollStartRef = useRef<number>(0);
  const revealedRowsRef = useRef<PendingNftRow[]>([]);
  const isDemo = !!(demoCards && demoCards.length > 0);

  const expectedCount = EXPECTED_CARDS[packSymbol] ?? 5;
  const boxtype = SYMBOL_TO_BOXTYPE[packSymbol];

  usePackRevealAudio({ open, phase, isShaking, revealedCount });

  useEffect(() => {
    if (open) {
      setPhase('waiting'); setNewCards([]); setPendingRowIds([]);
      setUnboxingId(null); setRevealedCount(0); setWaitMessage('');
      setCollectError(null); setShowEscape(false); setShowPreloadEscape(false);
      setPreloadStatus('Checking backup mirrors…');
      preloadSkipRef.current = false; pollStartRef.current = Date.now();
      preloadRunRef.current?.controller.abort();
      preloadRunRef.current = null;

      setIsShaking(true);
      const shakeTimer = setTimeout(() => setIsShaking(false), 3500);
      return () => clearTimeout(shakeTimer);
    } else {
      setIsShaking(false);
      preloadRunRef.current?.controller.abort();
      preloadRunRef.current = null;
    }
  }, [open]);

  const finishPreload = useCallback((reason: 'complete' | 'skip') => {
    const run = preloadRunRef.current;
    if (!run || run.finalized) return;
    run.finalized = true;
    preloadSkipRef.current = reason === 'skip';
    run.controller.abort();
    const resolved = run.cards.map((card, i) => ({
      ...card,
      originalImage: card.originalImage ?? card.image,
      image: run.winners[i] ?? card.image,
    }));
    const readyCount = run.winners.filter(Boolean).length;
    console.log(`[pack-reveal] preload ${reason} — ${readyCount}/${run.cards.length} images ready`);
    setPreloadProgress({ done: readyCount, total: run.cards.length });
    setShowPreloadEscape(false);
    setNewCards(resolved);
    setPhase('revealing');
  }, []);

  // Escape hatch: show close button after 60s of waiting
  useEffect(() => {
    if (!open || phase !== 'waiting') { setShowEscape(false); return; }
    const timer = setTimeout(() => setShowEscape(true), 60000);
    return () => clearTimeout(timer);
  }, [open, phase]);

  // Preload escape hatch: after 20s of preloading, allow the user to reveal
  // now with whatever winners are ready; RevealCardImage will self-heal the rest.
  useEffect(() => {
    if (!open || phase !== 'preloading') { setShowPreloadEscape(false); return; }
    const timer = setTimeout(() => setShowPreloadEscape(true), 20000);
    return () => clearTimeout(timer);
  }, [open, phase]);


  // Demo mode
  useEffect(() => {
    if (!open || phase !== 'waiting' || !demoCards || demoCards.length === 0) return;
    const timer = setTimeout(() => { setNewCards(demoCards); setPhase('revealing'); }, 4000);
    return () => clearTimeout(timer);
  }, [open, phase, demoCards]);

  // Real polling
  useEffect(() => {
    if (!open || !accountName || (demoCards && demoCards.length > 0)) return;
    if (phase !== 'waiting') return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      try {
        const rows = await fetchPendingNfts(accountName);
        if (cancelled) return;
        const newRows = rows.filter((r) => r.done === 0 && !preOpenUnboxingIds.has(r.unboxingid));
        const grouped = new Map<number, PendingNftRow[]>();
        for (const r of newRows) {
          const arr = grouped.get(r.unboxingid) || [];
          arr.push(r);
          grouped.set(r.unboxingid, arr);
        }
        const elapsed = Date.now() - pollStartRef.current;
        if (elapsed > 60000) setWaitMessage('Almost there — the blockchain is a little busy right now. Your cards are safe and will appear shortly.');
        else if (elapsed > 30000) setWaitMessage('Still working... the indexer is processing your cards. Sit tight!');

        let targetRows: PendingNftRow[] | null = null;
        let targetUnboxingId: number | null = null;
        for (const [uid, uRows] of grouped) {
          if (boxtype && uRows[0]?.boxtype === boxtype && uRows.length >= expectedCount) {
            targetRows = uRows; targetUnboxingId = uid; break;
          }
        }
        if (!targetRows) {
          for (const [uid, uRows] of grouped) {
            if (uRows.length >= expectedCount) { targetRows = uRows; targetUnboxingId = uid; break; }
          }
        }
        if (targetRows && targetUnboxingId !== null) {
          clearInterval(interval);
          const sorted = targetRows.sort((a, b) => a.draw - b.draw);
          const cards: RevealCard[] = sorted.map((r) => {
            const displayCardId = normalizePendingGpkCardId(r.boxtype, r.cardid);
            return {
              asset_id: String(r.id),
              name: `Card #${displayCardId}${r.quality}`,
              image: buildGpkCardImageUrl(r.boxtype, r.variant, displayCardId, r.quality),
              originalImage: buildGpkCardImageUrl(r.boxtype, r.variant, displayCardId, r.quality),
              rarity: `${r.variant} ${r.quality}`,
            };
          });
          console.log(`[pack-reveal] targeting ${cards.length}-card unboxing (boxtype=${sorted[0]?.boxtype})`);
          setPendingRowIds(sorted.map((r) => r.id));
          setUnboxingId(targetUnboxingId);
          revealedRowsRef.current = sorted;

          // Preload every image before revealing anything. Quality-over-speed:
          // we intentionally wait until every card has been resolved to some
          // gateway (or exhausted all of them) so the reveal itself never
          // shows a blank tile.
          setPreloadProgress({ done: 0, total: cards.length });
          setPreloadStatus('Checking backup mirrors…');
          setPhase('preloading');
          preloadSkipRef.current = false;
          const controller = new AbortController();
          preloadRunRef.current = { controller, cards, winners: new Array(cards.length).fill(null), finalized: false };
          let doneCount = 0;
          const manifest = await loadPinnedManifest();
          await preloadWithPool(
            cards,
            (c) => c.image,
            (i, c, result) => {
              doneCount++;
              const activeRun = preloadRunRef.current;
              if (activeRun && !activeRun.finalized) activeRun.winners[i] = result.url;
              if (!cancelled) setPreloadProgress({ done: doneCount, total: cards.length });
              if (result.url) {
                console.log(`[pack-reveal] card ${i + 1}/${cards.length} → ${result.label ?? 'winner'} (${Math.round(result.elapsedMs)}ms) ${result.url}`);
              } else {
                console.warn(`[pack-reveal] card ${i + 1}/${cards.length} → unreachable (${c.image})`);
              }
            },
            {
              concurrency: PRELOAD_CARD_CONCURRENCY,
              manifest,
              signal: controller.signal,
              onStatus: (status) => { if (!controller.signal.aborted && !cancelled) setPreloadStatus(status); },
            },
          );
          if (cancelled) return;
          finishPreload('complete');
        }
      } catch (e) { console.error('[pack-reveal] poll error', e); }
    };

    const startDelay = setTimeout(() => {
      if (cancelled) return;
      poll();
      interval = setInterval(poll, POLL_INTERVAL);
    }, 4000);

    return () => {
      cancelled = true;
      preloadRunRef.current?.controller.abort();
      clearTimeout(startDelay);
      clearInterval(interval);
    };
  }, [open, phase, accountName, preOpenUnboxingIds, expectedCount, boxtype, demoCards, finishPreload]);

  // Staggered reveal
  useEffect(() => {
    if (phase !== 'revealing' || newCards.length === 0 || revealedCount >= newCards.length) return;
    const timer = setTimeout(() => {
      setRevealedCount((c) => c + 1);
      setTimeout(() => playCardRevealSound(), 600);
    }, 1600);
    return () => clearTimeout(timer);
  }, [phase, revealedCount, newCards.length]);

  // Transition to collect
  useEffect(() => {
    if (phase === 'revealing' && revealedCount >= newCards.length && newCards.length > 0) {
      if (demoCards && demoCards.length > 0) {
        setPhase('collect');
        return;
      }
      if (pendingRowIds.length > 0) setPhase('collect');
    }
  }, [phase, revealedCount, newCards.length, pendingRowIds, demoCards]);

  const handleCollect = useCallback(async () => {
    if (isDemo) {
      setPhase('done');
      onOpenChange(false);
      onDemoCollect?.();
      return;
    }
    if (!session || unboxingId === null || pendingRowIds.length === 0) return;
    setPhase('collecting'); setCollectError(null);
    const actor = String(session.actor);
    const auth = [{ actor, permission: String(session.permission) }];
    try {
      const result = await session.transact({
        actions: [{
          account: 'gpk.topps', name: 'getcards', authorization: auth,
          data: { from: actor, unboxing: unboxingId, cardids: pendingRowIds },
        }],
      }, { transactPlugins: getTransactPlugins(session) });
      const txId = result?.resolved?.transaction?.id?.toString() || null;
      const reveal: RevealResult = {
        source: 'simpleassets',
        expectedCategory: getGpkCategoryForBoxtype(revealedRowsRef.current[0]?.boxtype ?? ''),
        matchers: revealedRowsRef.current.map((r) => ({
          kind: 'sa' as const,
          cardid: normalizePendingGpkCardId(r.boxtype, r.cardid),
          side: String(r.quality ?? '').toLowerCase(),
          variant: normalizeGpkVariant(String(r.variant ?? '')),
          category: getGpkCategoryForBoxtype(r.boxtype),
        })),
      };
      setPhase('done'); onComplete(txId, reveal);
      // Auto-close after brief confirmation
      setTimeout(() => onOpenChange(false), 1500);
    } catch (e) {
      console.error('[pack-reveal] getcards failed', e);
      closeWharfkitModals(); setTimeout(() => closeWharfkitModals(), 100);
      setCollectError(e instanceof Error ? e.message : 'Transaction failed');
      setPhase('collect');
    }
  }, [session, unboxingId, pendingRowIds, onComplete, isDemo, onDemoCollect, onOpenChange]);

  const handleClose = () => { onOpenChange(false); if (phase !== 'done') onComplete(); };
  const allRevealed = revealedCount >= newCards.length && newCards.length > 0;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border" hideClose onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">Pack Reveal</DialogTitle>

        {phase === 'waiting' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="animate-pack-shake">
              {packImage ? (
                <img src={packImage} alt={packLabel} className="w-32 h-auto rounded-lg shadow-lg shadow-primary/30" />
              ) : (
                <span className="text-7xl">📦</span>
              )}
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-bold text-foreground">Opening {packLabel}...</p>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for cards to be minted...</span>
              </div>
              <p className="text-xs text-muted-foreground/60 max-w-sm text-center">{waitMessage || 'This can take a few seconds to 2–3 minutes depending on the indexer. Don\'t worry — your cards are on their way! You\'ll hear bell rings when they\'re revealed.'}</p>
            </div>
            {showEscape && (
              <div className="flex flex-col items-center gap-2 pt-4">
                <Button variant="outline" size="sm" onClick={handleClose}>
                  Close & Check Later
                </Button>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Your pack was sent — cards may still arrive. Check your collection or try again later.
                </p>
              </div>
            )}
          </div>
        )}

        {phase === 'preloading' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="animate-pack-shake">
              {packImage ? (
                <img src={packImage} alt={packLabel} className="w-32 h-auto rounded-lg shadow-lg shadow-primary/30" />
              ) : (
                <span className="text-7xl">📦</span>
              )}
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-bold text-foreground">Preparing your reveal...</p>
              <div className="flex items-center gap-2 text-muted-foreground text-sm justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{preloadProgress.done} / {preloadProgress.total} cards ready</span>
              </div>
              <p className="text-xs text-muted-foreground/60 max-w-sm text-center">
                {preloadStatus}
              </p>
              {showPreloadEscape && (
                <div className="flex flex-col items-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => finishPreload('skip')}
                  >
                    Reveal now
                  </Button>
                  <p className="text-xs text-muted-foreground/60 text-center max-w-xs">
                    Skips the wait. Any cards still loading will fetch during the reveal and self-heal if a gateway is slow.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {(phase === 'revealing' || phase === 'collect' || phase === 'collecting' || phase === 'done') && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">
                  {phase === 'done' ? 'Cards Collected!' : allRevealed ? 'All Cards Revealed!' : 'Revealing Cards...'}
                </h2>
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{newCards.length} card{newCards.length !== 1 ? 's' : ''} from {packLabel}</p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3" style={{ perspective: '1000px' }}>
              {newCards.map((card, i) => {
                const isRevealed = i < revealedCount;
                return (
                  <RevealCardImage key={card.asset_id} card={card} isRevealed={isRevealed} packImage={packImage} />
                );
              })}
            </div>

            {phase === 'collect' && (
              <div className="flex flex-col items-center gap-3 pt-2">
                {collectError && <p className="text-xs text-destructive text-center">{collectError}</p>}
                <Button onClick={handleCollect} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!isDemo && !session}>
                  <Download className="h-4 w-4 mr-2" />Collect Assets
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {isDemo ? 'Click to see your cards added to the collection' : 'Sign a transaction to deliver these cards to your wallet'}
                </p>
              </div>
            )}

            {phase === 'collecting' && (
              <div className="flex justify-center pt-2">
                <Button disabled className="bg-primary/70 text-primary-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Collecting...</Button>
              </div>
            )}

            {phase === 'done' && (
              <div className="flex justify-center pt-2">
                <p className="text-sm text-muted-foreground animate-pulse">Closing...</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
