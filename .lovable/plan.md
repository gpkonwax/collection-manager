

## Puzzle Builder Tab for Series 2

### Overview
Add a "Puzzle Builder" tab that appears only when Series 2 is selected. It shows a free-form canvas where specific puzzle-piece cards (defined by card ID + side) display their **back image** with a semi-transparent card ID overlay. Cards can be dragged freely on the canvas and rotated in 90° steps via arrow buttons.

### New files

**`src/components/simpleassets/PuzzleBuilder.tsx`**
- A new component containing the entire puzzle builder UI
- Accepts the user's Series 2 assets and filters them against a configurable `PUZZLE_PIECES` list (array of `{ cardid, side }` objects — placeholder for now)
- Renders a large canvas area with relative positioning
- Each puzzle piece is rendered as a draggable card showing:
  - The card back image (via `buildGpkCardBackUrl`)
  - A semi-transparent card ID overlay (e.g. "12a") — no other info
- Each piece tracks its own `{ x, y, rotation }` state
- Drag uses `onMouseDown/Move/Up` (or pointer events) for free-form positioning
- Two small arrow buttons (↻ / ↺) on hover/select rotate the card ±90°
- CSS `transform: rotate(Ndeg)` for rotation

**`src/lib/puzzlePieces.ts`**
- Exports `PUZZLE_PIECES: { cardid: number; side: string }[]` — a placeholder array you'll fill in later with the real card IDs
- Single source of truth for which cards are puzzle pieces

### Changes to existing files

**`src/pages/Index.tsx`**
- When `categoryFilter === 'series2'`, add a tab bar (using existing `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` from shadcn) with two tabs: **Collection** (default, current view) and **Puzzle Builder**
- The Puzzle Builder tab renders `<PuzzleBuilder assets={filtered} />` where `filtered` is the Series 2 assets
- All existing Series 2 UI (filters, binder, grid) stays inside the Collection tab unchanged

### Technical details
- Card back URLs come from `buildGpkCardBackUrl('gpktwoeight', cardid)` (Series 2 hash)
- Puzzle piece positions stored in component state as `Map<string, {x, y, rotation}>` — no persistence needed initially
- Rotation: 0°, 90°, 180°, 270° cycling via click on ↻/↺ buttons
- Free-form drag via pointer events with `position: absolute` on a large scrollable container
- Cards sized ~120×168px (2:3 ratio) to fit comfortably on canvas

