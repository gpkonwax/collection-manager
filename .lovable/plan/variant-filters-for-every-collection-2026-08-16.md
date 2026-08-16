# Variant filters for every collection

Today only Series 1, Series 2, Tiger King (Exotic), Food Fight and Crash Gordon show the variant dropdown. Bernventures, Mittens, GameStonk, Bonus, Promo, Original Art and any future series show no variant filter at all, because the variant lists are hardcoded in `src/lib/gpkCategories.ts` and `hasVariants()` only allows those five categories.

## What changes

- Every category that actually has more than one variant among the cards on screen gets the same variant multi-select dropdown, with the same checkbox popover, "All Variants" option and hover descriptions where descriptions exist.
- For categories without a curated list (Bernventures, Mittens, GameStonk, Bonus, Promo, Original Art, and anything new), the variant options are discovered from the cards currently loaded in that wallet, so the list always matches what the collection really contains — nothing invented, nothing missing.
- Discovered variants are shown with tidy display labels (e.g. `tiger stripe` -> Tiger Stripe, `artistssignature` -> Artist's Signature) and ordered by the existing rarity order, with unknown variants alphabetical at the end.
- Curated lists stay authoritative for Series 1, Series 2, Exotic, Food Fight and Crash Gordon, so those dropdowns keep their exact current contents and ordering. If a wallet holds a variant not in a curated list, it is appended so it can still be filtered.
- If a category has zero or only one distinct variant, the dropdown stays hidden (no pointless one-option filter).
- Same behaviour in both places that filter cards: the homepage toolbar and the trade composer's two card pickers, each derived from that picker's own assets.

## Technical notes

- `src/lib/gpkCategories.ts`: add `deriveVariantOptions(category, variantValues: Iterable<string>)` that merges the curated list for the category (if any) with normalized values seen in the data, dedupes, and sorts with `getGpkVariantRank` from `src/lib/gpkVariant.ts` (unknown ranks alphabetical last). Add `variantDisplayLabel(value)` for title-casing derived values, plus the alias-specific labels. Keep `getVariantsForCategory` unchanged for existing callers such as `TradesDialog.tsx`.
- `src/components/simpleassets/VariantFilterPopover.tsx`: accept an optional `variants?: VariantOption[]` prop; when supplied use it instead of `getVariantsForCategory(category)`. Render nothing when fewer than two options. Descriptions still come from `getVariantDescription`.
- `src/pages/Index.tsx`: build a memo of the distinct normalized `quality` values in the currently visible category (from the same asset array the grid uses, before variant filtering), pass `deriveVariantOptions(...)` into `VariantFilterPopover`, and replace the `hasVariants(categoryFilter)` gate with "derived options length > 1". Reset `variantFilter` to `['all']` on any category change rather than the current hardcoded four-category check on line 3041.
- `src/components/TradeComposerDialog.tsx`: same treatment inside `AssetPicker` — derive options from that picker's assets for the selected category, drop the `hasVariants(category)` gates on lines 181, 194 and 246 in favour of the derived list, and keep the existing lowercase `quality` matching for the filter predicate.
- Packs category keeps its current behaviour (no variant filter) unless pack assets expose distinct variants, in which case the same rule applies.
- No changes to fetching, trade building, or sorting logic.
