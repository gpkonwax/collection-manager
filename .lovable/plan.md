# Side arrows walk the whole collection in reading order

## What changes
- **Right arrow / right key:** moves to the next card. At the end of a row it jumps to the first card of the next row, so pressing right from the first card walks through the whole collection, left to right, row after row.
- **Left arrow / left key:** the same in reverse. At the start of a row it jumps to the last card of the row above.
- **Ends:** no right arrow on the very last card, and no left arrow on the very first. It does not loop back around.
- **Up/down arrows:** unchanged.
- Empty slots are still skipped. The order still follows what's on screen, so it respects your view, filters, sort and window size.
- The grid behind keeps scrolling with you, so rows further down load as you go.

## Check
- Add tests: right at a row end goes to the next row's first card, left at a row start goes to the previous row's last card, last/first card have no further arrow, and gaps are skipped.
- In the preview: open the first card and press right past several row ends. Confirm each step lands on the next card in order and the grid follows.

## Technical details
- `src/lib/gridNeighbour.ts` `findNeighbour`: for left/right, sort the rendered cells into reading order (group into rows by centre-Y using the existing tolerance, then by X) and return the previous/next entry instead of the same-row-only search.
- `Index.tsx` already scrolls the current card into view before measuring, so the virtualised rows next to it are drawn. If the next row isn't drawn yet at the bottom edge, scroll by block `center` instead of `nearest`.
