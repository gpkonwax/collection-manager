/**
 * Thumbnail byte cache backed by the browser Cache Storage API.
 *
 * Used for Pack History thumbnails (mirror-served, CORS-safe URLs) so that
 * re-opening the dialog — or reloading the page entirely — paints instantly
 * without hitting the network.
 *
 * Every method degrades to a graceful no-op when Cache Storage is unavailable
 * (non-secure contexts, private modes, older browsers).
 */

const CACHE_NAME = 'gpk-thumbs-v1';
const MAX_ENTRIES = 1500;

/** Synthetic same-origin request key so hashes map to stable cache entries. */
function keyFor(hash: string): string {
  return `https://gpk-thumb-cache.local/${hash}`;
}

function supported(): boolean {
  try {
    return typeof caches !== 'undefined' && !!caches?.open;
  } catch {
    return false;
  }
}

let cachePromise: Promise<Cache | null> | null = null;
function openCache(): Promise<Cache | null> {
  if (!supported()) return Promise.resolve(null);
  if (!cachePromise) {
    cachePromise = caches.open(CACHE_NAME).catch(() => null);
  }
  return cachePromise;
}

// hash → object URL for entries already materialised this session.
const objectUrls = new Map<string, string>();
// Hashes known to be absent from the cache, so we don't re-probe repeatedly.
const misses = new Set<string>();

/** Synchronous peek — returns an object URL if this hash was already hydrated. */
export function peekThumb(hash: string | null): string | null {
  if (!hash) return null;
  return objectUrls.get(hash) ?? null;
}

/** True when we already know the cache has nothing for this hash. */
export function isKnownThumbMiss(hash: string | null): boolean {
  return !!hash && misses.has(hash);
}

/**
 * Look up cached bytes for a hash and return a usable object URL, or null.
 */
export async function getThumb(hash: string): Promise<string | null> {
  const existing = objectUrls.get(hash);
  if (existing) return existing;
  if (misses.has(hash)) return null;
  const cache = await openCache();
  if (!cache) return null;
  try {
    const res = await cache.match(keyFor(hash));
    if (!res || !res.ok) {
      misses.add(hash);
      return null;
    }
    const blob = await res.blob();
    if (!blob.size) {
      misses.add(hash);
      return null;
    }
    const url = URL.createObjectURL(blob);
    objectUrls.set(hash, url);
    return url;
  } catch {
    misses.add(hash);
    return null;
  }
}

let writeCount = 0;

/**
 * Fetch `url` and store its bytes under `hash`.
 * Only CORS-readable responses can be cached; opaque responses are skipped.
 */
export async function putThumb(hash: string, url: string): Promise<void> {
  if (!hash || !url || url.startsWith('blob:') || url.startsWith('data:')) return;
  const cache = await openCache();
  if (!cache) return;
  try {
    const existing = await cache.match(keyFor(hash));
    if (existing) return;
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok || res.type === 'opaque') return;
    const blob = await res.blob();
    if (!blob.size || blob.size > 5 * 1024 * 1024) return;
    await cache.put(keyFor(hash), new Response(blob, {
      headers: { 'Content-Type': blob.type || 'image/png' },
    }));
    misses.delete(hash);
    writeCount += 1;
    if (writeCount % 100 === 0) void pruneThumbs();
  } catch {
    /* best-effort */
  }
}

/** Trim the cache back to MAX_ENTRIES, dropping the oldest entries first. */
export async function pruneThumbs(max = MAX_ENTRIES): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  try {
    const keys = await cache.keys();
    if (keys.length <= max) return;
    const excess = keys.slice(0, keys.length - max);
    await Promise.all(excess.map((k) => cache.delete(k)));
  } catch {
    /* noop */
  }
}

/** Drop every cached thumbnail and release object URLs. */
export async function clearThumbs(): Promise<void> {
  for (const url of objectUrls.values()) {
    try { URL.revokeObjectURL(url); } catch { /* noop */ }
  }
  objectUrls.clear();
  misses.clear();
  cachePromise = null;
  if (!supported()) return;
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    /* noop */
  }
}

/**
 * Best-effort warm-up: ensure the given hashes are present in the cache,
 * fetching each from the provided URL resolver when missing.
 * Runs with limited concurrency so it never floods the network.
 */
export async function warmThumbs(
  hashes: string[],
  resolveUrl: (hash: string) => string | null,
  concurrency = 6,
): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  const queue = hashes.filter(Boolean);
  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const hash = queue[cursor++];
      if (objectUrls.has(hash)) continue;
      try {
        const hit = await cache.match(keyFor(hash));
        if (hit) continue;
      } catch {
        return;
      }
      const url = resolveUrl(hash);
      if (!url) continue;
      await putThumb(hash, url);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
}
