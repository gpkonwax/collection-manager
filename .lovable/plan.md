

## Fix Blurry Card Text

### Problem
Text below cards (title, author, category) appears blurry at rest because the card face sits on `translateZ(8px)` and the `CardContent` adds another `translateZ(2px)`. Browsers anti-alias text differently inside 3D-transformed layers, causing visible blur until a repaint (triggered by hover).

### Fix
In `src/components/simpleassets/SimpleAssetCard.tsx`, add `will-change: transform` and `transform: translateZ(0)` to the `CardContent` element to force GPU rasterization at native resolution, and remove the separate `translateZ(2px)` which causes the sub-pixel rendering issue.

**Changes in `SimpleAssetCard.tsx`:**
- Line 163: Replace `style={{ transform: 'translateZ(2px)' }}` with `style={{ transform: 'translateZ(0)', willChange: 'contents' }}` on the `CardContent` element. This keeps text in a composited layer but avoids the sub-pixel offset that triggers blurry rendering.

### Files Changed
- `src/components/simpleassets/SimpleAssetCard.tsx` — fix CardContent transform to eliminate text blur

