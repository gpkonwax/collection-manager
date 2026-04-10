
## Show full card sides in reveal dialogs

### Root cause
The rounded-corner issue appears fixed already. The remaining side clipping is coming from the reveal dialogs using `object-cover` on the card images, which zooms the image to fill the 2:3 frame and trims the left/right edges. The main front view uses `object-contain`, so it shows the full card.

### Change
Update both reveal dialog components so the front card image uses `object-contain` instead of `object-cover`, matching the main card display behavior.

### Technical details
- `src/components/simpleassets/PackRevealDialog.tsx`
  - In `RevealCardImage`, change the front-face `<img>` from:
    - `className="w-full h-full object-cover"`
    - to `className="w-full h-full object-contain object-center"`
- `src/components/simpleassets/AtomicPackRevealDialog.tsx`
  - In `AtomicRevealCardImage`, make the same change:
    - `object-cover` -> `object-contain object-center`

### Notes
- Keep the sharp-corner changes already made.
- Keep the flip animation, borders, and name overlay unchanged.
- If any cards have slightly different source aspect ratios, `object-contain` will preserve the full image instead of trimming the sides.

### Files touched
- `src/components/simpleassets/PackRevealDialog.tsx`
- `src/components/simpleassets/AtomicPackRevealDialog.tsx`
