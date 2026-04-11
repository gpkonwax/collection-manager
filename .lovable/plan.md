

## Fix Card Clipping During Deal Animation

### Problem
Cards in the deal animation stack are clipped at the bottom. The card container is set to the exact grid cell dimensions with `overflow-hidden`, and the name overlay at the bottom can make it look like content is being cut off. The image fills `w-full h-full` but needs a bit of breathing room for the bottom overlay.

### Solution
Two small changes in `src/components/simpleassets/CardDealAnimation.tsx`:

1. **Add `relative` to the card container** so the absolute-positioned name overlay is properly contained
2. **Make the image not fill the full height** — use `object-cover` on the image and reserve space for the name overlay by adjusting the image area, or simply add slight padding at the bottom of the card height calculation

Specifically:
- On the card wrapper div (line 201-202), add `relative` to the className
- Change the image from `className="w-full h-full"` to `className="w-full h-full object-cover"` to ensure proper scaling
- Add a small buffer (e.g. 8px) to the card height in the stack to prevent bottom clipping: change `height: cardSize.height` to `height: cardSize.height + 8` for the stack position, or adjust `STACK_Y` slightly

The simplest effective fix: increase the rendered card height by a few pixels so the bottom border and overlay aren't clipped, and ensure `object-cover` is applied to the media so the image scales correctly within the taller container.

### File Changed
- `src/components/simpleassets/CardDealAnimation.tsx`

