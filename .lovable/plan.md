

## Add Burn NFTs Feature

### What It Does
Adds a "Burn" button next to the existing "Transfer" button in the selection mode bar. When clicked, it opens a confirmation dialog showing the selected NFTs and requires the user to confirm before burning. Supports both SimpleAssets (`burn` action on `simpleassets` contract) and AtomicAssets (`burnasset` action on `atomicassets` contract) in a single transaction.

### Changes

**1. Update `burnNFTs` in `src/context/WaxContext.tsx`**
The existing `burnNFTs` only handles AtomicAssets. Update it to also handle SimpleAssets by checking the asset source and building the correct action for each contract:
- SimpleAssets: `{ account: 'simpleassets', name: 'burn', data: { owner, assetids: [...] } }`
- AtomicAssets: `{ account: 'atomicassets', name: 'burnasset', data: { asset_owner, asset_id } }` (one per asset)

The function signature changes to accept `SimpleAsset[]` instead of just `string[]` so it can distinguish the source.

**2. Create `src/components/simpleassets/BurnDialog.tsx`**
A new dialog modeled after `TransferDialog` but simpler (no recipient/memo fields). It will:
- Show the list of selected NFTs with thumbnails
- Display a count breakdown (SimpleAssets vs AtomicAssets)
- Include a prominent warning: "This action is irreversible. Burned NFTs cannot be recovered."
- Require typing "BURN" to confirm (safety measure)
- Execute the burn transaction on confirm
- Call `onSuccess` with the transaction ID

**3. Update `src/pages/Index.tsx`**
- Add `burnDialogOpen` state
- Import and render `BurnDialog`
- Add a red "Burn" button (with `Flame` icon) next to the Transfer button in the selection mode bottom bar
- Wire up success handler to clear selection, refresh assets, and show the transaction success dialog

### Also
- Update the info blurb: remove "Burn unwanted NFTs." from the aspirational list since it will now be a real feature, or keep it as-is since it will be accurate.

### Files Changed
- `src/context/WaxContext.tsx` — update `burnNFTs` to handle both contract types
- `src/components/simpleassets/BurnDialog.tsx` (new) — burn confirmation dialog
- `src/pages/Index.tsx` — add burn button and dialog

