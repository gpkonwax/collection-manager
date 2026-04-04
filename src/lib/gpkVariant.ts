export const GPK_VARIANT_ORDER = ['base', 'prism', 'sketch', 'collector', 'golden'] as const;

/**
 * Normalize the GPK variant field to a consistent lowercase value.
 * In GPK metadata:
 *   - `variant` = visual type: base, prism, sketch, collector, golden
 *   - `quality` = card pair side: a, b (NOT the variant)
 */
export function normalizeGpkVariant(variant: unknown): string {
  const raw = typeof variant === 'string' ? variant.trim().toLowerCase() : '';
  return raw;
}

export function getGpkVariantRank(variant: string): number {
  const v = variant.toLowerCase();
  const index = GPK_VARIANT_ORDER.indexOf(v as any);
  return index === -1 ? GPK_VARIANT_ORDER.length : index;
}

export function isGpkGoldVariant(variant: string): boolean {
  return variant.toLowerCase() === 'golden';
}
