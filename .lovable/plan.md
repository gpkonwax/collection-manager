

## Remove card overlay text and fix container sizing in reveal dialogs

### Changes

**1. Remove the name/rarity overlay from both reveal card components**

Both `PackRevealDialog.tsx` and `AtomicPackRevealDialog.tsx` have a gradient overlay at the bottom of each card showing the card name and rarity text. Remove these overlay `div`s entirely (lines 75-78 in PackRevealDialog, lines 61-64 in AtomicPackRevealDialog).

**2. Fix the black border caused by `aspect-[2/3]` + `object-contain`**

The container is forced to a 2:3 aspect ratio, but with `object-contain` the image letterboxes inside it, leaving black/dark gaps on the sides. Fix by removing the forced `aspect-[2/3]` on the outer wrapper and instead letting the image define its own size naturally, or by changing the `bg-card` background to transparent so no dark border shows around the contained image.

The simpler fix: remove `bg-card` from the front face container (change to `bg-transparent`) so the gaps from `object-contain` are invisible against the dialog background.

### Technical details

**`src/components/simpleassets/PackRevealDialog.tsx`** — `RevealCardImage`:
- Remove lines 75-78 (the gradient overlay div with name/rarity)
- Line 68: change `bg-card` to `bg-transparent`

**`src/components/simpleassets/AtomicPackRevealDialog.tsx`** — `AtomicRevealCardImage`:
- Remove lines 61-64 (the gradient overlay div with name/rarity)
- Line 54: change `bg-card` to `bg-transparent`

### Files touched
- `src/components/simpleassets/PackRevealDialog.tsx`
- `src/components/simpleassets/AtomicPackRevealDialog.tsx`

