/**
 * Data mirror — small JSON manifests + static artwork (puzzle card-back scans,
 * pack artwork) hosted on a dedicated Cloudflare Pages site.
 *
 * Why a separate site: the main image mirror is multi-gigabyte and painful to
 * re-upload. Manifests and puzzle artwork are tiny and change independently,
 * so they live here and can be re-published in seconds without touching the
 * big mirror.
 *
 * Resolution order for a data-mirror-relative path:
 *   1. The dedicated data mirror (DATA_MIRROR_URL), when configured.
 *   2. The three image mirrors (they may eventually host these files too).
 *   3. null (caller handles the failure).
 *
 * Puzzle artwork is special: it has a canonical original URL on geepeekay.com.
 * When the data mirror is configured we prefer the mirrored copy and use the
 * geepeekay URL as a last-resort <img onError> fallback. When the data mirror
 * is NOT configured yet we use geepeekay directly (no wasted 404s).
 */
import { MIRRORS } from './remoteMirror';

/**
 * Base URL of the dedicated data mirror (Cloudflare Pages, e.g.
 * https://gpk-data.pages.dev/). MUST end with a trailing `/`.
 * Leave empty until the Cloudflare Pages site is created; lookups then fall
 * back to the image mirrors / original source URLs.
 */
export const DATA_MIRROR_URL: string = '';

/** Manifest + artwork are served from this relative path on every mirror. */
export const DATA_MIRROR_INDEX_PATH = 'manifests/data-mirror-index.json';

export function isDataMirrorConfigured(): boolean {
  return !!DATA_MIRROR_URL && /^https:\/\//i.test(DATA_MIRROR_URL) && DATA_MIRROR_URL.endsWith('/');
}

/**
 * Ordered list of base URLs to try for a data-mirror-relative path.
 * The dedicated data mirror comes first (when configured), then the image
 * mirrors as fallbacks.
 */
export function getDataMirrorBases(): string[] {
  const bases: string[] = [];
  if (isDataMirrorConfigured()) bases.push(DATA_MIRROR_URL);
  for (const m of MIRRORS) {
    if (m.url && /^https:\/\//i.test(m.url) && m.url !== DATA_MIRROR_URL) bases.push(m.url);
  }
  return bases;
}

/**
 * Resolve a data-mirror-relative path (e.g. "manifests/gpk-topps-holders.json")
 * to the first configured base URL. Returns null when no base is configured.
 */
export function resolveDataMirrorPath(rel: string): string | null {
  const clean = rel.replace(/^\/+/, '');
  const base = getDataMirrorBases()[0];
  return base ? `${base}${clean}` : null;
}

/**
 * Map a geepeekay.com gallery URL to its mirrored relative path under puzzles/.
 * e.g. https://geepeekay.com/gallery/os3/backs/os3back_85a.JPG
 *   -> puzzles/os3/backs/os3back_85a.jpg   (lowercased — case-sensitive hosts)
 *
 * Returns null for URLs that are not geepeekay gallery assets.
 */
export function geepeekayToMirrorPath(url: string): string | null {
  const m = url.match(/geepeekay\.com\/gallery\/(.+)$/i);
  if (!m) return null;
  return `puzzles/${m[1].toLowerCase()}`;
}

export interface ResolvedPuzzleImage {
  /** Primary source to load. */
  src: string;
  /** Last-resort fallback (the original geepeekay URL) for an onError handler. */
  fallback: string;
  /** True when the primary source is the data mirror (fallback is meaningful). */
  mirrored: boolean;
}

/**
 * Resolve puzzle artwork: prefer the data mirror, fall back to the original
 * geepeekay URL as a last resort. When the data mirror is not configured the
 * geepeekay URL is used directly (no speculative mirror fetches).
 */
export function resolvePuzzleImage(url: string): ResolvedPuzzleImage {
  const mirrorPath = geepeekayToMirrorPath(url);
  if (mirrorPath && isDataMirrorConfigured()) {
    return { src: `${DATA_MIRROR_URL}${mirrorPath}`, fallback: url, mirrored: true };
  }
  return { src: url, fallback: url, mirrored: false };
}
