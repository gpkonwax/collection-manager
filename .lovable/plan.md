

## Add Pack Browser Dialog for AtomicAssets Packs

### Problem
Series 1/2 packs already show "Open Packs" (plural) when the user owns more than one, opening a browser dialog to pick which pack to open. AtomicAssets packs (Food Fight, Crash Gordon, etc.) always show "Open Pack" and immediately open the first one regardless of count.

### Changes

**1. New file: `src/components/simpleassets/AtomicPackBrowserDialog.tsx`**
- Mirror the existing `PackBrowserDialog` pattern but adapted for AtomicAssets
- Props: `open`, `onOpenChange`, `pack: AtomicPack`, `session`, `accountName`, `onSuccess`
- Paginated grid (10 per page) showing pack images with individual "Open" buttons
- Each "Open" button picks the corresponding `assetId` from `pack.assetIds[idx]` and sends the `atomicassets::transfer` action to the unpack contract
- On success, opens `AtomicPackRevealDialog` for that specific asset, decrements local count, removes the used asset ID
- Auto-closes browser when no packs remain

**2. Update `src/components/simpleassets/AtomicPackCard.tsx`**
- Add `hasMultiple = pack.count > 1` check
- When multiple: button text becomes "Open Packs", click opens `AtomicPackBrowserDialog`
- When single: keep current direct-open behavior
- Import and render the new `AtomicPackBrowserDialog`

### Flow
- 1 pack owned: "Open Pack" button opens directly (unchanged)
- 2+ packs owned: "Open Packs" button opens browser dialog with paginated grid, user picks which pack to open, reveal plays, then returns to browser to open more

