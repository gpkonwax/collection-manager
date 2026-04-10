

## Delay bell sound to play after card flip completes

### Problem
The bell sound plays simultaneously with the card flip starting (at the moment `revealedCount` increments). The flip animation takes 0.6s, so the bell should play after the flip finishes, not at the start.

### Solution
In both `PackRevealDialog.tsx` and `AtomicPackRevealDialog.tsx`, split the reveal timer into two steps: first increment `revealedCount` to start the flip, then play the bell 600ms later (matching the CSS `transition: transform 0.6s` duration).

### Changes

**`src/components/simpleassets/PackRevealDialog.tsx`** (line ~174):
```tsx
// Before:
const timer = setTimeout(() => { playRandomFart(); setRevealedCount((c) => c + 1); }, 1600);

// After:
const timer = setTimeout(() => {
  setRevealedCount((c) => c + 1);
  setTimeout(() => playRandomFart(), 600);
}, 1600);
```

**`src/components/simpleassets/AtomicPackRevealDialog.tsx`** (line ~174):
Same change — increment count first, then play bell after 600ms delay.

### Files touched
- `src/components/simpleassets/PackRevealDialog.tsx`
- `src/components/simpleassets/AtomicPackRevealDialog.tsx`

