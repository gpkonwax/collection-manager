/**
 * Mirror-first image source resolution for pack reveals & deal animations.
 *
 * Public IPFS gateways are the slow, unreliable path. We control three
 * mirrors (Netlify, GitHub Pages, Cloudflare Pages) that hold byte-verified
 * copies of every snapshotted card. During reveals we should prefer those
 * mirrors and only fall through to public IPFS when a hash isn't in the
 * pinned manifest (i.e. new cards minted after the last snapshot).
 */
import {
  PRIMARY_MIRROR,
  BACKUP_MIRROR_A,
  BACKUP_MIRROR_B,
  PUBLIC_IPFS_GATEWAYS,
  extractIpfsHash,
} from './ipfsGateways';
import { acquireLocalMirror, releaseLocalMirror, resolveLocalMirror } from './localMirror';
import type { loadPinnedManifest } from './remoteMirror';

export type PinnedManifestLike = Awaited<ReturnType<typeof loadPinnedManifest>>;

export type ImageCandidate = {
  url: string;
  label: string;
  tier: 'preferred' | 'local' | 'mirror' | 'gateway';
};

/** All configured mirror bases, in priority order. */
export const MIRROR_BASES: Array<{ base: string; label: string }> = [
  { base: PRIMARY_MIRROR, label: 'primary mirror' },
  { base: BACKUP_MIRROR_A, label: 'backup mirror A' },
  { base: BACKUP_MIRROR_B, label: 'backup mirror B' },
].filter((m) => !!m.base && /^https:\/\//i.test(m.base));

/** True when the URL is our own bytes (local blob or one of our mirror hosts). */
export function isTrustedRevealUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('blob:')) return true;
  return MIRROR_BASES.some((m) => url.startsWith(m.base));
}

function addCandidate(list: ImageCandidate[], seen: Set<string>, candidate: ImageCandidate) {
  if (!candidate.url || seen.has(candidate.url)) return;
  seen.add(candidate.url);
  list.push(candidate);
}

function getManifestPath(hash: string, manifest?: PinnedManifestLike): string {
  return manifest?.files?.[hash]?.path ?? hash;
}

/**
 * Build the mirror-first candidate list for a reveal image.
 *
 * Ordering:
 *   1. Trusted preferred URL (blob: or mirror host) — never a public gateway
 *   2. Local ZIP mirror hit
 *   3. Every configured mirror (Netlify + GitHub + Cloudflare)
 *   4. Public IPFS gateways — ONLY when the hash isn't in the pinned manifest
 *   5. Original URL as a last-ditch fallback (again, only when no manifest hit)
 */
export function buildRevealCandidates(
  originalUrl: string | null | undefined,
  preferredUrl?: string | null,
  manifest?: PinnedManifestLike,
): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>();

  if (preferredUrl && preferredUrl !== originalUrl && isTrustedRevealUrl(preferredUrl)) {
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
  for (const mirror of MIRROR_BASES) {
    addCandidate(candidates, seen, { url: `${mirror.base}${mirrorPath}`, label: mirror.label, tier: 'mirror' });
  }

  // If the manifest covers this hash, our mirrors are authoritative — skip
  // public IPFS entirely. Fall through only when the hash is unknown to the
  // snapshot (new cards, one-off assets, etc.).
  const manifestHasHash = !!manifest?.files?.[hash];
  if (!manifestHasHash) {
    for (const gateway of PUBLIC_IPFS_GATEWAYS) {
      addCandidate(candidates, seen, { url: `${gateway}${hash}`, label: new URL(gateway).hostname, tier: 'gateway' });
    }
    if (originalUrl) addCandidate(candidates, seen, { url: originalUrl, label: 'original URL', tier: 'gateway' });
  }

  return candidates;
}

/** Convenience: candidate URLs only. Used by the flip-card tile fallback list. */
export function buildRevealCandidateUrls(
  originalUrl: string | null | undefined,
  preferredUrl?: string | null,
  manifest?: PinnedManifestLike,
): string[] {
  return buildRevealCandidates(originalUrl, preferredUrl, manifest).map((c) => c.url);
}

/**
 * Load a single candidate as an <img>; resolves to the candidate on success,
 * null on error / timeout / abort. Aborting the parent signal cancels in
 * flight so we don't waste bandwidth on losers.
 */
export function loadImageCandidate(
  candidate: ImageCandidate,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<ImageCandidate | null> {
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

/** Race a group of candidates in parallel; first success wins, cancels others. */
export function raceCandidateGroup(
  candidates: ImageCandidate[],
  timeoutMs: number,
  parentSignal: AbortSignal,
): Promise<ImageCandidate | null> {
  if (candidates.length === 0 || parentSignal.aborted) return Promise.resolve(null);

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

export const LOCAL_PRELOAD_TIMEOUT_MS = 1200;
export const MIRROR_PRELOAD_TIMEOUT_MS = 7000;
export const GATEWAY_PRELOAD_TIMEOUT_MS = 5500;

export type PreloadResult = {
  url: string | null;
  label: string | null;
  elapsedMs: number;
};

/**
 * Full mirror-first preload pipeline for a single card image.
 *
 * Groups (raced in parallel within each group, sequential across groups):
 *   1. Local ZIP / trusted preferred URL
 *   2. All configured mirrors together — first host to answer wins
 *   3. Public IPFS gateways (only present when manifest doesn't cover the hash)
 */
export async function preloadRevealImage(
  originalUrl: string | null | undefined,
  manifest: PinnedManifestLike | undefined,
  signal: AbortSignal,
  onStatus?: (status: string) => void,
): Promise<PreloadResult> {
  const startedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const hash = originalUrl ? extractIpfsHash(originalUrl) : null;
  let acquiredLocal = false;
  if (hash && !resolveLocalMirror(hash)) {
    try {
      acquiredLocal = !!(await acquireLocalMirror(hash));
    } catch {
      acquiredLocal = false;
    }
  }
  const candidates = buildRevealCandidates(originalUrl, null, manifest);
  const local = candidates.filter((c) => c.tier === 'local' || c.tier === 'preferred');
  const mirrors = candidates.filter((c) => c.tier === 'mirror');
  const gateways = candidates.filter((c) => c.tier === 'gateway');

  const groups = [
    { label: 'Checking local backup…', candidates: local, timeout: LOCAL_PRELOAD_TIMEOUT_MS },
    { label: 'Checking backup mirrors…', candidates: mirrors, timeout: MIRROR_PRELOAD_TIMEOUT_MS },
    { label: 'Falling back to IPFS gateways…', candidates: gateways.slice(0, 3), timeout: GATEWAY_PRELOAD_TIMEOUT_MS },
    { label: 'Trying remaining IPFS gateways…', candidates: gateways.slice(3), timeout: GATEWAY_PRELOAD_TIMEOUT_MS },
  ];

  for (const group of groups) {
    if (signal.aborted) break;
    if (group.candidates.length === 0) continue;
    onStatus?.(group.label);
    const winner = await raceCandidateGroup(group.candidates, group.timeout, signal);
    if (winner) {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (acquiredLocal) releaseLocalMirror(hash);
      return { url: winner.url, label: winner.label, elapsedMs: now - startedAt };
    }
  }

  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (acquiredLocal) releaseLocalMirror(hash);
  return { url: null, label: null, elapsedMs: now - startedAt };
}
