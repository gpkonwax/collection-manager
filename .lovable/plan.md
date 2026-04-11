

## Fix Card Clipping During Deal Animation

### Problem
The card elements in `CardDealAnimation.tsx` have `overflow-hidden` on the wrapper div (line 202), which clips the bottom of the card — particularly the name overlay gradient area.

### Fix (in `src/components/simpleassets/CardDealAnimation.tsx`)

**Restructure the card layout** so the image and overlay don't get clipped:

1. **Remove `overflow-hidden`** from the outer card div and instead apply it only to the image container, keeping the card name overlay inside the bounded area properly.

2. **Make the card wrapper `relative`** so the absolute-positioned name overlay is properly contained within the card's own dimensions rather than potentially overflowing.

3. **Ensure the image fills the card without pushing content out** — use `object-cover` on the `IpfsMedia` element and constrain the image area so the overlay sits within bounds.

The actual change is small — on line 202, replace:
```
className="rounded-lg overflow-hidden border border-border bg-card shadow-xl"
```
with:
```
className="relative rounded-lg border border-border bg-card shadow-xl overflow-hidden"
```

And ensure the `IpfsMedia` uses `object-cover` styling so it fills without distorting. The key fix is adding `relative` positioning context and verifying the image renders with `object-cover` to prevent it from pushing the container taller than the specified height, which causes the bottom to clip against the viewport or parent.

If the root cause is actually that the measured `cardSize.height` is slightly too small (not accounting for the name overlay), we'll also add a small buffer (e.g., +8px) to the stack card height to accommodate the overlay text.

