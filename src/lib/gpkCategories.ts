import { GPK_VARIANT_ORDER, getGpkVariantRank, normalizeGpkVariant } from '@/lib/gpkVariant';

export const CATEGORY_LABELS: Record<string, string> = {
  series1: 'Series 1', series2: 'Series 2', crashgordon: 'Crash Gordon',
  exotic: 'Tiger King', bernventures: 'Bernventures', mittens: 'Mittens',

  gamestonk: 'GameStonk', foodfightb: 'Food Fight', bonus: 'Bonus',
  promo: 'Promo', originalart: 'Original Art', packs: 'Packs',
};

/** Category key for unopened packs (AA schema name / SA pack tokens). */
export const PACKS_CATEGORY = 'packs';

export function isPacksCategory(category: string | undefined): boolean {
  return normalizeAssetCategory((category || '').toLowerCase()) === PACKS_CATEGORY;
}

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

/** Bernventures (template variants on chain: base, raw, sketch, artistsignature, collector). */
export const BERNVENTURES_VARIANTS: VariantOption[] = [
  { value: 'base', label: 'Base' },
  { value: 'raw', label: 'Raw' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'artistssignature', label: "Artist's Signature" },
  { value: 'collector', label: 'Collectors' },
];

/** GameStonk! (base, raw, prism, sketch, artistsignature, golden). */
export const GAMESTONK_VARIANTS: VariantOption[] = [
  { value: 'base', label: 'Base' },
  { value: 'raw', label: 'Raw' },
  { value: 'prism', label: 'Prism' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'artistssignature', label: "Artist's Signature" },
  { value: 'golden', label: 'Golden' },
];

/** Mittens uses rarity tiers instead of print variants. */
export const MITTENS_VARIANTS: VariantOption[] = [
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Epic' },
  { value: 'legendary', label: 'Legendary' },
];

/** Original Art (base, raw, sketch, artistsignature). */
export const ORIGINALART_VARIANTS: VariantOption[] = [
  { value: 'base', label: 'Base' },
  { value: 'raw', label: 'Raw' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'artistssignature', label: "Artist's Signature" },
];

/** Bonus cards are rarity tagged. */
export const BONUS_VARIANTS: VariantOption[] = [
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
];

/** Promo cards (food / sticker promos). */
export const PROMO_VARIANTS: VariantOption[] = [
  { value: 'food', label: 'Food' },
  { value: 'sticker', label: 'Sticker' },
];

/** Categories that expose a variant multi-select filter. */
export const VARIANT_CATEGORIES = [
  'series1', 'series2', 'exotic', 'foodfightb', 'crashgordon',
  'bernventures', 'gamestonk', 'mittens', 'originalart', 'bonus', 'promo',
] as const;

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
    case 'bernventures': return BERNVENTURES_VARIANTS;
    case 'gamestonk': return GAMESTONK_VARIANTS;
    case 'mittens': return MITTENS_VARIANTS;
    case 'originalart': return ORIGINALART_VARIANTS;
    case 'bonus': return BONUS_VARIANTS;
    case 'promo': return PROMO_VARIANTS;
    default: return [];
  }
}

/** Human label for a variant value that has no curated entry. */
export function variantDisplayLabel(value: string): string {
  const special: Record<string, string> = {
    artistssignature: "Artist's Signature",
    originalart: 'Original Art',
    vhs: 'VHS',
    collector: 'Collectors',
  };
  if (special[value]) return special[value];
  return value
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Build the variant option list for a category: the curated list (when one exists)
 * merged with any variants actually present in the supplied data, ordered by
 * rarity rank with unknown variants alphabetical at the end.
 */
export function deriveVariantOptions(category: string, variantValues: Iterable<string>): VariantOption[] {
  const curated = getVariantsForCategory(category);
  const seen = new Set(curated.map(v => v.value));
  const extra: VariantOption[] = [];
  for (const raw of variantValues) {
    const value = normalizeGpkVariant(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    extra.push({ value, label: variantDisplayLabel(value) });
  }
  if (curated.length > 0) {
    extra.sort((a, b) => a.label.localeCompare(b.label));
    return [...curated, ...extra];
  }
  const known = extra.filter(v => getGpkVariantRank(v.value) < GPK_VARIANT_ORDER.length)
    .sort((a, b) => getGpkVariantRank(a.value) - getGpkVariantRank(b.value));
  const unknown = extra.filter(v => getGpkVariantRank(v.value) >= GPK_VARIANT_ORDER.length)
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...known, ...unknown];
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

/**
 * Original Topps descriptions for each card variant, keyed by category then variant value.
 * Shown as a hover popup in the variant dropdown.
 */
export const VARIANT_DESCRIPTIONS: Record<string, Record<string, string>> = {
  series1: {
    base: 'Standard static cards featuring both the "A" and "B" names of all 41 characters from Original Series 1. Base Cards are included in every pack.',
    prism: 'Uncommon cards, these cards feature a prismatic sheen effect; "A" and "B" for all 41 characters.',
    sketch: 'Rare cards that feature an animated transition from original sketches to final art; "A" and "B" for all 41 characters.',
    collector: "Super rare cards with special animations; 4 characters available in \"A\" and \"B\" name.",
    golden: 'Golden Cards were cards sent to winners of special promotions.',
  },
  series2: {
    base: 'Standard static cards featuring "A", "B", and "C" names. Base cards are included in all packs.',
    raw: 'Uncommon cards featuring raw Series 2 art, available in all packs.',
    returning: 'Uncommon cards with reimagined art of Original Series 2 characters, available in all packs.',
    sketch: 'Rare cards that feature an animated transition from original sketches to final art, available in all packs.',
    slime: 'Rare cards that feature an animated slime effect, Standard Pack exclusive.',
    gum: 'Rare cards that feature an animated gum effect, Mega Pack exclusive.',
    vhs: 'Super rare cards that feature an animated VHS static effect, Ultimate Pack exclusive.',
    collector: 'Epic cards with special animations, available in all packs.',
    golden: 'Golden Cards were cards sent to winners of special promotions.',
  },
  exotic: {
    base: 'Standard static cards featuring both the "A" and "B" names of all 15 characters. Base Cards are included in every pack.',
    prism: 'Uncommon cards, these cards feature a prismatic sheen effect; "A" and "B" for all 15 characters.',
    'tiger stripe': 'Rare cards that feature an animated tiger border; "A" and "B" for all 15 characters.',
    'tiger claw': 'Super rare cards that feature an animated tiger scratch effect; "A" and "B" for all 15 characters.',
    collector: 'Super rare cards with special animations; 3 characters available in "A" and "B" name.',
    golden: 'Golden Cards were cards sent to winners of special promotions.',
  },
  crashgordon: {
    base: 'Standard static Crash Gordon cards — the common pull, included in every pack.',
    prism: 'Uncommon cards that feature a prismatic sheen effect over the original art.',
    golden: 'Golden Cards, the rarest Crash Gordon chase pull.',
  },
  foodfightb: {
    base: 'Standard static Food Fight cards, included in every pack.',
    prism: 'Uncommon cards that feature a prismatic sheen effect.',
    sketch: 'Rare cards that feature an animated transition from original sketches to final art.',
    artistssignature: "Super rare cards hand-signed by the artist, showing the artist's signature on the card.",
    golden: 'Golden Cards were cards sent to winners of special promotions.',
  },
  bernventures: {
    base: 'Standard static Bernventures cards — the common pull, included in every pack.',
    raw: 'Uncommon cards featuring the raw, uncoloured line art.',
    sketch: 'Rare cards that feature an animated transition from original sketches to final art.',
    artistssignature: "Super rare cards showing the artist's signature on the card.",
    collector: 'Collector cards with special animations — the rarest Bernventures pull.',
  },
  gamestonk: {
    base: 'Standard static GameStonk! cards, included in every pack.',
    raw: 'Uncommon cards featuring the raw, uncoloured line art.',
    prism: 'Uncommon cards that feature a prismatic sheen effect.',
    sketch: 'Rare cards that feature an animated transition from original sketches to final art.',
    artistssignature: "Super rare cards showing the artist's signature on the card.",
    golden: 'Golden Cards, the rarest GameStonk! chase pull.',
  },
  originalart: {
    base: 'Standard static Original Art cards, the common pull of the set.',
    raw: 'Uncommon cards featuring the raw, uncoloured line art.',
    sketch: 'Rare cards that feature an animated transition from original sketches to final art.',
    artistssignature: "Super rare cards showing the artist's signature on the card.",
  },
  mittens: {
    common: 'The most widely printed Mittens cards — the standard pull.',
    uncommon: 'Less common Mittens cards, a step up from the common tier.',
    rare: 'Rare Mittens cards with a much lower print run.',
    epic: 'Epic Mittens cards — one of the toughest tiers to pull.',
    legendary: 'Legendary Mittens cards, the rarest tier in the set.',
  },
  bonus: {
    common: 'Bonus cards handed out alongside the main sets.',
    uncommon: 'Less common bonus cards with a lower print run.',
    rare: 'Rare bonus cards, the hardest of the bonus drops to find.',
  },
  promo: {
    food: 'Promotional food-themed card issued outside the standard packs.',
    sticker: 'Promotional sticker card issued outside the standard packs.',
  },
};

/** Fallback wording used when a category has no bespoke text for a variant. */
const GENERIC_VARIANT_DESCRIPTIONS: Record<string, string> = {
  base: 'Standard static cards — the common pull, included in every pack.',
  raw: 'Uncommon cards featuring the raw, uncoloured line art.',
  prism: 'Uncommon cards that feature a prismatic sheen effect.',
  sketch: 'Rare cards that feature an animated transition from original sketches to final art.',
  artistssignature: "Super rare cards showing the artist's signature on the card.",
  collector: 'Collector cards with special animations — among the rarest pulls.',
  golden: 'Golden Cards were cards sent to winners of special promotions.',
  relic: 'Relic cards tied to a physical or one-of-a-kind collectible.',
  error: 'Error cards — misprints and mistakes that made it on-chain.',
  originalart: 'Cards showing the original artwork behind the printed card.',
  promo: 'Promotional cards issued outside the standard packs.',
  returning: 'Cards with reimagined art of characters returning from earlier series.',
  common: 'The most widely printed cards in the set — the standard pull.',
  uncommon: 'Less common cards, a step up from the common tier.',
  rare: 'Rare cards with a much lower print run.',
  epic: 'Epic cards — one of the toughest tiers to pull.',
  legendary: 'Legendary cards, the rarest tier in the set.',
};

export function getVariantDescription(category: string, variant: string): string | undefined {
  return VARIANT_DESCRIPTIONS[category]?.[variant] ?? GENERIC_VARIANT_DESCRIPTIONS[variant];
}

const SCHEMA_TO_CATEGORY: Record<string, string> = {
  exotic: 'exotic',
  five: 'series1',
};

/** Map an asset schema/category to the canonical category key used by the filters. */
export function normalizeAssetCategory(category: string | undefined): string {
  return SCHEMA_TO_CATEGORY[category ?? ''] || category || '';
}
