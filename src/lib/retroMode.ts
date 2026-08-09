import { normalizeAssetCategory } from '@/lib/gpkCategories';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

/** Categories/schemas that map to Series 1 or Series 2 artwork. */
const RETRO_CATEGORIES = new Set(['series1', 'series2', 'five', 'thirty']);

/** CSS class that applies the 1985 scan colour grade. */
export const RETRO_CLASS = 'retro-grade';

/** True when the asset is a Series 1 or Series 2 card (SA category or bridged AA schema). */
export function isRetroEligible(asset: Pick<SimpleAsset, 'category'> | null | undefined): boolean {
  if (!asset) return false;
  const raw = String(asset.category || '').toLowerCase();
  return RETRO_CATEGORIES.has(raw) || RETRO_CATEGORIES.has(normalizeAssetCategory(raw));
}
