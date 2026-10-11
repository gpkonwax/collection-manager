/**
 * Background warm-up of a collection's card images while a pack is being
 * revealed. By the time the deal animation scrolls down the grid, the tiles
 * are already in the browser cache, so the scroll, flights and sounds don't
 * stutter while dozens of images start loading at once.
 *
 * Mirror-first (local ZIP → our mirrors → public IPFS only for unknown hashes)
 * with bounded concurrency so the reveal itself never starves.
 */
import { extractIpfsHash } from './ipfsGateways';
import { loadPinnedManifest } from './remoteMirror';
import { preloadRevealImage } from './revealImageSources';
import { getCachedLoadedUrl, primeLoadedUrl } from '@/hooks/useIpfsMedia';
import { getGpkCategoryForBoxtype } from './gpkCardImages';

export const PRELOAD_CONCURRENCY = 6;
const PER_IMAGE_CAP_MS = 12_000;

type Provider = (category: string | null) => Array<string | null | undefined>;
let provider: Provider | null = null;
let active: AbortController | null = null;

/** The collection page registers how to list image URLs for a category. */
export function setCollectionPreloadProvider(fn: Provider | null) {
  provider = fn;
}

const SYMBOL_TO_BOXTYPE: Record<string, string> = {
  GPKFIVE: 'five', GPKMEGA: 'thirty',
  GPKTWOA: 'gpktwoeight', GPKTWOB: 'gpktwo25', GPKTWOC: 'gpktwo55',
  EXOFIVE: 'exotic5', EXOMEGA: 'exotic25',
};

export function categoryForSaPack(symbol: string): string | null {
  const boxtype = SYMBOL_TO_BOXTYPE[symbol];
  return boxtype ? getGpkCategoryForBoxtype(boxtype) || null : null;
}

export function categoryForAtomicPack(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes('crash')) return 'crashgordon';
  if (n.includes('stonk')) return 'gamestonk';
  if (n.includes('food')) return 'foodfightb';
  if (n.includes('bern')) return 'bernventures';
  if (n.includes('mitten')) return 'mittens';
  if (n.includes('tiger') || n.includes('exotic')) return 'exotic';
  return null;
}

/** Unique, not-yet-cached image URLs, in the given order. */
export function pendingPreloadUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    const key = extractIpfsHash(url) ?? url;
    if (seen.has(key)) continue;
    seen.add(key);
    if (getCachedLoadedUrl(extractIpfsHash(url))) continue;
    out.push(url);
  }
  return out;
}

/**
 * Start warming one category (null = unknown → skipped). Replaces any run in
 * progress. Returns a cancel function.
 */
export function startCollectionPreload(category: string | null): () => void {
  active?.abort();
  active = null;
  if (!provider || !category) return () => {};
  const urls = pendingPreloadUrls(provider(category));
  if (urls.length === 0) return () => {};

  const controller = new AbortController();
  active = controller;
  void (async () => {
    const manifest = await loadPinnedManifest().catch(() => undefined);
    let next = 0;
    const worker = async () => {
      while (!controller.signal.aborted && next < urls.length) {
        const url = urls[next++];
        const local = new AbortController();
        const stop = () => local.abort();
        controller.signal.addEventListener('abort', stop, { once: true });
        const cap = setTimeout(stop, PER_IMAGE_CAP_MS);
        try {
          const result = await preloadRevealImage(url, manifest, local.signal);
          const hash = extractIpfsHash(url);
          if (result.url && hash) primeLoadedUrl(hash, result.url);
        } catch { /* best effort */ } finally {
          clearTimeout(cap);
          controller.signal.removeEventListener('abort', stop);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, urls.length) }, worker));
    if (active === controller) active = null;
  })();

  return () => controller.abort();
}
