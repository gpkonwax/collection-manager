

## Persistent Card Ordering via localStorage + JSON Export/Import

### How it works now
`customOrder` is held in React state — lost on every page reload or filter change.

### What will change

**Auto-save to localStorage:**
- Whenever `customOrder` changes (drag reorder), persist it to `localStorage` keyed by `account + category + source filter` so each view has its own saved order.
- On mount / filter change, load the saved order from `localStorage` instead of defaulting to `null`.
- New cards not in the saved order get appended at the end in their default sorted position.

**Export button ("Save Layout"):**
- Adds a small button next to "Collect Unclaimed" that downloads a `.json` file containing all saved orderings (all categories/filters) for the current account.
- Format: `{ "account": "...", "orders": { "series1__all": ["id1","id2",...], "series2__all": [...] } }`

**Import button ("Load Layout"):**
- Hidden file input that accepts `.json`, parses it, validates structure, writes all orderings into localStorage, and applies the current view's order immediately.

### Files changed

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add localStorage read/write for `customOrder`, export/import buttons + handlers, merge logic for new cards not in saved order |

### Technical details
- Storage key pattern: `gpk-order-${accountName}-${categoryFilter}-${sourceFilter}`
- On filter change: instead of `setCustomOrder(null)`, load from localStorage (fall back to null if none saved)
- Export: `JSON.stringify` all matching `gpk-order-*` keys → `Blob` → download link
- Import: `FileReader` → parse JSON → write each key to localStorage → reload current order
- Stale IDs (sold/transferred cards) are silently filtered out during load

