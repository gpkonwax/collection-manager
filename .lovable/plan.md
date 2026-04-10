

## Fix: Saved JSON Losing Card Positions in Empty Slots

### Problem
When you drag cards into the empty slots at the top or bottom, the export strips **all** `EMPTY` markers (`savedOrder.filter(id => id !== EMPTY)`). On re-import, it blindly prepends/appends full rows of empty slots. This means any cards you placed in the padding rows lose their relative position — they get pushed back down below a full empty row.

### Solution
Change the export to only strip **leading and trailing** empty slots, preserving any `EMPTY` markers that sit between (or adjacent to) real cards. This keeps the grid structure intact.

### Changes to `src/pages/Index.tsx`

**Line 408** — Replace:
```typescript
const cleanOrder = savedOrder.filter(id => id !== EMPTY);
```
With:
```typescript
// Strip only leading and trailing EMPTY slots, preserve interior ones
const firstReal = savedOrder.findIndex(id => id !== EMPTY);
const lastReal = savedOrder.findLastIndex(id => id !== EMPTY);
const cleanOrder = firstReal === -1 ? [] : savedOrder.slice(firstReal, lastReal + 1);
```

This way if you move 2 cards up into the top empty row, the exported JSON will contain those EMPTYs in context (e.g. `["EMPTY","EMPTY","card1","card2","EMPTY",...]`), and on import the padding rows get re-added around this preserved structure, keeping everything aligned.

### File changes
- **`src/pages/Index.tsx`**: ~3-line edit at line 408.

