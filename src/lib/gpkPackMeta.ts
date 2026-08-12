// Shared metadata for SimpleAssets pack tokens (packs.topps), used by the pack
// grid, the trade composer and the Trades dialog so labels/artwork match.

import gpkSeries1Img from '@/assets/gpk_pack_series_1_geepeekay.jpg';
import gpkSeries1MegaImg from '@/assets/gpk_pack_series_1_mega_geepeekay.jpg';
import gpkSeries2aImg from '@/assets/gpk_pack_series_2a_geepeekay.jpg';
import gpkSeries2bImg from '@/assets/gpk_pack_series_2b_geepeekay.jpg';
import gpkSeries2cImg from '@/assets/gpk_pack_series_2c_geepeekay.jpg';
import gpkExoticImg from '@/assets/gpk_pack_exotic.jpeg';
import gpkExoticMegaImg from '@/assets/gpk_pack_exotic_mega.jpeg';

export const PACK_LABELS: Record<string, string> = {
  GPKFIVE: 'GPK Series 1 Pack',
  GPKMEGA: 'GPK Mega Pack',
  GPKTWOA: 'GPK Series 2A Pack',
  GPKTWOB: 'GPK Series 2B Pack',
  GPKTWOC: 'GPK Series 2C Pack',
  EXOFIVE: 'Exotic Series 1 Pack',
  EXOMEGA: 'Exotic Mega Pack',
};

export const PACK_IMAGES: Record<string, string> = {
  GPKFIVE: gpkSeries1Img,
  GPKMEGA: gpkSeries1MegaImg,
  GPKTWOA: gpkSeries2aImg,
  GPKTWOB: gpkSeries2bImg,
  GPKTWOC: gpkSeries2cImg,
  EXOFIVE: gpkExoticImg,
  EXOMEGA: gpkExoticMegaImg,
};

export function packLabel(symbol: string): string {
  return PACK_LABELS[symbol] || symbol;
}

export function packImage(symbol: string): string | undefined {
  return PACK_IMAGES[symbol];
}

// ---------------------------------------------------------------------------
// Pack artwork resolution for stored history entries.
//
// SimpleAssets pack art is a bundled asset, so its URL carries a build hash.
// Persisting that URL (into the history store or an exported JSON) breaks the
// image on the next deploy. Always resolve from the pack symbol at render time.

const NAME_TO_SYMBOL: Record<string, string> = Object.entries(PACK_LABELS).reduce(
  (acc, [symbol, label]) => {
    acc[label.toLowerCase()] = symbol;
    return acc;
  },
  {
    'tiger king pack': 'EXOFIVE',
    'tiger king mega pack': 'EXOMEGA',
    'gpk series 1 pack': 'GPKFIVE',
    'gpk mega pack': 'GPKMEGA',
    'gpk series 1 mega pack': 'GPKMEGA',
  } as Record<string, string>,
);

/** Best-effort symbol lookup from a stored display name. */
export function packSymbolFromName(name?: string | null): string | undefined {
  if (!name) return undefined;
  return NAME_TO_SYMBOL[name.trim().toLowerCase()];
}

/**
 * Artwork for a stored history entry. SimpleAssets resolves from the symbol
 * (never the stored URL), everything else falls back to what was recorded.
 */
export function resolvePackArt(
  source: 'simpleassets' | 'atomicassets',
  packId?: string | null,
  packName?: string | null,
  stored?: string | null,
): string | undefined {
  if (source === 'simpleassets') {
    const symbol = (packId && PACK_IMAGES[packId] ? packId : undefined) ?? packSymbolFromName(packName);
    const art = symbol ? PACK_IMAGES[symbol] : undefined;
    if (art) return art;
  }
  return stored || undefined;
}

/** What to persist for `packImage` — drops build-hashed / ephemeral URLs. */
export function storablePackImage(
  source: 'simpleassets' | 'atomicassets',
  packId?: string | null,
  packName?: string | null,
  image?: string | null,
): string | null {
  if (!image) return null;
  if (image.startsWith('blob:') || image.startsWith('data:')) return null;
  if (source === 'simpleassets') {
    const symbol = (packId && PACK_IMAGES[packId] ? packId : undefined) ?? packSymbolFromName(packName);
    if (symbol) return null; // resolvable from the symbol at render time
  }
  return image;
}
