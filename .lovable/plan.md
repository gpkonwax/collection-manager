# Puzzle Builder: always-visible reference at 25% size

## Goal
The completed-puzzle reference is currently a tiny 32×32 cropped thumbnail that you click to enlarge and then close. The user wants it **always visible at a larger size** — specifically 25% of the enlarged size — while still being click-to-enlarge to the full view (unchanged behaviour), and returning to that 25% size when closed.

## What changes
Single file: `src/components/simpleassets/PuzzleBuilder.tsx`, the `referenceControl` block (around lines 385–420).

### 1. Enlarge the resting preview to 25% of the enlarged size
- The enlarged dialog image renders at `w-full` inside `max-w-4xl` (= 896px), capped at `max-h-[75vh]`. 25% of that width = **~224px**.
- Change the resting thumbnail from `h-8 w-8` (32×32) to a ~224px-wide image.
- Switch the resting image from `object-cover` (crops) to `object-contain` so the **whole** reference picture is always visible at a glance, not a cropped square.

### 2. Keep enlarge + return-to-25%
- The existing `onClick={() => setReferenceOpen(true)}` opens the full-size Dialog (unchanged).
- Closing the Dialog (`onOpenChange={setReferenceOpen}`) simply reverts to the 25% resting preview — no new state needed, the resting image is always rendered behind the dialog.
- Keep the "Reference" label/icon so it's still clearly clickable to enlarge.

### 3. Layout
- The 224px-wide preview lives in the toolbar's flex-wrap group, so it wraps onto its own line rather than crowding the puzzle selector. It stays always visible at 25% size alongside the canvas.

## Technical notes
- `referenceUrl` already points to either the NFT Series 2 reference sheet or the active extra puzzle's reference — both are landscape images, so `object-contain` at ~224px wide shows the full picture cleanly.
- The Dialog content (`max-w-4xl`, `max-h-[75vh]`) is unchanged, so the enlarged size is unchanged and the 25% resting size is a true quarter of it.

## Verification
Open the Puzzle Builder: the reference is visible at ~224px wide showing the full picture (not a cropped 32px square); click it to enlarge to the full Dialog; close the Dialog and confirm it returns to the 25% size. Switch between the NFT puzzle and an extra puzzle and confirm each puzzle's own reference shows at the 25% size.
