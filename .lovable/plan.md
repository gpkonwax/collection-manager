## Fix Show Received Cards thumbnails

**Problem:** The "Show Received Cards" audit panel renders each thumbnail as a plain `<img src={asset.image} loading="lazy" />` at `src/pages/Index.tsx:1453`. This bypasses every IPFS resilience feature the rest of the app uses (gateway rotation, timeout escalation, retry rounds, cached known-good URL, parallel race prefetch). If the first gateway is slow or dead for a hash, the thumbnail never appears.

**Fix:** Swap the raw `<img>` for the shared `IpfsMedia` component (already used by every card view). Use `context="card"` with `showSkeleton` and preserve the current thumbnail box size.

### Change
File: `src/pages/Index.tsx`

Replace the plain `<img>` inside the `packAudit.assets.map(...)` block (~line 1453) with:

```tsx
<div className="h-16 w-12 flex-shrink-0 rounded-sm bg-muted overflow-hidden">
  <IpfsMedia
    url={asset.image}
    alt={asset.name}
    context="card"
    showSkeleton
    className="h-full w-full"
  />
</div>
```

`IpfsMedia` is already imported/used elsewhere in the project (`src/components/simpleassets/IpfsMedia.tsx`); add the import to `Index.tsx` if not present.

### Why this matches the rest of the app
`IpfsMedia` → `useIpfsMedia` gives us:
- Sequential rotation through `IPFS_GATEWAYS` with per-gateway timeout escalation
- Sticky known-good URL cache (`loadedUrlCache`) so re-mounts render instantly
- Up to 10 retry rounds with exponential backoff
- Placeholder fallback + skeleton while loading
- IntersectionObserver-based lazy loading (already the default for `context="card"`)

No other logic changes — this is a presentation-only swap in the received-cards panel.