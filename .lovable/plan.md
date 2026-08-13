# Puzzle Builder: lock pieces until Scramble is pressed

## Goal

When a puzzle opens, all pieces sit in their default neat grid and **cannot be dragged or rotated** until the user presses **Scramble** at least once. A yellow notice sits over the grid (between the pieces) telling the user to press Scramble to start. Pressing Scramble scatters the pieces (existing behaviour) and the notice disappears, unlocking interaction.

## What changes

Single file: `src/components/simpleassets/PuzzleBuilder.tsx`.

### 1. New `scrambled` state
Add `const [scrambled, setScrambled] = useState(false)`. It starts `false` for every puzzle. Reset it to `false` inside `handleSelectPuzzle` (when switching puzzles) so each puzzle re-locks and re-notices until scrambled. Also reset to `false` when the `initialPieceState` import effect fires, and in `handleFileChange` / `handleClearJson`, so a freshly-loaded layout is again locked-and-noticed until the user scrambles.

### 2. Lock interactions while `!scrambled`
- In `handlePointerDown`, early-return (no-op) when `!scrambled` so pieces can't be dragged.
- In `rotate`, early-return when `!scrambled` so the rotation buttons do nothing.
- Add `pointer-events-none opacity-40` to the rotation button group when `!scrambled` to signal they're disabled (optional visual cue).

### 3. Unlock on Scramble
In `scramble`, call `setScrambled(true)` alongside the existing scatter logic. Once true, dragging and rotation work normally for the rest of the session on that puzzle.

### 4. The yellow start notice
Render a notice element inside the canvas `<div>` (the `canvasRef` container), centered, only when `!scrambled`:

```text
Press the Scramble button to start the puzzle
```

Styling: bright cheese-yellow text, `bg-background/70 backdrop-blur-sm` chip, `z-40`, absolutely centered, `pointer-events-none` so it doesn't block the canvas. It overlays the neat grid of pieces so it's unmissable, and vanishes as soon as `scrambled` becomes true.

## Technical notes
- The default neat grid (from `buildDefaultLayout`) already renders before scramble; the notice overlays it — no layout change needed.
- The existing timer already only starts on Scramble; coupling the lock to the same trigger keeps the two behaviours in sync.
- No effect on JSON export/import — those operate on positions, not the lock flag.

## Verification
Open the Puzzle Builder, confirm pieces can't be dragged/rotated and the yellow notice shows; press Scramble and confirm the notice disappears and pieces become draggable/rotatable; switch to another puzzle and confirm it re-locks and re-notices until Scramble is pressed.
