## Goal
When a pack is opened and cards are dealt into the collection, the shuffle sound (`card-shuffle.mp3`, ~3.1s long) currently overlaps too much with the first card flying. Cards begin dealing before the shuffle has had a chance to be heard. We need a longer "pre-deal" pause so the shuffle plays out (or substantially plays out) before the first card flies.

## Where the issue lives
File: `src/components/simpleassets/CardDealAnimation.tsx`

Current flow on mount:
1. Shuffle audio starts playing immediately (~3.1s long).
2. Component scrolls to the first (bottom-most) card — usually completes within a few hundred ms.
3. Phase becomes `'sitting'` and waits `SIT_DURATION = 1600ms`.
4. Phase becomes `'scrolling'` → `'flying'` → first card starts moving.

So the first card is in motion roughly ~1.6s–2.0s after the shuffle begins, well before the 3.1s shuffle finishes.

## Fix
Introduce an explicit "shuffle settle" delay before the first card's sit/fly sequence begins, so the shuffle can play through most of its duration.

### Changes in `src/components/simpleassets/CardDealAnimation.tsx`

1. Add a new constant near the existing timing constants:
   ```ts
   const INITIAL_SHUFFLE_DELAY = 2200; // ms — let card-shuffle.mp3 play before first card flies
   ```
   (Combined with the existing `SIT_DURATION` of 1600ms, the first fly will start ~3.8s after mount, comfortably after the 3.14s shuffle.)

2. In the `phase === 'idle'` branch where `isFirstCardRef.current` is true, after the scroll-stable detection completes, wait `INITIAL_SHUFFLE_DELAY` before transitioning to `'sitting'`. Apply the same delay even when no scroll is needed (i.e. cards already in view), so the shuffle audio is always given runway on the first card.

3. Subsequent cards are unaffected — the per-card `SIT_DURATION` (1600ms) and existing land/fly timings stay the same. Only the very first card gets the extra pre-deal pause.

### What does NOT change
- `card-land.mp3` volume stays at the previously set 0.75.
- Pack tearing sound (`pack-tear.mp3`) timing in `usePackRevealAudio` stays the same.
- Sit/fly/land durations (`SIT_DURATION`, `FLY_DURATION`, `LAND_PAUSE`) stay the same.
- Skip Animation button still works and bypasses everything immediately.

## Why this approach
- Localized to one file and one constant — easy to tune later if the user wants more/less pause.
- Doesn't slow down dealing of cards 2..N, only adds breathing room at the very start where the shuffle plays.
- Keeps the existing scroll-stabilization logic intact, just chains an additional timeout after it.
