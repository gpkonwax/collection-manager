

## Add "Collect Unclaimed Cards" Button

### Problem
After opening a pack, if the `getcards` transaction fails or the dialog is closed before collecting, the cards remain in the `pendingnft.a` table uncollected. There's currently no way to retry collection outside the reveal dialog.

### Solution
Add a "Collect Unclaimed Cards" button to the main page that:
1. Scans the user's `pendingnft.a` table for any rows with `done === 0`
2. Groups them by `unboxingid`
3. For each group, calls `gpk.topps::getcards` with the correct `unboxingId` and `cardids`
4. Shows success/error feedback via toast

### Changes

**File: `src/pages/Index.tsx`**
- Import `fetchTableRows` from `waxRpcFallback` and `Session` type
- Add a "Collect Unclaimed Cards" button in the packs section (visible only when connected)
- On click: fetch `pendingnft.a` for the user, group by `unboxingid`, and call `getcards` for each group sequentially
- Show loading state during collection, toast on success/failure

**File: `src/components/simpleassets/PackRevealDialog.tsx`**
- Export the `fetchPendingNfts` function so it can be reused from Index.tsx (currently module-private)

### Technical detail
- Reuses the existing `fetchPendingNfts` helper (just needs to be exported)
- Groups all `done === 0` rows by `unboxingid`, then fires one `getcards` transaction per group
- Each transaction: `{ account: 'gpk.topps', name: 'getcards', authorization: auth, data: { from: actor, unboxing: unboxingId, cardids: rowIds } }`
- Sequential execution to avoid nonce conflicts

