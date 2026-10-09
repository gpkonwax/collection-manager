# Transfer packs (SimpleAssets token packs + AtomicAssets NFT packs)

## What the user sees
- After pressing **Select**, pack tiles in the main grid join selection mode:
  - **You own exactly 1 of a pack:** the tile itself becomes tickable, just like a card.
  - **You own 2 or more:** the "Open Packs" button on that tile becomes **Select Packs**. It opens a small chooser:
    - **Series 1 / 2 / Exotic packs (token packs):** a − / + quantity picker (they're interchangeable, so you pick how many).
    - **AtomicAssets packs (Food Fight, Crash Gordon, etc.):** each pack is listed by its mint number so you pick exactly which ones go.
- **Packs and cards never mix.** Once any pack is selected, cards can't be ticked (faded with a hover note), and vice versa. Select All / Select 20 only touch cards and are hidden while packs are selected.
- The bottom bar shows "N packs selected" and only **Transfer** for packs (Burn and Bridge are hidden — packs can't be bridged, and burning packs isn't wanted here).
- Transfer opens the same Transfer window, listing the packs (artwork, name, quantity or mint) with Recipient + Memo, then one wallet signature sends everything.
- Cancel Select or a successful transfer clears the pack selection and refreshes pack counts.
- Hidden while viewing another wallet (same as card selection today).

## The important difference
```text
SimpleAssets packs = fungible TOKENS on packs.topps
  -> packs.topps::transfer { from, to, quantity: "3 GPKFIVE", memo }
     one action per pack symbol, quantity formatted with that token's precision
AtomicAssets packs = individual NFTs on atomicassets
  -> atomicassets::transfer { from, to, asset_ids: [...], memo }
     one action with every chosen asset ID
```
Both kinds may go in one transaction. Quantities are capped at the balance owned; asset IDs come only from the user's own pack list.

## Technical section
- New `src/lib/packTransferActions.ts`: `formatPackQuantity(amount, precision, symbol)` (same rule as DonateDialog) and `buildPackTransferActions({ actor, auth, to, memo, tokenQtys: Map<symbol, qty>, atomicIds: string[] })`.
- Index.tsx: new `selectedPackTokens: Map<symbol, qty>` and `selectedPackAssetIds: Set<string>` state alongside `selectedIds`; derive `selectionKind: 'none' | 'cards' | 'packs'`; `toggleSelection` and pack toggles refuse when the other kind is active; `clearSelection` clears all three. Selection bar branches on kind.
- GpkPackCard / AtomicPackCard: new optional props `selectionMode`, `selected`/`selectedCount`, `selectionDisabled`, `onToggleSelect`, `onOpenPackPicker`; when in selection mode the tile click toggles (count 1) or the Open button becomes Select Packs (count ≥ 2). Opening/trade buttons hidden in selection mode. Packs with count 0 are not selectable.
- New `PackSelectDialog.tsx` (quantity stepper for token packs; per-mint checklist with Select all for AtomicAssets packs).
- TransferDialog: accept optional `selectedPacks` and, when present, list packs and build actions via the new helper; card path unchanged.
- Tests (`src/test/packTransferActions.test.ts`): token pack → packs.topps transfer with correct quantity string per precision; AA pack → atomicassets transfer with exact IDs; mixed → two actions; quantity above balance rejected; cards and packs cannot both be selected.
- AGENTS.md rule: pack transfers send token packs via packs.topps::transfer by quantity and AtomicAssets packs via atomicassets::transfer by asset ID, and pack and card selections are mutually exclusive.
