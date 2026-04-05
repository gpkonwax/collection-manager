

## Fix: Sketch/VHS variants sorting out of place in Series 2 binder

### Root cause

The binder fetches both `series2` and `exotic` schemas. The `exotic` schema contains its own sketch and VHS templates, but these have different `cardid` values than the `series2` versions. Both pass the `ALLOWED_SCHEMA_VARIANTS` filter, so the exotic duplicates appear as separate entries and sort to the wrong position (around slot 500+).

The series2 schema already has the correct sketch and VHS templates with proper cardids. The exotic schema should only contribute tiger stripe and tiger claw variants, which are exclusive to it.

### Fix

**`src/hooks/useBinderTemplates.ts`**

After fetching exotic schema templates, filter them to only keep variants that are exclusive to the exotic schema (tiger stripe, tiger claw). Discard any sketch, VHS, or other variants from exotic that already exist in series2.

Add a constant:
```
const EXOTIC_ONLY_VARIANTS = new Set(['tiger stripe', 'tiger claw']);
```

After collecting all templates and parsing them, filter out exotic-schema templates whose normalized variant is not in `EXOTIC_ONLY_VARIANTS`. This prevents duplicate sketch/VHS entries with wrong cardids from polluting the sort.

Also remove the temporary diagnostic logging since it's served its purpose.

### Single file change
- `src/hooks/useBinderTemplates.ts`

### Result
Sketch and VHS cards with valid cardids (e.g., cardid 42) sort in their correct position alongside base, prism, etc. Tiger stripe/claw still load from exotic schema.

