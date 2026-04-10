

## Update Puzzle Pieces list and deduplicate by card ID

### Changes

**1. `src/lib/puzzlePieces.ts`** — Replace placeholder list with real card IDs

The puzzle piece list becomes card IDs 55–60, 66–71, 75–80 (18 total). Since all sides/variants share the same back image, we only need the card ID — no side distinction. Change the export to a simple array of card IDs:

```typescript
export const PUZZLE_CARD_IDS: number[] = [
  55, 56, 57, 58, 59, 60,
  66, 67, 68, 69, 70, 71,
  75, 76, 77, 78, 79, 80,
];
```

**2. `src/components/simpleassets/PuzzleBuilder.tsx`** — Deduplicate: one piece per card ID

- Change `isPuzzlePiece` to check only `cardid` against `PUZZLE_CARD_IDS` (ignore side/variant).
- After filtering, deduplicate so only **one asset per card ID** appears. Pick the first match for each card ID.
- Update the back image URL to use just the card ID (already works — `buildGpkCardBackUrl` only needs boxtype + cardid).
- Update the overlay to show just the card ID number (no side letter since it's irrelevant).

### Files touched
- `src/lib/puzzlePieces.ts`
- `src/components/simpleassets/PuzzleBuilder.tsx`

