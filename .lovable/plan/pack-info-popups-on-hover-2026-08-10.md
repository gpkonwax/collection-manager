# Pack Info Popups on Hover

Hovering a pack tile shows a small info card with the original Topps shop details for that pack (pack type, series, release date, card count, and the odds/contents list).

## Content to show

Series 1 (from the Topps FAQ page):

- Standard Pack ($4.99) — Series 1, May 12 2020, 5 cards: 1 "B" Name Prism; 50% chance at an "A" Name Prism; 10% chance at a "B" Name Sketch; 5% chance at an "A" Name Sketch; 0.2% chance at a Chase card.
- Mega Pack ($24.99) — Series 1, May 12 2020, 30 cards: 5 "B" Name Prism Cards; 3 "A" Name Prism Cards; 1 "B" Name Sketch Card; 50% chance at an "A" Name Sketch Card; 1% chance at a Chase card.

Series 2 (from topps.wdny.io/shop):

- Standard Pack ($9.99) — Series 2, Sept 30 2020, 8 cards: 4 Slime Cards; 1 Raw Card; 50% chance at a Returning Card; 30% chance at a Sketch Card; 1% chance at a Collector's Edition.
- Mega Pack ($24.99) — Series 2, Sept 30 2020, 25 cards: 4 Gum Cards; 3 Raw Cards; 2 Returning Cards; 1 Returning "A" Name Card; 1 Sketch Card; 4% chance at a Collector's Edition.
- Ultimate Pack ($49.99) — Series 2, Sept 30 2020, 55 cards: 8 Raw Cards; 7 Returning Cards; 3 Sketch Cards; 2 VHS Cards; 10% chance at a Collector's Edition.

Mapping to the app's pack symbols: GPKFIVE = Series 1 Standard, GPKMEGA = Series 1 Mega, GPKTWOA = Series 2 Standard, GPKTWOB = Series 2 Mega, GPKTWOC = Series 2 Ultimate.

Exotic packs (EXOFIVE / EXOMEGA) and other AtomicAssets packs have no published spec sheet, so they get no popup for now (nothing changes for them).

## Behaviour

- Hover (or keyboard focus / tap on touch) anywhere on the pack tile opens the popup next to the tile; it disappears on mouse-out.
- The popup does not block the Open Pack / Trade / Demo buttons — moving to a button keeps the tile usable and clicking still works.
- Styled to match the current skin (card background, yellow accents, bright-theme tokens), with the pack name and price as the heading and the details as a compact label/value list plus a bulleted "Includes" list.

## Technical notes

- New `src/lib/packSpecs.ts`: a `PACK_SPECS: Record<string, PackSpec>` keyed by pack symbol, plus a matching key for AtomicAssets Series 1/2 packs so the same data can be reused there if a config maps to the same pack type.
- New `src/components/simpleassets/PackInfoPopover.tsx`: a presentational wrapper using the existing shadcn `HoverCard` primitive; renders children as trigger and the spec as content. Renders children unwrapped when no spec exists for the symbol.
- Wrap the `<Card>` in `src/components/simpleassets/GpkPackCard.tsx` (SA packs) and in `src/components/simpleassets/AtomicPackCard.tsx` (AA packs, spec lookup via the pack config's series/type) with the new component. No changes to opening, trading, or reveal logic.
- Add `hover-card` from shadcn if it is not already present in `src/components/ui/`.
