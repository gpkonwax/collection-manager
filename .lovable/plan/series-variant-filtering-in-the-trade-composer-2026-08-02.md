# Series + variant filtering in the Trade Composer

Right now the "Propose a trade" dialog only has a plain text search box on each side ("Search name, cardid, id…"). The homepage has much richer controls — series/category dropdown, multi-select variant filter, and sort — which makes finding a specific card far easier.

## What changes

Both card pickers in the trade dialog ("You give" and "They give") get the same filtering toolbar as the homepage:

- **Series/Category dropdown** — All Categories plus every series present in that wallet (Series 1, Series 2, Tiger King, Food Fight, Crash Gordon, etc.), using the same labels as the homepage.
- **Variant multi-select** — appears when a series with variants is chosen (Series 1, Series 2, Tiger King, Food Fight, Crash Gordon), with the same checkbox popover: All Variants plus the per-series variant list (Base, Prism, Sketch, Slime, Gum, VHS, Golden, Collectors, etc.).
- **Sort dropdown** — Natural (Card ID), Name (A–Z), Variant Rarity, matching homepage sort behaviour.
- The existing free-text search box stays, and stacks with the filters.
- A small "N shown / M owned" count and a "Clear filters" reset when any filter is active.

Filters are per-side and independent, so you can browse your Series 2 slimes while their side stays on Series 1. Selected cards stay selected even if a filter hides them — a selected-cards strip above the picker keeps them visible and removable, so filtering can never silently drop part of your offer.

Controls are compact so the two-column dialog stays usable; on narrow screens they wrap into rows.

## Technical notes

- Move the shared filter data out of `src/pages/Index.tsx` into a new `src/lib/gpkCategories.ts`: `CATEGORY_LABELS`, `SERIES1_VARIANTS`, `SERIES2_VARIANTS`, `EXOTIC_VARIANTS`, `CRASHGORDON_VARIANTS`, `FOODFIGHT_VARIANTS`, plus a `getVariantsForCategory(category)` helper and the `hasVariants` check. `Index.tsx` imports from there instead of declaring them locally — no behaviour change on the homepage.
- Extract the variant multi-select popover into a reusable `src/components/simpleassets/VariantFilterPopover.tsx` (props: `category`, `value: string[]`, `onChange`) and use it in both `Index.tsx` and the trade dialog so the toggle/"all" collapse logic lives in one place.
- `src/components/TradeComposerDialog.tsx`: extend `PickerAsset` (already carries `cardid`, `side`, `quality`, `category`) and add local `category`, `variants`, and `sort` state inside `AssetPicker`. Filter with the same predicates the homepage uses (category match via normalized category, variant match against lowercase `quality`), then sort with `getGpkVariantRank` from `src/lib/gpkVariant.ts` for the rarity sort and card-id natural ordering otherwise.
- Category options are derived from the assets actually in that picker, so empty series never appear.
- No changes to trade building, validation, or signing — `atomicTradeActions.ts` is untouched.
