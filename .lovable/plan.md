
## Revised collect-animation plan

### Behavior to build
After a successful card claim from either:
- the normal `Collect Assets` button in `PackRevealDialog` / `AtomicPackRevealDialog`, or
- the fallback `Collect Unclaimed` button,

the app should:
1. Close the reveal flow and switch to the correct collection/category.
2. Show empty landing spaces in the grid where the new cards belong.
3. Show an upright, face-up stack at the top using the real card fronts.
4. Draw the top card off that stack one-by-one, keeping it face-up the entire time so the user sees the card before it is placed.
5. Fly each card into its exact sorted slot in the collection.
6. Show the transaction success modal after the final card lands so it does not block the animation.

### Important correction
No face-down stack and no back-of-card dealing.  
The moving cards must stay face-up from the start.

### Implementation approach
- Create a shared `CardDealAnimation` overlay component for the post-collect sequence.
- Move all post-claim handling into one shared flow in `Index.tsx` so normal claim and fallback claim behave the same way.
- Before a collect/open flow starts, snapshot the current asset IDs.
- After a successful collect transaction, await the asset refetch, diff old vs new assets, and use the newly added assets as the cards to animate.
- Clear search/source/custom ordering, switch to the relevant category, and scroll the collection grid into view before the deal starts.
- In the grid, reserve the final positions for incoming cards with empty slots so layout stays stable while cards are still in flight.
- Animate cards from the face-up stack to those exact target slots one by one.

### File changes
- `src/pages/Index.tsx`
  - Add shared post-collect coordinator
  - Snapshot pre-collect assets
  - Refetch + diff to detect newly collected cards
  - Switch filters/category and start the deal animation
  - Delay collect success modal until animation completion
- `src/components/simpleassets/CardDealAnimation.tsx` (new)
  - Fixed overlay stack using actual card fronts
  - Per-card lift + flight animation to target slot refs
- `src/components/simpleassets/PackRevealDialog.tsx`
  - Replace generic `onComplete()` success handling with a richer collect-success callback carrying tx info
- `src/components/simpleassets/AtomicPackRevealDialog.tsx`
  - Same callback upgrade as above
- `src/components/simpleassets/GpkPackCard.tsx`
- `src/components/simpleassets/AtomicPackCard.tsx`
- `src/components/simpleassets/PackBrowserDialog.tsx`
  - Pass the new collect-success callback chain through to `Index`
- `src/components/simpleassets/SimpleAssetCard.tsx`
  - Allow reuse/styling for landing state if needed
  - Reuse its image/fallback behavior for the moving face-up card so blank-image issues do not return
- `tailwind.config.ts`
  - Add deal/lift/landing keyframes

### Technical details
- The deal order should follow final collection order after refetch, so each card lands in the exact slot it belongs in.
- The grid should show empty reserved spaces only; the card itself should not appear in-place before it flies in.
- The fallback claim stays as a recovery tool, but it must reuse the exact same animation path as the normal claim flow.
- I did not find a reusable deal-animation component in the accessible CHEESEHub files, so this should be implemented to match your described behavior exactly: face-up stack, real card art visible before placement, exact landing positions.
