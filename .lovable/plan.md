

## Add `originalart` and `promo` as Standalone Categories + Move `bonus` to Bottom

### Research Findings

- **Original Art** (`originalart` schema): 2,467 assets across ~10+ templates. Cards have `cardid`, `quality` (a/b side), `variant` (base), `series`, `illustrator`, `colorist` fields. Created Feb 2021. **No associated pack contract** — these were distributed via AtomicHub drops or secondary market purchases, not openable packs.

- **Promo** (`promo` schema): 1,955 assets across 2 templates ("Bernie Sticker" variant:sticker, "Bubble Gum" variant:food). Created Feb 2021 alongside Bernventures/Mittens. **No pack contract** — these were airdropped or given as bonuses with other purchases.

- **Bonus** (`bonus` schema): Already in the labels map but currently sorts alphabetically among other categories.

None of these three categories have openable packs, so no pack integration is needed.

### What's Already Working

The `useGpkAtomicAssets` hook already fetches ALL gpk.topps schemas (no schema filter), so assets from `originalart`, `promo`, and `bonus` already load into the collection. They just need proper category ordering and collection completion support.

### Changes

**1. `src/pages/Index.tsx`** — Update category sort priority

The `categories` memo currently prioritizes `['all', 'series1', 'series2', 'exotic']` and sorts the rest alphabetically. Change the priority array to place `bonus`, `originalart`, and `promo` at the end:

```tsx
const priority = [
  'all', 'series1', 'series2', 'exotic',
  'crashgordon', 'bernventures', 'mittens', 'gamestonk', 'foodfightb',
  'bonus', 'originalart', 'promo',
];
```

This gives explicit ordering to all known categories instead of relying on `localeCompare` for the tail.

**2. `src/hooks/useCollectionCompletion.ts`** — Add completion tracking

Add `originalart` and `promo` to `CATEGORY_SCHEMAS` so the completion bar works for them:

```tsx
const CATEGORY_SCHEMAS: Record<string, string[]> = {
  // ...existing entries...
  originalart: ['originalart'],
  promo: ['promo'],
  bonus: ['bonus'],
};
```

No `ALLOWED_SCHEMA_VARIANTS` entry needed for these — they have no variant filtering (all templates count).

**3. `src/hooks/useBinderTemplates.ts`** — Enable binder view

The binder already works for any schema dynamically via `getTemplatesBySchema`. No code change needed here — it will fetch templates for `originalart` and `promo` when selected in binder mode, since there's no variant whitelist restriction blocking them.

### Summary

- 3 lines added to category priority array in `Index.tsx`
- 3 lines added to `CATEGORY_SCHEMAS` in `useCollectionCompletion.ts`
- No pack opening support needed (none exist for these categories)
- Binder view works automatically

