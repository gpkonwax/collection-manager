

## Update Pre-Login Landing Page

### Overview
Rewrite the logged-out landing page section (lines ~890-948) to showcase the new three-view system, magnification lens, and puzzle builder. Restructure into distinct sections with a more detailed feature grid.

### Changes to `src/pages/Index.tsx`

**1. Add new icons to imports (line 2-3)**
- Add `ZoomIn`, `Puzzle`, `Eye`, `LayoutGrid` from lucide-react

**2. Replace the feature grid (lines 909-940) with three sections:**

**Section A — "Three Ways to View Your Collection"**
A highlighted section with 3 cards side by side:
- **Classic View** (Eye icon): Read-only grid of your cards in natural sort order. Clean, simple, no clutter. Just your collection as it is.
- **Collector Binder** (BookOpen icon): Template-based completionist view. Owned cards in full color, missing cards as greyscale placeholders linked to AtomicHub. See exactly what you need.
- **Saved Collection** (Save icon): Your personal workspace. Import/export JSON layouts, drag-and-drop to rearrange, build the perfect display of your collection.

**Section B — "Inspect Every Detail"**
A visually distinct callout block (wider card, maybe spanning 2 cols or full width):
- **Magnification Lens** (ZoomIn icon): Click any card to see it in full detail. Hover over the image and a magnifying lens follows your cursor, zooming in so you can see every line, every detail, every variant difference up close.

**Section C — "Puzzle Builder"**
Another highlight section (full-width or 2-col):
- **Series 2 Puzzle Builder** (Puzzle icon): Series 2 cards contain hidden puzzle pieces on their backs. The Puzzle Builder gives you a free-form canvas to drag, rotate, and arrange your puzzle pieces. Scramble them, line them up, and save your progress as JSON. Can you complete the puzzle?

**Section D — Remaining features (3-col grid)**
Keep updated versions of:
- All Topps Packs Supported (unchanged)
- Filter by Series & Variant (unchanged)
- SimpleAssets & AtomicAssets (unchanged)
- Free Community Tool (unchanged)

**3. Update hero subtitle (line 900)**
Update to mention the three views and new features:
> "Three flexible views, a magnifying lens for every detail, a puzzle builder for Series 2 — plus pack opening, filtering, and drag-and-drop layouts. Free to use, built by the $CHEESE team for the WAX community."

### Structure
```text
Hero + CTA
├── "Three Ways to View" — 3 cards in a row
├── "Inspect Every Detail" — full-width feature callout
├── "Puzzle Builder" — full-width feature callout  
├── "More Features" — 2x2 grid (packs, filters, dual standards, community)
└── Bottom CTA
```

### File changes
- **`src/pages/Index.tsx`**: Update imports (add icons), rewrite lines ~890-948 with new section layout

