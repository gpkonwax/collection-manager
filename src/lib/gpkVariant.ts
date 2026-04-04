export const GPK_VARIANT_ORDER = ['base', 'prism', 'sketch', 'collectors', 'gold'] as const;

type GpkVariant = (typeof GPK_VARIANT_ORDER)[number];

const QUALITY_TO_VARIANT: Record<string, GpkVariant> = {
  a: 'base',
  b: 'prism',
  c: 'sketch',
  d: 'collectors',
  e: 'gold',
};

export function normalizeGpkVariant(variant: unknown, quality: unknown): string {
  const rawVariant = typeof variant === 'string' ? variant.trim().toLowerCase() : '';
  if (rawVariant) {
    if (rawVariant === 'collector') return 'collectors';
    if (rawVariant === 'golden') return 'gold';
    return rawVariant;
  }

  const rawQuality = typeof quality === 'string' ? quality.trim().toLowerCase() : '';
  if (rawQuality in QUALITY_TO_VARIANT) return QUALITY_TO_VARIANT[rawQuality];
  if (rawQuality === 'collector') return 'collectors';
  if (rawQuality === 'golden') return 'gold';
  return rawQuality;
}

export function getGpkVariantRank(variant: string): number {
  const normalized = normalizeGpkVariant(variant, '');
  const index = GPK_VARIANT_ORDER.indexOf(normalized as GpkVariant);
  return index === -1 ? GPK_VARIANT_ORDER.length : index;
}

export function isGpkGoldVariant(variant: string): boolean {
  return normalizeGpkVariant(variant, '') === 'gold';
}
