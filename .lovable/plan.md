

## Fix: Crash Gordon Pack Reveal Polling

### Problem
The `gpkcrashpack` contract's `unboxassets` table is being polled with `scope = packAssetId` (the NFT asset ID like `1099511932586`), but this contract likely uses `scope = accountName` (e.g. `guydgnjzgage`). Every poll returns empty rows, trapping the user forever.

### Root Cause
In `AtomicPackRevealDialog.tsx`, `fetchUnboxResults()` always uses `scope: packAssetId`. This works for some contracts but not all. The `gpkcrashpack` contract appears to scope its `unboxassets` table by the user's account name instead.

### Solution
Try both scopes — first the pack asset ID, then fall back to the account name. Also add a timeout escape hatch so users are never permanently trapped.

### Technical Details

**File: `src/components/simpleassets/AtomicPackRevealDialog.tsx`**

1. **Update `fetchUnboxResults` to accept and try both scopes**:
   - First try `scope = packAssetId` (works for most contracts)
   - If empty, retry with `scope = accountName`
   - Return whichever has results

2. **Pass `accountName` into the polling logic for the fallback scope**:
   - The poll function already has access to `accountName` — just pass it through to `fetchUnboxResults`

3. **Add a 60-second escape hatch** (from the previously proposed plan):
   - Add `showEscape` state, set `true` after 60s via `setTimeout`
   - Render a "Close & Check Later" button in the waiting phase
   - Wire to existing `handleClose`

**File: `src/components/simpleassets/PackRevealDialog.tsx`**
   - Same escape hatch addition (this dialog already uses account-scoped polling so the scope issue doesn't apply here)

### Updated `fetchUnboxResults` signature

```ts
async function fetchUnboxResults(
  contract: string, 
  packAssetId: string, 
  accountName?: string
): Promise<UnboxResultRow[]> {
  // Try pack asset ID scope first
  const result = await fetchTableRows({ 
    code: contract, scope: packAssetId, table: 'unboxassets', limit: 100 
  });
  if (result.rows.length > 0) return result.rows;
  
  // Fallback: try account name scope
  if (accountName) {
    const fallback = await fetchTableRows({ 
      code: contract, scope: accountName, table: 'unboxassets', limit: 100 
    });
    return fallback.rows;
  }
  return [];
}
```

### Immediate Action
Refresh the page to escape the stuck modal. Your cards may have already been minted — they should appear in your collection after refresh.

