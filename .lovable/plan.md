# Ring Binder View (4th view mode)

A new "Album" tab beside Classic / Binder / Puzzle that presents the collection as a real 3-ring binder seen from above: closed cover, cover swings open, pages turn one at a time with card fronts on the right and the backs of the previous nine on the left.

## The experience

```text
CLOSED                    OPENED (page 1)            AFTER FIRST TURN
+-------+ . . . .         +-------+o+-------+        +-------+o+-------+
|       |                 |       |o| 1 2 3 |        | backs |o| 10 11 |
| GPK   |                 | inside|o| 4 5 6 |        | of    |o| 12 13 |
| COVER |                 | cover |o| 7 8 9 |        | 1-9   |o| ...   |
+-------+ . . . .         +-------+o+-------+        +-------+o+-------+
 3x3 wide                 6x3 + rings                6x3 + rings
```

- The closed binder occupies a 3x3 card footprint, top-down, with the remaining grid width empty.
- Clicking the cover swings it open to the left into that empty space, revealing three metal rings down the centre and the first page of nine card fronts on the right.
- Turning a page flips the right page over to the left: the left leaf then shows the **backs** of those nine cards, and the right leaf shows the **fronts** of the next nine. Every turn after that keeps both leaves filled.
- Turning back reverses it, right through to closing the cover again.

## Confirmed behaviour

- **Contents**: identical to the current Binder view — the full checklist for the selected series in order, with grey "missing" placeholders for cards not owned. Series, variant, search and sort filters all apply, so the album re-paginates when filters change.
- **Card backs**: uses the real scanned back when one exists (`buildGpkCardBackUrl`, available for the SimpleAssets series); otherwise an empty translucent binder sleeve with the card number faintly printed, so nothing looks broken for AtomicAssets series.
- **Page turning**: click the right-hand page to go forward, click the left-hand page to go back, plus prev/next arrow buttons and a "Page X of Y" counter under the binder. Keyboard left/right arrows work too.
- **Card actions**: clicking a card opens the same detail dialog as every other view (zoom, trade, transfer, burn). A short click on a card never triggers a page turn — only clicks on empty page area do.

## Look and feel

- Dark leather-textured cover with the GPK/CHEESE branding, cheese-yellow foil edge, and a soft top-down drop shadow.
- Three chrome rings rendered down the gutter, each biting through punched holes in the page leaves.
- Pages are off-white with nine clear card pockets (3x3), matching the exact card aspect ratio used elsewhere.
- Page turn is a ~600ms CSS 3D rotation about the gutter with a subtle shadow sweep; the cover open uses the same motion. Respects `prefers-reduced-motion` by cross-fading instead.
- Fully themed via existing tokens so it works in both Dark Cheese and Bright skins.

## Technical notes

- New `src/components/simpleassets/RingBinderView.tsx`. Props: the existing `binderGrid` slot array (`{ template, owned }[]`), `onSelectAsset`, and the current `categoryFilter` label for the cover.
- `ViewMode` in `src/pages/Index.tsx` gains `'album'`; a fourth `TabsTrigger` and `TabsContent` are added, and `binderSchema` is widened to `viewMode === 'binder' || viewMode === 'album'` so templates load for the new tab too. No change to `binderGrid` itself.
- Pagination: chunk the slot array into pages of 9. State is `spreadIndex` (`-1` = closed cover, `0` = first page, …). Rendering derives `leftPage = pages[spreadIndex - 1]` (shown as backs) and `rightPage = pages[spreadIndex]` (fronts).
- Card fronts reuse `SimpleAssetCard` / `MissingCardPlaceholder` inside pocket wrappers so mint ribbons, variant labels and protocol badges stay consistent; backs render through `IpfsMedia` with the resolved back URL and a blank-sleeve fallback on error.
- Turn animation: the leaf being turned is duplicated into an absolutely positioned layer with `transform-style: preserve-3d` and `rotateY`, `transform-origin` at the gutter; front face = outgoing fronts, back face = those same cards' backs. Animation state is a single `turning: 'forward' | 'back' | null` plus a transition-end handler that commits `spreadIndex`.
- Images are eager-loaded for the current spread and prefetched one page ahead so a turn never reveals empty pockets.
- Existing Binder, Classic, Saved and Puzzle views are untouched, as are collection, trade and backup logic.
