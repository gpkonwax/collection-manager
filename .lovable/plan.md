

## Add Recovery Button for Unclaimed Atomic Pack Cards

### Problem
When a transfer-mode atomic pack (e.g., Crash Gordon via `gpkcrashpack`) is opened but the reveal dialog is closed before collecting, the cards sit unclaimed in the contract's `unboxassets` table with no way to claim them from the main UI.

### Approach
Add a check on page load (alongside the existing `pendingnft.a` check) that polls the `unboxassets` table for each transfer-mode contract. If unclaimed rows are found, show a "Claim Unboxed Cards" button in the utility bar next to the existing "Collect Unclaimed" button.

### Changes

**`src/pages/Index.tsx`**:
1. Add state for `pendingAtomicClaims` — an array of `{ contract, pack_asset_id, origin_roll_ids }` objects
2. On mount (when `accountName` is set), poll the `unboxassets` table for each transfer-mode contract (`gpkcrashpack`, `burnieunpack`) using `scope = accountName`
3. If rows are found, show a "Claim Unboxed Cards" button in the utility bar
4. On click, execute `claimunboxed` action for each contract/pack group, then refetch assets
5. Show the transaction success dialog on completion

**`src/components/simpleassets/AtomicPackRevealDialog.tsx`**:
- Export `fetchUnboxResults` so it can be reused from `Index.tsx`

### Technical Detail

The contracts that need checking are those with `openMode: 'transfer'` in `PACK_CONFIG`:
- `gpkcrashpack` (template 13778)
- `burnieunpack` (templates 48479, 51437)
- `atomicpacksx` (templates 53187, 59072)

The `claimunboxed` action signature:
```ts
{ account: contract, name: 'claimunboxed', data: { pack_asset_id, origin_roll_ids } }
```

The recovery check will group rows by `pack_asset_id` and call `claimunboxed` for each group.

