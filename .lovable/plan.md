

## Add Empty Slots Row at Top of Saved Grid

### Change

**`src/pages/Index.tsx`** — line 399 in `savedGridSlots` memo:

Prepend a row of empty slots (same count as `EXTRA_EMPTY_SLOTS`) to the beginning of the array, in addition to the existing ones at the end:

```typescript
return [...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY), ...trimmed, ...pendingSlots, ...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY)];
```

This gives users empty drop targets at both the top and bottom of their saved layout grid for rearranging cards.

