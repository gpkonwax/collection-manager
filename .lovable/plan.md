

## Update Atomic Pack Reveal: Fix Sound Label and Add Card Deal Animation

### What's happening now
1. **Sound naming**: `playRandomFart()` in `fartSounds.ts` plays `card-bell.mp3` — the function name is misleading but the bell sound is correct and matches Series 1/2
2. **Card Deal Animation**: The mechanism already exists — `handlePackOpened` detects new assets after refetch and triggers `CardDealAnimation`. However, for atomic packs, the reveal dialog stays open after `claimunboxed`, blocking the deal animation from being visible. The dialog needs to auto-close after collecting so the cards fly into the grid.

### Changes

**`src/lib/fartSounds.ts`**
- Rename function from `playRandomFart` to `playCardRevealSound` for clarity
- Update all import references across the codebase

**`src/components/simpleassets/AtomicPackRevealDialog.tsx`**
- After `claimunboxed` succeeds (phase becomes 'done'), auto-close the dialog after a brief delay (~1.5s) instead of requiring the user to click "Awesome! Close"
- This lets `onComplete(txId)` flow through to `handlePackOpened`, which triggers the card deal animation once new assets are detected
- Keep a brief "Cards Collected!" confirmation visible before auto-closing

**`src/components/simpleassets/PackRevealDialog.tsx`**
- Same auto-close treatment after collect succeeds (if not already doing this)
- Update `playRandomFart` → `playCardRevealSound` import

**`src/components/simpleassets/AtomicPackCard.tsx`**
- Pass through `onComplete` callback correctly so the txId propagates to trigger the deal animation

### Flow after fix
1. User opens atomic pack → transfer + unbox transaction
2. Reveal dialog: shake, tear, flip cards one-by-one with bell sounds
3. User clicks "Collect Assets" → `claimunboxed` transaction
4. Dialog briefly shows "Cards Collected!" then auto-closes
5. Assets refetch detects new cards → Card Deal Animation plays (cards fly from stack to grid positions)

