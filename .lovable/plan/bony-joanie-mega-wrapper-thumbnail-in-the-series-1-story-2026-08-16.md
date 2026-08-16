# Bony Joanie Mega wrapper thumbnail in the Series 1 story

I found the image in the chat history: the screenshot you sent on 10 Aug (the Topps FAQ page) contains the promo-video still where the Mega Pack tile shows the **Bony Joanie** wrapper reading "SERIES 1 — 25 DIGITAL CARDS • NO GUM". That is the alternate art you remembered.

## What to build

1. Crop the Mega Pack wrapper out of that screenshot, upscale it cleanly, and save it as a project image asset (`src/assets/gpk-mega-bony-joanie.png`).
2. In the collection story dialog, show that crop as a small thumbnail next to the "Notes & oddities" entry about the alternate Mega wrapper — only for Series 1 (data-driven, so other collections can add one later).
3. Clicking the thumbnail opens it enlarged in a lightbox overlay (click anywhere / Esc to close), with a short caption naming it as an unverified pre-launch mock-up showing 25 cards.

## Technical notes

- Add an optional `images?: { src: string; caption: string }[]` field to the Series 1 entry in `src/lib/collectionHistory.ts` (typed as optional so nothing else changes).
- `src/components/simpleassets/CollectionHistoryDialog.tsx`: render the thumbnails under the notes list as a small row of rounded, bordered buttons; local `useState` holds the enlarged image, rendered as a fixed overlay inside the dialog with the existing dark/cheese tokens. No new dependencies.
- Image handled as a normal ES6 import from `src/assets`; no changes to mirrors, packs, or history logic.
