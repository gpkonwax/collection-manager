# Randomise card order in Pack History replays

## Problem
Replays always reveal cards in the exact order they were stored (grouped by variant — all gums, then raws, then returning, then sketch). Every replay of the same pack looks identical.

## Change
Shuffle the reveal order each time a replay starts, so the same pack reveals in a different order on every play.

- Cards revealed: identical set, identical count — only the order changes.
- Each press of Replay produces a fresh shuffle (not a fixed per-pack order).
- The "collect / deal into collection" step is unaffected: it matches cards back to wallet assets by id/attributes, not by position, so all cards still land in the right grid cells.

## Technical detail
In `src/pages/Index.tsx`:
- Add a `replayShuffleKey` state (a counter or random number) set in `handleReplayRequest` when a replay is launched.
- In the `replayRevealCards` memo, apply a Fisher-Yates shuffle to a copy of `replayEntry.cards` before mapping to `RevealCard`, with `replayShuffleKey` added to the dependency list so a new order is produced per replay.
- Keep `asset_id` keys unique and stable within a single replay (derive from the card's own index in the original array, e.g. `replay-${txId}-${originalIndex}`) so React keys don't collide.
- `handleReplayCollect` keeps using `entry.cards` (unshuffled) — no change needed.
