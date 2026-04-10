

## Show full card corners in reveal dialogs

### Problem
The reveal card images have `rounded-lg` and `overflow-hidden` classes that clip the card corners and edges. The main grid view (`SimpleAssetCard`) shows cards with these rounded corners too, but the reveal cards look more noticeably clipped due to the smaller size and aspect ratio constraint.

### Solution
Remove `rounded-lg` from the outer wrapper, the front face, and the back face of the reveal cards in both dialog components. Remove `overflow-hidden` from the front face so the full card image displays edge-to-edge with sharp corners.

### Changes

**`src/components/simpleassets/PackRevealDialog.tsx`** — `RevealCardImage` (lines 66-86):
- Line 66: remove `rounded-lg` from outer div
- Line 68: remove `rounded-lg overflow-hidden` from front face div
- Line 80: remove `rounded-lg` from back face div

**`src/components/simpleassets/AtomicPackRevealDialog.tsx`** — `AtomicRevealCardImage` (lines 52-70):
- Line 52: remove `rounded-lg` from outer div
- Line 54: remove `rounded-lg overflow-hidden` from front face div
- Line 66: remove `rounded-lg` from back face div

### Files touched
- `src/components/simpleassets/PackRevealDialog.tsx`
- `src/components/simpleassets/AtomicPackRevealDialog.tsx`

