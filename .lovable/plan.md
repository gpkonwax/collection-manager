

## Add Per-Category Refresh Button

### Updated Mapping

Based on your feedback, here's the corrected category → data source mapping:

| Category | Refetch |
|---|---|
| `series1`, `series2`, `exotic` | Both `refetchSa()` + `refetchAa()` |
| All other AA-only categories | `refetchAa()` only |
| `all` | Both `refetchSa()` + `refetchAa()` |

Series 1, Series 2, and Exotic (Tiger King) exist across both SimpleAssets and AtomicAssets contracts, so they need dual refresh.

### Changes

**`src/pages/Index.tsx`** — single file edit:

1. Import `RefreshCw` from lucide-react (if not already imported).

2. Add a `handleCategoryRefresh` callback:
```tsx
const handleCategoryRefresh = useCallback(() => {
  const needsBoth = ['all', 'series1', 'series2', 'exotic'];
  if (needsBoth.includes(categoryFilter)) {
    refetchSa();
    refetchAa();
  } else {
    refetchAa();
  }
}, [categoryFilter, refetchSa, refetchAa]);
```

3. Add a ghost icon button immediately after the category `<Select>`, styled with the cheese theme and a spin animation while loading:
```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={handleCategoryRefresh}
  className="text-cheese hover:text-cheese/80"
  title="Refresh category"
>
  <RefreshCw className={cn("h-4 w-4", (saLoading || aaLoading) && "animate-spin")} />
</Button>
```

The spin shows whenever either source is loading, giving clear feedback that the refresh is in progress.

