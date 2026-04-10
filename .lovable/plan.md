

## Add "Skip Animation" button to card deal animation

### Change

Add a floating **Skip Animation** button positioned below the card stack. When clicked, it immediately marks all remaining cards as dealt and calls `onComplete`.

### Technical details

**File: `src/components/simpleassets/CardDealAnimation.tsx`**

1. Add a `handleSkip` callback that loops through all remaining undealt cards calling `onCardDealt(id)` for each, then calls `onComplete()`.

2. Render a button below the card stack (below the card name area) with `pointer-events-auto` (since the parent container is `pointer-events-none`). Positioned using the same `stackX` / `STACK_Y` coordinates plus the card height offset.

```tsx
const handleSkip = useCallback(() => {
  cards.slice(dealIndex).forEach(c => onCardDealt(c.id));
  hasCompletedRef.current = true;
  onComplete();
}, [cards, dealIndex, onCardDealt, onComplete]);
```

Button rendered inside the existing `fixed inset-0 z-50` container:
```tsx
<button
  onClick={handleSkip}
  className="fixed pointer-events-auto bg-card/90 hover:bg-card text-foreground text-xs font-semibold px-3 py-1.5 rounded-md border border-border shadow-md transition-colors"
  style={{
    left: stackX,
    top: STACK_Y + cardSize.height + 44,
    width: cardSize.width,
    zIndex: 201,
  }}
>
  Skip Animation
</button>
```

### Files touched
- `src/components/simpleassets/CardDealAnimation.tsx`

