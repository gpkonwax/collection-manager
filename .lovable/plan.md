## Goal

Rework mint display on cards. Bridge mint (AA only) takes over the green pill styling from the removed AA `idata` mint. Add a reserved top-of-card mint ribbon on **both AA and SA cards** showing `#--` until real mint numbers are plumbed in.

## Changes

### `src/components/simpleassets/SimpleAssetCard.tsx`

**Bottom metadata row:**
- **AA cards:** hide the existing `mintInfo` emerald pill. Render `bridge_mint` pill with the emerald styling (`bg-emerald-500/15 text-emerald-400 font-medium`) that the removed pill used. Keep tooltip.
- **SA cards:** unchanged (existing green `mintInfo` pill stays).

**New top-of-card mint ribbon (both AA and SA):**
- Small pill absolutely positioned at the top-right of the artwork area (mirroring the AtomicHub `#259` style in the reference), inside the `Card` but outside the 3D tilt wrapper so text stays sharp.
- Content: `#{realMint}` when available, otherwise `#--`.
- Reads from a future `asset.mintNumber` (or similar) field with nullish fallback to `--`. No hook changes now; the slot is a placeholder ready to light up when the real source is wired later.
- z-index above artwork, below existing corner UI (alert button top-left, stack count top-right, selection checkbox top-left). Position it so it doesn't collide with the stack-count badge — place at top-center, or offset when a stack badge is present.

### Out of scope
- `SimpleAssetDetailDialog.tsx` — user asked about card grid only.
- Hooks (`useSimpleAssets`, `useGpkAtomicAssets`) — placeholder shows `--` until a follow-up task wires the real mint numbers.

## Technical notes

- AA detection: `asset.source === 'atomicassets'`.
- Emerald token reused verbatim: `bg-emerald-500/15 text-emerald-400 font-medium`.
- Ribbon is a `<div>` inside `Card` (already `relative`), placed outside the `perspective`/tilt wrapper.
- `memo` comparator: no changes needed now; when real mint field is added, include it in the equality check.

## Open question

Ribbon position — default to **top-center** so it never collides with the existing corner badges (alert, stack count, selection). Say the word if you'd rather have top-right and I'll shift the stack-count badge instead.
