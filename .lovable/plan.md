
The user is seeing `/placeholder.svg` (the Lovable default placeholder showing "your app will live here") replacing successfully-loaded NFT images when they scroll back.

## Root cause

In `useIpfsMedia.ts`:

```ts
const ready = enabled && (hasLoadedOnce || hasSlot || failed || !hash);

let src: string;
if (!enabled) {
  src = '/placeholder.svg';
} else if (failed || !originalUrl) {
  src = '/placeholder.svg';
} else if (hash) {
  src = `${IPFS_GATEWAYS[gwIdx]}${hash}`;
}
```

And in `IpfsMedia.tsx`, lazy-loaded cards toggle `enabled` based on `IntersectionObserver` visibility:

```ts
const enabled = loading === 'eager' || context === 'detail' || isVisible;
```

But `isVisible` is set to `true` once and the observer disconnects — so that part is fine. **However**, the `<img>` tag is only rendered `{ready && (...)}`. When the user scrolls away and back, here's what's happening:

1. The card was loaded → `hasLoadedOnce = true`, slot was released.
2. The component stays mounted (no unmount), so the image *should* persist.
3. **BUT**: The browser, under memory pressure with hundreds of images, evicts decoded image data. When the `<img>` re-enters the viewport, the browser tries to re-fetch from `src`.
4. Meanwhile — and this is the actual bug — when the URL prop is referentially identical but a re-render occurs, the **reset effect** keyed on `[originalUrl, hash]` doesn't fire, but the slot acquisition effect can re-evaluate. If `hasSlot` is false and `hasLoadedOnce` is true, `ready` is still true so the `<img>` renders. That's correct.

The real culprit: **the `placeholder.svg` is being served as the actual image source somewhere it shouldn't be.** Looking again:

The session replay shows:
```
Image loaded (Element ID: 6540) - Source: .../placeholder.svg
Image loaded (Element ID: 6534) - Source: .../placeholder.svg
```

These are firing **after** real IPFS images succeeded. This means either:
- `failed` is being set to true on previously-loaded images (gateway timeout retry firing on an already-loaded `<img>`), OR
- The `BackgroundDecorations` / other components also use `/placeholder.svg` and we're misreading, OR
- `originalUrl` becomes undefined transiently during a re-render (e.g. asset list refetch), causing the `failed || !originalUrl` branch to fire.

Most likely: **the timeout effect is still firing on already-loaded images.** Look at the timeout effect dependency array — it depends on `isLoading`. After load, `isLoading` is set to `false`, but if `originalUrl` momentarily changes (asset refetch swaps array references), the **reset effect** runs and sets `setIsLoading(true)` and `setHasLoadedOnce(false)` — wiping the loaded state and causing the placeholder to show.

The reset effect:
```ts
useEffect(() => {
  const newStart = getCachedGatewayIndex(hash);
  setGwIdx(newStart);
  setTriedCount(0);
  setFailed(false);
  setIsLoading(true);
  setHasLoadedOnce(false);  // ← wipes loaded state
}, [originalUrl, hash]);
```

If `originalUrl` is the same string but the asset object is replaced (e.g. polling refetch), React re-runs this. But strings compared by `===` shouldn't trigger this. **Unless the parent passes a new URL string each render.** Looking at `SimpleAssetCard` → `IpfsMedia url={asset.images[0]}` — `asset.images` is rebuilt on every `useSimpleAssets` refetch via `resolveAllImages`, producing new string instances. Strings still compare by value in dep arrays, so this shouldn't fire.

But `hash` is computed inline: `const hash = originalUrl ? extractIpfsHash(originalUrl) : null;` — same value, same identity. Should be stable.

**The real issue**: When the user scrolls back, the browser has discarded the decoded image. The `<img>` element re-requests the URL. If the gateway is now slow/down, our `onError` fires → `advance()` → eventually `failed = true` → `src = /placeholder.svg`. The Lovable placeholder is being shown for **previously-loaded images that the browser had to re-fetch** but failed second time around.

## Fix

Two parts:

1. **Stop using `/placeholder.svg` as the failure fallback.** That file is the Lovable-branded "your app will live here" SVG. Replace with either:
   - A neutral broken-image placeholder (a small inline SVG with a card silhouette / question mark), OR
   - Keep the last successfully-loaded gateway URL pinned and don't swap to placeholder unless the image truly never loaded.

2. **Don't reset `hasLoadedOnce` on re-renders unless URL actually changed.** Once an image has loaded successfully for a given hash, treat it as cached — even if the parent triggers a re-render with a "new" URL string for the same hash.

Concretely:
- Create `public/card-fallback.svg` — a neutral dark card-shaped placeholder that matches the Dark Cheese aesthetic (no Lovable branding).
- In `useIpfsMedia.ts`, replace both `/placeholder.svg` references with `/card-fallback.svg` (and update the BASE_URL prefix consistently).
- Add a guard so when an image has already loaded once for a hash, browser-driven re-fetches don't cascade through every gateway again — pin to the cached gateway and only retry once.

## Files to change

- `public/card-fallback.svg` — new neutral placeholder (dark grey card silhouette, subtle "image unavailable" icon, no branding)
- `src/hooks/useIpfsMedia.ts` — swap `/placeholder.svg` → `${import.meta.env.BASE_URL}card-fallback.svg`; on re-fetch after `hasLoadedOnce`, retry the cached gateway once before falling back

## What you'll see after

- No more Lovable "your app will live here" art replacing NFT images
- Failed/missing IPFS images show a neutral dark card placeholder that fits the theme
- Scroll-back re-fetches are more resilient: previously-loaded images stick to their known-good gateway

