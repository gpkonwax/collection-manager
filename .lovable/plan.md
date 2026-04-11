

## Clean Up: Remove Pointless Tiger Variants from Series 2

### Finding
Tiger Stripe and Tiger Claw are exclusive to the `exotic` schema ("GPK Goes Exotic" collection). No templates in the `series2` schema have these variants. Adding them to `ALLOWED_SCHEMA_VARIANTS.series2` does nothing.

### Change

**`src/hooks/useBinderTemplates.ts`**
- Remove `'tiger stripe'` and `'tiger claw'` from `ALLOWED_SCHEMA_VARIANTS.series2` since no series2 templates use them

```ts
series2: new Set([
  'base', 'raw', 'prism', 'slime', 'gum', 'vhs', 'sketch',
  // tiger stripe and tiger claw removed — they only exist in exotic schema
  'returning', 'error', 'originalart', 'relic', 'promo',
  'collector', 'golden',
]),
```

### Result
- No visible change (those variants weren't matching any series2 templates anyway)
- Cleaner, more accurate configuration

