export const GPK_VARIANT_ORDER = [
  'base',
  'raw',
  'prism',
  'slime',
  'gum',
  'vhs',
  'sketch',
  'tiger stripe',
  'tiger claw',
  'returning',
  'error',
  'originalart',
  'relic',
  'collector',
  'golden',
  'promo',
] as const;

/**
 * Normalize the GPK variant field to a consistent lowercase value.
 * In GPK metadata:
 *   - `variant` = visual type: base, prism, sketch, collector, golden
 *   - `quality` = card pair side: a, b (NOT the variant)
 */
export function normalizeGpkVariant(variant: unknown): string {
  const raw = typeof variant === 'string' ? variant.trim().toLowerCase() : '';
  if (!raw) return '';

  const normalized = raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const aliasMap: Record<string, string> = {
    collectors: 'collector',
    gold: 'golden',
    tigerstripe: 'tiger stripe',
    tigerclaw: 'tiger claw',
    'original art': 'originalart',
  };

  return aliasMap[normalized] ?? normalized;
}

export function getGpkVariantRank(variant: string): number {
  const v = normalizeGpkVariant(variant);
  const index = GPK_VARIANT_ORDER.indexOf(v as any);
  return index === -1 ? GPK_VARIANT_ORDER.length : index;
}

export function isGpkGoldVariant(variant: string): boolean {
  return normalizeGpkVariant(variant) === 'golden';
}
