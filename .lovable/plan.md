

## Add Demo Openings for Food Fight Atomic Packs

### Problem
Token-based packs (Series 1, 2, Tiger King) have a "Demo Open" button that simulates the pack opening experience using sample cards from the collection. Atomic packs (including all Food Fight packs) lack this feature.

### Approach
Mirror the demo mode pattern from `GpkPackCard` into `AtomicPackCard` and `AtomicPackRevealDialog`.

### Files to Change

**1. `src/components/simpleassets/AtomicPackCard.tsx`**
- Add new props: `onDemoCollect`, `collectionAssets`
- Add `demoAssetsSample` and `demoCards` memos (same pattern as `GpkPackCard`)
- Add `demoRevealOpen` state
- Render a "Demo Open" button when `demoCards.length > 0`
- Pass `demoCards` and `onDemoCollect` to `AtomicPackRevealDialog`

**2. `src/components/simpleassets/AtomicPackRevealDialog.tsx`**
- Add `demoCards` and `onDemoCollect` optional props
- Add demo mode logic: skip real polling when `demoCards` is provided, show cards after shake animation, go to collect phase instead of blockchain claim
- Wire "Collect" button to call `onDemoCollect` in demo mode

**3. `src/pages/Index.tsx`**
- In `renderPackItem` for atomic packs, pass `onDemoCollect={handleDemoCollect}` and `collectionAssets` filtered by `ATOMIC_PACK_CATEGORY_MAP[pack.templateId]`
- Ensure `foodfightb` category assets are passed to Food Fight pack cards

