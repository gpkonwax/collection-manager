

## Include Puzzle Builder State in Saved JSON + Scramble Button

### What changes
1. The puzzle piece positions/rotations get included in the exported JSON layout file
2. When importing a JSON that contains puzzle data, the puzzle builder loads those positions
3. A "Scramble" button appears in the puzzle builder that randomizes all piece positions and rotations, useful for replaying or resetting a loaded puzzle

### Implementation

**`src/components/simpleassets/PuzzleBuilder.tsx`**

1. Lift puzzle state up: change from internal `useState` to accepting optional `pieces` map and `onPiecesChange` callback as props (controlled/uncontrolled pattern). When `onPiecesChange` is provided, call it on every state update so the parent can track the current puzzle state.

2. Accept an optional `initialPieceState` prop (a serializable `Record<string, PieceState>`) that overrides the default grid layout when present (from imported JSON).

3. Add a "Scramble" button that randomizes all piece x/y positions within the canvas bounds and assigns random 0/90/180/270 rotations. This button is always visible but especially useful after loading a completed puzzle.

**`src/pages/Index.tsx`**

1. Add a `puzzleState` ref or state that the PuzzleBuilder reports back to via `onPiecesChange`.

2. **Export**: In `handleExportLayout`, include `puzzleState` in the JSON alongside `orders`:
   ```json
   { "account": "...", "orders": {...}, "puzzle": { "cardid:x:y:rotation": ... } }
   ```
   Key puzzle pieces by `cardid` (not asset ID) so the data is portable across accounts.

3. **Import**: In `handleImportLayout`, read `data.puzzle` if present and pass it down to PuzzleBuilder as `initialPieceState`. Store it in component state so it persists while the tab is open.

### Files touched
- `src/components/simpleassets/PuzzleBuilder.tsx` — add props for state lifting + scramble button
- `src/pages/Index.tsx` — wire puzzle state into export/import

