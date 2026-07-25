## Goal
Rework the mint-number ribbon at the top of each card so it no longer spans the full card width as a dark bar. Instead, the number should sit inside a small, rounded, dark pill that is just wide enough to hold the text, centered in a row that uses the lighter grey already surrounding the card artwork.

## Current state
In `src/components/simpleassets/SimpleAssetCard.tsx` the ribbon is rendered as:

```tsx
<div className="w-full flex justify-center py-1 bg-background/60 border-b border-border/40">
  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-cheese">
    {realMintDisplay}
  </span>
</div>
```

This creates a full-width dark ribbon across the top of the card.

## Proposed change
Update the ribbon container and inner pill in `src/components/simpleassets/SimpleAssetCard.tsx`:

1. Remove the full-width dark background (`bg-background/60`) and bottom border (`border-b border-border/40`).
2. Keep the row itself centered and short, using the same lighter grey that appears behind/around cards (`bg-muted/30` or the card surface tone) so it blends with the existing card background rather than appearing as a dark strip.
3. Wrap the mint text in a compact, rounded pill with a dark translucent background (`bg-background/80` or `bg-black/50`) and `text-cheese`, sized only slightly larger than the number itself.
4. Preserve the existing tooltip/title text and the `#--` / real-mint display logic.

## Verification
After the change, each card in the grid should show a small centered mint pill above the artwork instead of a full-width dark ribbon, with the surrounding area matching the lighter grey card/artwork background.

## Files to modify
- `src/components/simpleassets/SimpleAssetCard.tsx`