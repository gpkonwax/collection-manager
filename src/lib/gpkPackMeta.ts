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
