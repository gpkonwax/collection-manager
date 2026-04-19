
The cache approach is causing thrashing. Likely cause: `getCachedLoadedUrl(hash)` is called in render, then `useEffect` resets state on `[originalUrl, hash]` change. But `cachedLoadedUrl` is read in render — when virtualizer remounts the component, cache hit returns URL → img renders → `onLoad` fires → calls `setCachedLoadedUrl` again → but also `setIsLoading(false)` causes re-render. That alone shouldn't loop.

More likely: `onLoadFinal` depends on `src`, and `src` references `cachedLoadedUrl` which can change between renders if the cache gets evicted. Or — bigger issue — when an image FAILS to load mid-scroll (e.g. browser cancels in-flight request when virtualizer unmounts), `onError` fires → `advance()` rotates gateway → new URL → but we're showing `cachedLoadedUrl` so the state change doesn't reflect... actually wait, `src` only equals `cachedLoadedUrl` when present. If onError fires on the cached URL, advance() runs but src stays at cachedLoadedUrl since cache still has the entry — so it keeps showing same URL, but React re-renders and onError might fire again in a loop.

Actually the real issue is likely simpler: **virtualizer unmounting an in-flight image triggers `onError`** (browser cancels request → error event). That `onError` calls `advance()` which mutates state. Even if component unmounts, state never gets to apply, no harm. But on remount with cached URL, the img element fires load → onLoad → fine. Unless the cache URL itself is broken/cancelled... 

Let me reconsider. The user says "disappearing and reloading over and over". This means the SAME cards visibly toggle between placeholder and image. That's the virtualizer cycling unmount/remount as the user scrolls — and the new render briefly shows nothing before the image element paints.

Actually the simplest fix: **revert the IpfsMedia change**. The hook-level cache is good but the component-level bypass of IntersectionObserver might be causing too many concurrent image fetches when scrolling fast (every offscreen-but-cached card now eagerly attaches an img element). The browser then thrashes / cancels.

Best plan:
1. **Keep the hook-level loaded URL cache** — it ensures any remount uses the proven URL.
2. **Revert the `IpfsMedia.tsx` change** that bypasses IntersectionObserver. Lazy-loading should still apply; but when the lazy gate opens, the hook will immediately use the cached URL (no loading state, no rotation) and the browser HTTP cache serves it instantly.
3. The hook's `enabled=false` path returns `/placeholder.svg` though — this overrides cached URL. Need to fix: if cachedLoadedUrl exists, use it even when not enabled, but DON'T render until visible (the component handles that with `{enabled && <img>}`).

Actually look at IpfsMedia: it already does `{enabled && <img ... />}`. So when not enabled, no img is mounted at all. So whether the hook returns placeholder or cached URL doesn't matter visually. The problem is just that on scroll-back, the IntersectionObserver fires fresh and there's a brief moment before img mounts and paints.

Let me revert the component change and let the hook cache do its thing — when the lazy gate opens, hook returns cached URL with isLoading=false, browser serves from HTTP cache instantly.

### Plan
1. Revert `IpfsMedia.tsx` to original (remove `alreadyLoaded` bypass).
2. Keep hook changes as-is — they correctly skip the loading state when cache exists.
3. The result: on scroll-back, IntersectionObserver still gates rendering (no thrash from too many concurrent fetches), but once visible the cached URL loads instantly from browser HTTP cache.
