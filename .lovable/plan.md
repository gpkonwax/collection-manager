

## Fix: Binder images failing at scale + variant ordering

### Problem 1: Images fail after 300-350 items
All binder placeholder images use `loading="eager"`, which forces the browser to request all 600+ IPFS images simultaneously. Browsers limit concurrent connections to ~6 per domain, so images beyond ~300 queue up. Their 6-8s timeouts fire before the browser even starts the request, causing them to fail immediately despite the gateway being healthy.

**Fix**: Replace `loading="eager"` with lazy loading via IntersectionObserver. Only start loading images when they're within ~400px of the viewport. This limits concurrent IPFS requests to ~20-30 at a time.

- **`src/components/simpleassets/MissingCardPlaceholder.tsx`**: Remove `loading="eager"`, add `loading="lazy"` (or default)
- **`src/components/simpleassets/IpfsMedia.tsx`**: Add IntersectionObserver support — when `loading="lazy"`, defer setting the `src` attribute until the element is near the viewport. This prevents the `useIpfsMedia` hook from starting its timeout countdown until the image is actually visible.
- **`src/hooks/useIpfsMedia.ts`**: Accept an `enabled` flag (default true). When false, don't start any gateway rotation or timeouts. The IpfsMedia component sets this based on intersection visibility.

### Problem 2: Sketch/VHS variants sorted separately
The exotic schema templates (sketch, VHS, tiger stripe, tiger claw) may have different `cardid` values or the sort is treating them separately from the main `series2` schema templates. The current sort is: cardid → quality(a/b side) → variant rank.

**Fix**: The sort logic in `useBinderTemplates.ts` already sorts by cardid then variant rank, which should group all variants of the same card together. Need to verify that exotic schema templates actually have matching cardid values. If they do, the sort is correct. If sketch/VHS templates lack cardids, they'll be sorted by templateId at the bottom.

- **`src/hooks/useBinderTemplates.ts`**: Add a console.log to check exotic template cardids during development, then ensure the sort groups by `cardid + quality(side)` as primary key, with variant as secondary — which is what it already does. No change needed if cardids match.

### Files to modify
1. **`src/hooks/useIpfsMedia.ts`** — Add `enabled` option, skip gateway rotation when disabled
2. **`src/components/simpleassets/IpfsMedia.tsx`** — Add IntersectionObserver, pass `enabled` to useIpfsMedia based on visibility
3. **`src/components/simpleassets/MissingCardPlaceholder.tsx`** — Remove `loading="eager"`
4. **`src/hooks/useBinderTemplates.ts`** — Add temporary diagnostic log for exotic schema cardids to confirm sort correctness

### Expected result
- Only ~20-30 images load at a time as user scrolls, preventing mass timeouts
- All variants of the same card number appear grouped together in the binder

