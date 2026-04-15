

## Fix: NFT Cards Snapping Back When Dragged in Saved Collection

### Root Cause

The `SimpleAssetCard` component uses a custom `memo` comparator (lines 148–163) that **does not compare the drag handler props** (`onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`). 

In the Saved Collection tab, each card gets freshly-created drag handlers on every render (e.g. `handleDrop(idx)` creates a new closure capturing the current `savedOrder`). But because memo skips comparing those props, the card keeps **stale closures** from the first render. When you drop a card, the old `handleDrop` reads the original `savedOrder` and produces the wrong swap — making the card appear to jump back.

### Fix

**`src/components/simpleassets/SimpleAssetCard.tsx`** — Add the four drag handler props to the memo comparator:

```tsx
export const SimpleAssetCard = memo(SimpleAssetCardComponent, (prev, next) => {
  return (
    prev.asset.id === next.asset.id &&
    prev.asset.image === next.asset.image &&
    prev.asset.name === next.asset.name &&
    prev.asset.author === next.asset.author &&
    prev.asset.category === next.asset.category &&
    prev.asset.quality === next.asset.quality &&
    prev.asset.side === next.asset.side &&
    prev.asset.source === next.asset.source &&
    prev.selectionMode === next.selectionMode &&
    prev.selected === next.selected &&
    prev.draggable === next.draggable &&
    prev.className === next.className &&
    prev.stackCount === next.stackCount &&
    prev.onDragStart === next.onDragStart &&
    prev.onDragOver === next.onDragOver &&
    prev.onDrop === next.onDrop &&
    prev.onDragEnd === next.onDragEnd
  );
});
```

This ensures that when `savedOrder` changes and new drag handlers are created, the card re-renders with the up-to-date closures, so swaps work correctly.

### One file changed, four lines added

