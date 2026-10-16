# Add a vertical gap between Asset History timeline rows

## Problem
On the snaking Asset History timeline, row 2 starts flush against row 1 — visible under the tall
"Pack opened" box (the red line in the screenshot). The eye is pulled downward instead of following
the snake to the right. There is no vertical breathing room between any two rows.

## Change (single file: `src/components/simpleassets/TradeHistorySection.tsx`)
Nothing else on the timeline changes — no box resizing, no arrow style changes.

1. Add a constant `ROW_GAP = 24` next to `CARD_W` / `ARROW_W`.
2. In `SnakeRows`, give every row `<ol>` except the last a bottom margin of `ROW_GAP`
   (e.g. `style={{ width: rowW, marginBottom: r < rows.length - 1 ? ROW_GAP : undefined }}`).
   Boxes are top-aligned inside their row, so this simply inserts empty space between rows —
   the gap the user marked.
3. Keep the row-wrap arrow centred between the two boxes it bridges: the wrap arrow span
   (`data-arrow="wrap"`) already centres in the leftover space under the turning card. Extend it
   across the new gap with `marginBottom: -ROW_GAP` so its centred glyph spans
   (leftover + gap) and stays dead centre between the turning box and the box below it.

## Verification
- Run the timeline tests (`historyTimelineVisual.test.tsx`, `historyTimeline.test.ts`) and the full
  suite with `--maxWorkers=4`.
- Verify in the preview on a long-history card (e.g. the GPKMega card from the screenshot): a clear
  gap now separates the Pack opened box from the row below, rows 2–3 and 3–4 also gain the gap, and
  the wrap arrow remains centred between the rows it joins.
