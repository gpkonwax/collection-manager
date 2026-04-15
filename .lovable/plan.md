

## Fix Placeholder Banner on GitHub Pages

The placeholder banner image path is hardcoded as `/cheese-banner-placeholder.png`. On GitHub Pages, the app lives under `/collection-manager/`, so root-relative paths miss the subpath and return 404.

### Change

In `src/components/BannerAd.tsx`, line 10, replace the hardcoded path with a Vite-aware base path:

```tsx
// Before
const PLACEHOLDER_IMAGE = '/cheese-banner-placeholder.png';

// After
const PLACEHOLDER_IMAGE = `${import.meta.env.BASE_URL}cheese-banner-placeholder.png`;
```

`import.meta.env.BASE_URL` resolves to `/collection-manager/` in production (matching `vite.config.ts` base) and `/` in dev, so it works in both environments.

