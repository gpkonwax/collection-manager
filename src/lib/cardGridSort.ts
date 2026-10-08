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

    // The same card number can occur in different collections. Only compare
    // mints when the series and the full card ID match as well.
    if (a.category === b.category && a.cardid === b.cardid) {
      const mintA = Number(getMintLabel(a).slice(1));
      const mintB = Number(getMintLabel(b).slice(1));
      const validA = Number.isFinite(mintA) && mintA > 0;
      const validB = Number.isFinite(mintB) && mintB > 0;
      if (validA && validB) return mintA - mintB;
      if (validA) return -1;
      if (validB) return 1;
    }
    return 0;
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