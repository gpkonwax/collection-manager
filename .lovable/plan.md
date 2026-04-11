

## Fix: EXOFIVE/EXOMEGA Pack Browser "Open" Button Does Nothing

### Problem
The `PackBrowserDialog` component has its own `UNBOX_TYPE_MAP` (line 11-13) that only includes `GPKFIVE`, `GPKTWOA`, `GPKTWOB`, `GPKTWOC`. It's missing `EXOFIVE`, `EXOMEGA`, and `GPKMEGA`. Since `unboxType` resolves to `undefined`, the button's `disabled` condition (`!unboxType`) is true, making it unclickable.

### Fix
**File: `src/components/simpleassets/PackBrowserDialog.tsx`** — Add the missing entries to `UNBOX_TYPE_MAP`:

```typescript
const UNBOX_TYPE_MAP: Record<string, string> = {
  GPKFIVE: 'five', GPKMEGA: 'thirty',
  GPKTWOA: 'gpktwoeight', GPKTWOB: 'gpktwo25', GPKTWOC: 'gpktwo55',
  EXOFIVE: 'exotic5', EXOMEGA: 'exotic25',
};
```

This mirrors the identical map already defined in `GpkPackCard.tsx`.

### Scope
Single line change, no other files affected.

