# Swap in a better Bony Joanie Mega wrapper image

## Source

The pack-shop frame came from the promo video embedded on the Topps GPK FAQ page:

- Page: https://topps.wdny.io/faq
- Video: https://www.youtube.com/watch?v=7qXtHSYdm5s ("Topps Garbage Pail Kids NFTs ... now available on the WAX Blockchain!", 0:58)
- Frame: ~0:26, the "Buy a GPK Card Pack" screen showing Standard Pack ($4.99) and Mega Pack ($24.99)

Note for the write-up: in that frame the Mega Pack spec panel says **30 Cards**, while the wrapper art itself reads **"25 DIGITAL CARDS • NO GUM"** — the mismatch is the oddity worth calling out.

## What happens next

1. You grab a clean, high-resolution crop of the Mega Pack wrapper from that frame and upload it in chat.
2. Replace `src/assets/gpk-mega-bony-joanie.png` with the new crop (same filename, so no code changes are needed anywhere else).
3. Refresh the caption in `src/lib/collectionHistory.ts` for the Series 1 entry so it credits the source precisely: the Topps GPK FAQ promo video, ~0:26, and the 25-vs-30 card discrepancy visible in the same frame.
4. Check the thumbnail and the click-to-enlarge lightbox in the Series 1 "the story" dialog to confirm the new image is sharp at full size.

## Technical notes

- The image is a plain ES6 asset import in `src/lib/collectionHistory.ts`; the dialog renders it through the `images` array added to `CollectionHistory`.
- If the new crop is much larger, keep it under roughly 1MB so it does not bloat the bundle; the lightbox caps display at 65vh.
