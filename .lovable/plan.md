

## Fix: Allow Tiger King Variants in Both Series 2 and Exotic Binders

### The situation
Tiger King cards likely exist in two places:
- **`exotic` schema** — full Tiger King collection from exotic packs
- **`series2` schema** — Tiger King promo cards that drop from regular Series 2 packs

The previous fix was too aggressive: it removed `exotic` from `EXTRA_SCHEMAS` (correct) but also removed `tiger stripe` and `tiger claw` from the Series 2 allowed variants (potentially wrong).

### Changes

**`src/hooks/useBinderTemplates.ts`**
- Add `'tiger stripe'` and `'tiger claw'` back to `ALLOWED_SCHEMA_VARIANTS.series2` so that any series2-schema templates with those variants still appear in the Series 2 binder
- Keep `EXTRA_SCHEMAS` empty (don't re-add exotic) — this ensures the exotic schema's own cards stay separate

```ts
series2: new Set([
  'base', 'raw', 'prism', 'slime', 'gum', 'vhs', 'sketch',
  'tiger stripe', 'tiger claw',  // ← restored
  'returning', 'error', 'originalart', 'relic', 'promo',
  'collector', 'golden',
]),
```

### Result
- Series 2 binder shows series2-schema cards including any tiger variants that belong there
- Exotic/Tiger King binder shows exotic-schema cards separately (no variant filter, so all pass through)
- No cross-contamination between schemas — each binder only fetches its own schema's templates

