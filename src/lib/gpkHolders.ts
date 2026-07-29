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

async function fetchManifestFrom(baseUrl: string, signal: AbortSignal): Promise<HoldersManifest | null> {
  if (!baseUrl || !/^https:\/\//i.test(baseUrl)) return null;
  const url = `${baseUrl}${MANIFEST_PATH}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as HoldersManifest;
    if (!data || !Array.isArray(data.holders)) return null;
    return data;
  } catch {
    return null;
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

  // Race mirrors — first successful manifest wins.
  const attempts = MIRRORS.filter((m) => m.url && /^https:\/\//i.test(m.url)).map((m) =>
    fetchManifestFrom(m.url, signal),
  );
  if (attempts.length === 0) {
    throw new Error('No mirrors configured');
  }

  const manifest = await new Promise<HoldersManifest | null>((resolve) => {
    let pending = attempts.length;
    let resolved = false;
    attempts.forEach((p) => {
      p.then((r) => {
        if (resolved) return;
        if (r) { resolved = true; resolve(r); return; }
        pending--;
        if (pending === 0) resolve(null);
      });
    });
  });

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (!manifest) throw new Error('All mirrors failed to serve the holders manifest');

  const sorted = [...manifest.holders].sort((a, b) => b.total - a.total).slice(0, limit);
  cached = { holders: sorted, at: Date.now(), generatedAt: manifest.generatedAt || null };
  return { holders: sorted, generatedAt: manifest.generatedAt || null };
}
