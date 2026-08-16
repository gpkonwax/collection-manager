# Collection history write-ups

Add a clickable info button next to the collection (series) dropdown that opens a dialog telling the story of the currently selected collection: when it dropped, how many were made, how fast it sold, how the community reacted, and the odd details collectors care about.

## What the user sees

- A small circled "i" button sitting beside the collection dropdown on the homepage toolbar. It is visible whenever a single collection is selected (hidden on "All categories" and on "Packs").
- Clicking it opens a dialog titled with the collection name, containing:
  - A one-line tagline (what this set is).
  - **Released** — date and platform (Topps' own shop vs AtomicHub vs redemption code).
  - **Size of the drop** — pack print runs, card counts, and how many packs/cards existed where that is known.
  - **Sell-out & demand** — how quickly it sold, whether it sold out at all, secondary-market reaction.
  - **Reception** — what collectors said at the time, what made it loved or divisive.
  - **Notes & oddities** — bullet list of the fun facts (errors, chases, event exclusives, artist details).
  - A short "Sources" line naming where the details came from (Topps shop FAQ, GPKNews, geepeekay.com, on-chain data), plus a note that figures are best-effort community records.
- Styling matches the existing pack info popovers and Info dialog: cheese-yellow headings, bulleted lists, works in both Dark Cheese and Bright skins.

## Collections covered

Series 1, Series 2, Tiger King (Exotic), Crash Gordon, Bernventures, Mittens, GameStonk, Food Fight, plus short entries for Bonus, Promo and Original Art (these are cross-set groupings rather than drops, so their entries explain that instead).

## Where the content comes from

The history text is researched and written per collection, drawing on the Topps WAX shop pages and FAQ, GPKNews launch coverage, the geepeekay.com WAX timeline, and the on-chain template/print-run data already captured in `src/lib/packSpecs.ts`. Anything not verifiable is either left out or explicitly hedged rather than invented — no made-up numbers.

## Technical notes

- New `src/lib/collectionHistory.ts`: a `CollectionHistory` interface (`tagline`, `released`, `dropSize`, `sellOut`, `reception`, `notes: string[]`, `sources: string[]`) and a `COLLECTION_HISTORY: Record<string, CollectionHistory>` keyed by the same category keys used in `CATEGORY_LABELS` (`series1`, `series2`, `exotic`, `crashgordon`, `bernventures`, `mittens`, `gamestonk`, `foodfightb`, `bonus`, `promo`, `originalart`), plus a `getCollectionHistory(key)` helper.
- New `src/components/simpleassets/CollectionHistoryDialog.tsx`: shadcn `Dialog` + `ScrollArea`, rendering the sections above from the record. Presentation only, no data fetching.
- `src/pages/Index.tsx`: next to the category `Select` (around line 3060), render an icon `Button` (`Info` icon, already imported) shown when `getCollectionHistory(categoryFilter)` exists; local `historyOpen` state drives the dialog.
- No changes to filtering, asset loading, or any blockchain logic.
