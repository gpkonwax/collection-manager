

## Batch Transfer with Checkbox Selection

### How it works

WAX supports multiple actions from different contracts in a single transaction, so **SimpleAssets and AtomicAssets can be sent together in one transaction**. Each contract gets its own action in the actions array — the blockchain processes them atomically.

### User flow

1. A "Select" toggle button appears in the toolbar (next to search/filters).
2. When active, each card shows a checkbox overlay. Tapping a card toggles selection instead of opening the detail dialog.
3. A floating bottom bar appears showing: selected count, a "Transfer" button, and a "Cancel" button.
4. Clicking "Transfer" opens a modal with:
   - List of selected cards (thumbnails + names)
   - Recipient WAX account input (validated: 1-12 chars, a-z1-5.)
   - Optional memo input
   - Send button
5. On submit: builds a single transaction with up to two actions:
   - One `simpleassets::transfer` action (if any SimpleAssets selected)
   - One `atomicassets::transfer` action (if any AtomicAssets selected)
6. On success: show TransactionSuccessDialog, clear selection, refetch assets.

### Files to change

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `selectionMode` toggle state, `selectedIds` Set state. When selection mode is on, card click toggles selection. Render floating selection bar. Render `TransferDialog`. Pass checkbox state to `SimpleAssetCard`. |
| `src/components/simpleassets/SimpleAssetCard.tsx` | Add optional `selected` and `onSelect` props. When in selection mode, show a checkbox overlay on the card. |
| `src/components/simpleassets/TransferDialog.tsx` | **New file.** Modal with selected cards summary, recipient input, memo input, send button. Builds combined transaction actions, calls `session.transact` directly. |
| `src/context/WaxContext.tsx` | Add `transferSimpleAssets(to, assetIds, memo)` function using the `simpleassets` contract `transfer` action. Expose in context. |

### Technical details

**Combined transaction structure:**
```text
actions: [
  { account: 'simpleassets', name: 'transfer',
    data: { from, to, assetids: [...], memo } },   // only if SA selected
  { account: 'atomicassets', name: 'transfer',
    data: { from, to, asset_ids: [...], memo } },   // only if AA selected
]
```

- Selection state: `Set<string>` of asset IDs, managed in Index.tsx
- The `SimpleAsset` type already has a `source` field (`'simpleassets' | 'atomicassets'`) to partition selected IDs
- Floating bar uses fixed positioning at bottom of viewport
- Checkbox styled with cheese theme to match existing UI
- WAX account validation regex: `/^[a-z1-5.]{1,12}$/`

