

## Add Card Deal Animation to Collector Binder View

### Overview
Currently, the card deal animation only works in the Classic view because only that view registers `gridCellRefs` for each card slot and renders placeholder cells for in-flight cards. We need to extend the same logic to the Binder view so that when a pack is opened while the Collector Binder tab is active, newly acquired cards animate into their binder grid positions.

### Changes (all in `src/pages/Index.tsx`)

1. **Register `gridCellRefs` in the binder grid** — In `renderBinderCard`, attach the same `ref` callback to owned card elements so the deal animation knows where each card lives in the DOM.

2. **Show placeholder slots for in-flight cards in the binder** — When a card is currently being dealt (`dealingCardIds.has(id) && !dealtIds.has(id)`), render a pulsing dashed placeholder instead of the normal card, mirroring what the Classic view does.

3. **Apply "just landed" glow styling** — When a card has just been dealt (`dealtIds.has(id)`), apply the same cheese-glow ring effect used in Classic view.

4. **Ensure binder includes dealing cards in its grid** — The binder grid filters by owned assets. Cards that are being dealt are already in the `assets` array (they were fetched after the pack open), so they should naturally appear in `binderGrid`. We just need to make sure they render as placeholders rather than full cards when in-flight.

### Technical Details

- **`renderBinderCard`**: Add a ref callback on the owned card's wrapper that registers/unregisters from `gridCellRefs` using the asset ID. Check `dealingCardIds` and `dealtIds` to decide whether to render a placeholder, a glowing card, or a normal card.
- No changes needed to `CardDealAnimation.tsx` itself — it already works with any `gridCellRefs` map.
- The `visibleCount = Infinity` trick during dealing already applies globally, but the binder doesn't paginate the same way, so no special handling is needed there.

