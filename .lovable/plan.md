

## Multi-Select Variant Filtering

### What changes
The current single-select variant dropdown becomes a multi-select popover with checkboxes, allowing users to pick any combination of variants (from one up to all-minus-one individually, plus an "All" option). When "All" is selected, individual selections are cleared. When all individual variants are checked, it auto-reverts to "All."

### Implementation

**`src/pages/Index.tsx`**

1. **State change**: Replace `variantFilter: string` with `variantFilter: string[]` initialized to `['all']`.

2. **Filter UI**: Replace the `<Select>` dropdown (lines 747-753) with a `<Popover>` containing a scrollable list of `<Checkbox>` items for each variant. The trigger button shows "All Variants" or a count like "3 Variants" or the single variant name.

3. **Toggle logic**:
   - Clicking "All Variants" checkbox sets state to `['all']` and unchecks individuals.
   - Clicking an individual variant toggles it in/out of the array.
   - If all individual variants become selected, auto-switch to `['all']`.
   - If unchecking the last individual variant, revert to `['all']`.

4. **Filter logic** (lines 412, 440-441): Update the comparison from single-string match to `variantFilter.includes('all') || variantFilter.includes(a.quality.toLowerCase())`.

5. **Category change handler** (line 739): Reset to `['all']` when switching categories.

6. **Dependencies**: Uses existing `Popover`, `Checkbox` components already in the project — no new packages needed.

### Files touched
- `src/pages/Index.tsx` — state type, filter logic, UI component swap

