export const CATEGORY_LABELS: Record<string, string> = {
  series1: 'Series 1', series2: 'Series 2', crashgordon: 'Crash Gordon',
  exotic: 'Tiger King', bernventures: 'Bernventures', mittens: 'Mittens',

  gamestonk: 'GameStonk', foodfightb: 'Food Fight', bonus: 'Bonus',
  promo: 'Promo', originalart: 'Original Art',
};

export interface VariantOption { value: string; label: string }

export const SERIES1_VARIANTS: VariantOption[] = [
  { value: 'base', label: 'Base' },
  { value: 'prism', label: 'Prism' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'collector', label: 'Collectors' },
  { value: 'golden', label: 'Gold' },
];

export const SERIES2_VARIANTS: VariantOption[] = [
  { value: 'base', label: 'Base' },
  { value: 'raw', label: 'Raw' },
  { value: 'slime', label: 'Slime' },
  { value: 'gum', label: 'Gum' },
  { value: 'vhs', label: 'VHS' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'returning', label: 'Returning' },
  { value: 'error', label: 'Error' },
  { value: 'originalart', label: 'Original Art' },
  { value: 'relic', label: 'Relic' },
  { value: 'promo', label: 'Promo' },
  { value: 'collector', label: 'Collectors' },
  { value: 'golden', label: 'Golden' },
];

export const EXOTIC_VARIANTS: VariantOption[] = [
  { value: 'base', label: 'Base' },
  { value: 'prism', label: 'Prism' },
  { value: 'tiger stripe', label: 'Tiger Stripe' },
  { value: 'tiger claw', label: 'Tiger Claw' },
  { value: 'golden', label: 'Golden' },
  { value: 'collector', label: 'Collector' },
];

export const CRASHGORDON_VARIANTS: VariantOption[] = [
  { value: 'base', label: 'Base' },
  { value: 'prism', label: 'Prism' },
  { value: 'golden', label: 'Golden' },
];

export const FOODFIGHT_VARIANTS: VariantOption[] = [
  { value: 'base', label: 'Base' },
  { value: 'prism', label: 'Prism' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'artistssignature', label: "Artist's Signature" },
  { value: 'golden', label: 'Golden' },
];

/** Categories that expose a variant multi-select filter. */
export const VARIANT_CATEGORIES = ['series1', 'series2', 'exotic', 'foodfightb', 'crashgordon'] as const;

export function hasVariants(category: string): boolean {
  return (VARIANT_CATEGORIES as readonly string[]).includes(category);
}

export function getVariantsForCategory(category: string): VariantOption[] {
  switch (category) {
    case 'series1': return SERIES1_VARIANTS;
    case 'exotic': return EXOTIC_VARIANTS;
    case 'foodfightb': return FOODFIGHT_VARIANTS;
    case 'crashgordon': return CRASHGORDON_VARIANTS;
    case 'series2': return SERIES2_VARIANTS;
    default: return [];
  }
}

/**
 * Shared toggle logic for the variant multi-select. Returns the next filter value.
 * Selecting all individual variants (or none) collapses back to ['all'].
 */
export function nextVariantFilter(current: string[], value: string, variants: VariantOption[]): string[] {
  if (value === 'all') return ['all'];
  let next: string[];
  if (current.includes(value)) {
    next = current.filter(v => v !== value && v !== 'all');
  } else {
    next = [...current.filter(v => v !== 'all'), value];
  }
  if (next.length === 0 || next.length === variants.length) return ['all'];
  return next;
}

export function variantFilterLabel(current: string[], variants: VariantOption[]): string {
  if (current.includes('all')) return 'All Variants';
  if (current.length === 1) return variants.find(v => v.value === current[0])?.label ?? current[0];
  return `${current.length} Variants`;
}

const SCHEMA_TO_CATEGORY: Record<string, string> = {
  exotic: 'exotic',
  five: 'series1',
};

/** Map an asset schema/category to the canonical category key used by the filters. */
export function normalizeAssetCategory(category: string | undefined): string {
  return SCHEMA_TO_CATEGORY[category ?? ''] || category || '';
}
