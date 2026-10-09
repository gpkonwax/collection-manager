import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import { getGpkVariantRank } from '@/lib/gpkVariant';
import { getMintLabel } from '@/lib/mintPresentation';

/** Order copies of one card by original mint (never bridge mint); unresolved (#--) last. */
export function compareByOriginalMint(a: SimpleAsset, b: SimpleAsset): number {
  const mintA = Number(getMintLabel(a).slice(1));
  const mintB = Number(getMintLabel(b).slice(1));
  const validA = Number.isFinite(mintA) && mintA > 0;
  const validB = Number.isFinite(mintB) && mintB > 0;
  if (validA && validB) return mintA - mintB;
  if (validA) return -1;
  if (validB) return 1;
  return 0;
}

/** Natural grid order: card number, side, variant, then original mint for copies of one card. */
export function compareNaturalCards(a: SimpleAsset, b: SimpleAsset): number {
  // Match card identity before parsing its number: some collections use
  // non-numeric IDs, and metadata casing can differ across SA and AA copies.
  const sameCard = a.category.toLowerCase() === b.category.toLowerCase() &&
    a.cardid.toLowerCase() === b.cardid.toLowerCase() &&
    (a.side || '').toLowerCase() === (b.side || '').toLowerCase() &&
    a.quality.toLowerCase() === b.quality.toLowerCase();
  if (sameCard) return compareByOriginalMint(a, b);

  const numA = parseInt(a.cardid, 10);
  const numB = parseInt(b.cardid, 10);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
    if (numA !== numB) return numA - numB;
    const sideDiff = (a.side || '').localeCompare(b.side || '');
    if (sideDiff !== 0) return sideDiff;
    const rankDiff = getGpkVariantRank(a.quality) - getGpkVariantRank(b.quality);
    if (rankDiff !== 0) return rankDiff;
    const variantDiff = a.quality.localeCompare(b.quality);
    if (variantDiff !== 0) return variantDiff;

    // Same number, side and variant: copies may carry different category
    // labels on SA vs AA (e.g. Tiger King), so order by original mint.
    const mintDiff = compareByOriginalMint(a, b);
    if (mintDiff !== 0) return mintDiff;
    return a.category.localeCompare(b.category);
  }
  if (!Number.isNaN(numA)) return -1;
  if (!Number.isNaN(numB)) return 1;
  try {
    const idA = BigInt(a.id);
    const idB = BigInt(b.id);
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  } catch {
    return a.id.localeCompare(b.id);
  }
}