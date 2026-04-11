

## Remove Tiger King Cards from Series 2 Binder

### Root cause

In `src/hooks/useBinderTemplates.ts`, the constant `EXTRA_SCHEMAS` tells the series2 binder to also fetch templates from the `exotic` schema:

```ts
const EXTRA_SCHEMAS: Record<string, string[]> = {
  series2: ['exotic'],
};
```

This was intentional when exotic was lumped under series2, but now that exotic has its own category, these cards should only appear in the exotic/Tiger King binder.

### Changes

**`src/hooks/useBinderTemplates.ts`**

1. Remove `exotic` from `EXTRA_SCHEMAS.series2` (or remove the series2 entry entirely)
2. Add allowed variants for the `exotic` schema so the exotic binder works correctly:
   ```ts
   ALLOWED_SCHEMA_VARIANTS: {
     exotic: new Set(['base', 'tiger stripe', 'tiger claw', ...]),
   }
   ```
   — need to check what variants actually exist in the exotic schema to set this correctly. If unsure, omit the exotic entry so all exotic templates pass through unfiltered.
3. Remove `EXOTIC_ONLY_VARIANTS` filtering since it's no longer needed (exotic templates won't be mixed into series2)

### Result
- Series 2 binder shows only series2 cards (no tiger stripe/tiger claw)
- Selecting "Tiger King" in the dropdown shows exotic cards in both Classic View and Collector Binder

