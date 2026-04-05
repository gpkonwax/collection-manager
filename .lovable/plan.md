
Goal
- Keep the front card face exactly the same size it is now.
- Make the back card show full-size in its horizontal orientation instead of being shrunk to fit a portrait slot.
- Keep metadata visible below the media area.

What is wrong now
- The modal is wider, but the image row is still capped at `max-w-[852px]` and uses two equal portrait columns.
- The back is being rotated inside the same `aspect-[3/4]` frame with the `h-[75%] w-[133.333%]` shrink trick, so it has to render smaller than the front.

Plan
1. Update only `src/components/simpleassets/SimpleAssetDetailDialog.tsx`.
2. Replace the current equal-width 2-column image grid with a responsive side-by-side media row:
   - front panel keeps the current portrait `3:4` frame and current visual size
   - back panel gets a wider frame sized from that same card scale so the rotated back can display full-size horizontally
3. Remove the current shrink wrapper around the back image and render it in its own frame, rotating it in the requested direction so the original left edge becomes the top.
4. Keep the title, metadata, contained assets, owner, and raw JSON sections below the media row unchanged so widening the image area does not push them off-screen.
5. On smaller screens, stack front and back vertically so nothing overflows.

Technical details
- Stop constraining the media row to `max-w-[852px]`.
- Keep the modal wide enough to fit the unchanged front face plus the full-width rotated back.
- Use separate aspect/layout rules for front and back instead of forcing both into the same portrait box.

Success criteria
- Front face stays the same size as before.
- Back face no longer looks smaller than the front.
- Back is horizontal and oriented the requested way.
- Metadata remains visible without being pushed off-screen.
