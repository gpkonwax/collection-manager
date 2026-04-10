

## Add Timer Race Mode to Puzzle Builder

### What it does
A "Timer" checkbox next to Scramble. When checked, hitting Scramble starts a stopwatch (0:00 counting up). A "Finish" button appears. On finish, a **Puzzle Rating** is calculated and displayed.

### Rating algorithm
- **Time score** (0-40 pts): 40 pts if under 30s, linearly decreasing to 0 at 5 minutes
- **Rotation score** (0-30 pts): `(piecesAt0deg / totalPieces) * 30`
- **Placement score** (0-30 pts): Pairwise bounding box overlap check. 0 overlaps = 30 pts, -2 pts per overlapping pair
- **Letter grade**: A (90+), B (80+), C (70+), D (60+), F (below 60)

### Changes to `src/components/simpleassets/PuzzleBuilder.tsx`

1. **Add state**: `timerEnabled`, `timerRunning`, `elapsedMs`, `ratingResult`
2. **Timer logic**: `useEffect` with `setInterval(100ms)` tracking start timestamp
3. **Modify `scramble`**: If `timerEnabled`, start timer and clear previous rating
4. **Add `handleFinish`**: Stop timer, compute rating, set result
5. **UI**: Timer checkbox, live MM:SS.s display, Finish button, rating panel with letter grade and breakdown

### File changes
- **Edit**: `src/components/simpleassets/PuzzleBuilder.tsx` (~80 lines added)

