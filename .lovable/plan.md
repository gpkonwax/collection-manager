# Trade from a stacked binder card

## What happens today
In Collector Binder view on someone else's wallet, stacked doubles show one Trade button. Clicking it starts a trade for a single, arbitrary copy of the card — you can't pick which mint you want.

## What we'll build
Clicking Trade on a stacked card in Binder view opens a modal (same look as the existing stack window) that lists every copy in the stack as its own card, each with its own Trade button. Clicking a copy's Trade button starts the trade composer for that exact asset, exactly as if you had clicked that card individually.

## Changes

1. **BinderStackDialog** (`src/components/simpleassets/BinderStackDialog.tsx`)
   - Add an optional `onTradeAsset?: (asset) => void` prop.
   - When set, each card in the grid gets its own Trade button (via the existing `onTradeClick`/`isReadOnly` support in `SimpleAssetCard`), and the dialog description reads "select one to propose a trade".
   - Clicking a card body still opens the detail view; only the Trade button starts a trade.

2. **Index.tsx**
   - Track which stack the Trade click came from: when a Trade click lands on a stacked card in Binder view (`stackCount > 1`), open the stack dialog in trade mode with that stack's assets instead of going straight to the composer.
   - Single (unstacked) cards keep the current behavior — Trade opens the composer immediately.
   - Picking a copy in the trade-mode stack dialog calls the existing `handleTradeFromCard(asset)` and closes the dialog.
   - Trade mode only appears when viewing another wallet (read-only), matching the existing trade-button rules; your own binder keeps selection-free browsing.

3. **Wiring detail**
   - The binder grid's Trade handler currently receives only the clicked asset; extend it so the handler also receives the stack's full asset list (or look the stack up from the existing `stackedAssets` grouping) so the dialog shows the exact same copies as a normal stack click.

## Verification
- Typecheck + existing tests pass.
- Playwright: view a second wallet in Binder view, click Trade on a stacked card, confirm the modal lists each copy with its own Trade button, click one, and confirm the trade composer opens with that exact asset pre-filled.
