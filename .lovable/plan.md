

## Series 2 Binder: Group by Card Title with Row Padding

### What changes
In Series 2 binder view only, instead of rendering all cards in a continuous grid, group cards by their card title (derived from `cardid` — cards sharing the same numeric ID like 1a base, 1b prism all share the same title). Each title group starts on a new row of 6 columns. If a group has fewer than 6 slots (or fewer than 12 for larger groups), the remaining cells in the row are left empty. This produces rows of varying visible lengths (6, 4, 6, 5, etc.) while maintaining the 6-column grid.

### Implementation

**`src/pages/Index.tsx`** — Modify the Series 2 binder rendering

1. Add a helper function `groupByCardTitle` that takes the binder grid items and groups them by `cardid` (numeric part). Items with the same `cardid` belong to the same title group.

2. For each group, pad the items array to the next multiple of 6 (so each title fills complete rows). Padding cells render as empty/invisible spacers.

3. Replace the current `renderGrid` call for regular items (in the Series 2 branch) with a version that iterates over these grouped+padded items. The grid stays `grid-cols-6` but each title group is visually separated by starting on a fresh row.

4. This applies **only** when `categoryFilter === 'series2'` and `binderView` is active. Series 1 and other categories continue using the current continuous grid.

### Technical detail

```text
// Pseudocode for grouping
const groups = Map<cardid, binderSlot[]>  // group by numeric cardid
for each group:
  render items in group
  if group.length % 6 !== 0:
    render (6 - group.length % 6) empty spacer divs
```

The spacer divs will be invisible `<div />` elements occupying grid cells, ensuring the next group starts on a new row. A small title label above each group (showing the card name) could optionally be added for clarity.

### Files touched
- `src/pages/Index.tsx` — grouping logic + modified render for Series 2 binder

