# Fix: card pictures missing in card details

## What's wrong
When the navigation arrows were added, the card details content was moved into a new inner scrolling area. Everything else inside it sizes itself normally. The picture row is the only part that clips its content, so the browser squeezes it to zero height. The Front/Back labels and the pictures sit inside that collapsed row, which is why both vanished while the mint badge and the tools below still show.

## Fix
- Make every row in that scrolling area take its full natural height, so the picture row can't be squeezed again.
- Change nothing else: the arrows, layout, timeline and tools stay as they are.

## Check
- Open Ray Decay (and one Series 2 card with a sideways back) in the preview. Confirm the Front and Back pictures and labels show, the zoom lens and drawing still work, and the edge arrows still appear and move between cards.
- Run the detail-dialog tests.

## Technical details
- `SimpleAssetDetailDialog.tsx`: the scroll wrapper `div ref={scrollRef} className="grid gap-4 p-6 max-h-[90vh] overflow-y-auto ..."` gets `auto-rows-max` (grid-auto-rows: max-content). The image row has `overflow-hidden`, which sets its automatic minimum height to 0, so inside a grid capped by max-h it collapses.
- If the preview shows the row still collapsed, fall back to adding `shrink-0 min-h-fit` on the image row only.
