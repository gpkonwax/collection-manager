/**
 * GPK holders list — fetched from the mirror-hosted static manifest at
 * `manifests/gpk-topps-holders.json`. The manifest is regenerated manually
 * via `scripts/build-holders-manifest.mjs` alongside the image mirror.
 *
 * Sources merged in the manifest (both scoped strictly to GPK/Topps):
 *   sa = SimpleAssets rows where author == 'gpk.topps'
 *   aa = AtomicAssets collection_name == 'gpk.topps'
 */
import { MIRRORS } from './remoteMirror';
import { DATA_MIRROR_URL } from './dataMirror';

export interface Holder {
  account: string;
  sa: number;
  aa: number;
  total: number;
}

export interface HoldersManifest {
  generatedAt: string;
  totals: { accounts: number; sa: number; aa: number };
  holders: Holder[];
}

const MANIFEST_PATH = 'manifests/gpk-topps-holders.json';
const FETCH_TIMEOUT_MS = 8_000;

let cached: { holders: Holder[]; at: number; generatedAt: string | null } | null = null;

export function getCachedHolders(): { holders: Holder[]; at: number; generatedAt: string | null } | null {
  return cached;
}

export function clearCachedHolders(): void {
  cached = null;
}

/** 'ok' = manifest served, 'missing' = reachable but 404/invalid, 'unreachable' = network/timeout */
type MirrorOutcome =
  | { kind: 'ok'; manifest: HoldersManifest }
  | { kind: 'missing' }
  | { kind: 'unreachable' };

export class HoldersManifestError extends Error {
  reason: 'not-published' | 'network';
  constructor(reason: 'not-published' | 'network', message: string) {
    super(message);
    this.name = 'HoldersManifestError';
    this.reason = reason;
  }
}

async function fetchManifestFrom(baseUrl: string, signal: AbortSignal): Promise<MirrorOutcome> {
  if (!baseUrl || !/^https:\/\//i.test(baseUrl)) return { kind: 'unreachable' };
  const url = `${baseUrl}${MANIFEST_PATH}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) {
      // Reached the host, it just doesn't have the file yet.
      return res.status >= 400 && res.status < 500 ? { kind: 'missing' } : { kind: 'unreachable' };
    }
    const data = (await res.json()) as HoldersManifest;
    if (!data || !Array.isArray(data.holders)) return { kind: 'missing' };
    return { kind: 'ok', manifest: data };
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

export async function fetchTopGpkHolders(opts: {
  signal: AbortSignal;
  limit?: number;
}): Promise<{ holders: Holder[]; generatedAt: string | null }> {
  const { signal } = opts;
  const limit = opts.limit ?? 500;

  // One attempt per mirror — first successful manifest wins.
  const attempts = MIRRORS.filter((m) => m.url && /^https:\/\//i.test(m.url)).map((m) =>
    fetchManifestFrom(m.url, signal),
  );
  if (attempts.length === 0) {
    throw new HoldersManifestError('network', 'No mirrors configured');
  }

  const outcomes = await Promise.all(attempts);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  const hit = outcomes.find((o): o is Extract<MirrorOutcome, { kind: 'ok' }> => o.kind === 'ok');
  if (!hit) {
    const anyMissing = outcomes.some((o) => o.kind === 'missing');
    throw anyMissing
      ? new HoldersManifestError('not-published', 'Holders snapshot not published yet.')
      : new HoldersManifestError('network', "Couldn't reach any mirror to load the holders list.");
  }

  const manifest = hit.manifest;
  const sorted = [...manifest.holders].sort((a, b) => b.total - a.total).slice(0, limit);
  cached = { holders: sorted, at: Date.now(), generatedAt: manifest.generatedAt || null };
  return { holders: sorted, generatedAt: manifest.generatedAt || null };
}
