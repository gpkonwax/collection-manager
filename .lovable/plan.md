

## Fix mismatched NFT count between header and "Show More" button

### Problem

The header shows `filtered.length` (99 — actual NFTs), but the "Show More" button shows `gridSlots.length` which includes 6 extra empty drag-and-drop placeholder slots (`EXTRA_EMPTY_SLOTS = 6`), making it say 105.

### Fix

**`src/pages/Index.tsx`** — Update the "Show More" button (line 978) to use `filtered.length` instead of `gridSlots.length` for the total count display:

```typescript
// Before:
Show More ({Math.min(visibleCount, gridSlots.length)} of {gridSlots.length})

// After:
Show More ({Math.min(visibleCount, filtered.length)} of {filtered.length})
```

Also update the visibility condition (line 971) to compare against `filtered.length` so the button hides once all real NFTs are visible:

```typescript
// Before:
{gridSlots.length > visibleCount && (

// After:
{filtered.length > visibleCount && (
```

### Files touched
- `src/pages/Index.tsx` (2 small edits on lines 971 and 978)

