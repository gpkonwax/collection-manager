

## Move Completion Bar & Add Variant-Level Filtering

### Changes

**1. `src/hooks/useCollectionCompletion.ts`** — Store per-variant template counts

- Change `fetchTemplateTotals` to return per-category AND per-variant counts: `Record<string, { total: number; byVariant: Record<string, number> }>`
- While iterating templates, track counts per normalized variant within each category
- Update the `completion` memo to accept a `variantFilter: string[]` parameter
- When variant filter is active (not `['all']`), sum only the matching variant template counts for the total, and only count owned assets whose quality matches the selected variants
- When variant-filtered, exclude packs from the calculation (packs aren't variant-specific)

**2. `src/pages/Index.tsx`** — Pass variant filter & relocate the bar

- Pass `variantFilter` to `useCollectionCompletion`
- Move the completion bar block (lines 1083-1100) to render below the variant dropdown and above the "Copy to Saved" row — specifically inserting it between the filter row (line 1206, end of `</div>`) and the tabs row (line 1208)
- Keep same styling: cheese-colored label, progress bar, owned/total count

### Behavior
- **No variant filter active** (or non-series category): shows full category completion including packs
- **Variant filter active** (e.g. "Base" selected on Series 1): shows completion for only base variant templates; packs excluded from count since they aren't variant-specific
- **"All Categories"**: shows overall completion across everything

