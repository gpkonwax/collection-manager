

## Fix Pack Opening: Blank Images & Collect Failure

### Two bugs identified:

### Bug 1: Collect transaction fails — wrong field name
The error says `Encoding error at root<getcards>.cardids<uint64[]>: Expected array for: uint64[]`.

The smart contract expects the field `cardids`, but the code sends `card_ids` (with underscore). In `PackRevealDialog.tsx` line 181:
```
data: { from: actor, unboxing: unboxingId, card_ids: pendingRowIds }
```
Must change to:
```
data: { from: actor, unboxing: unboxingId, cardids: pendingRowIds }
```

The `pendingRowIds` is already a `number[]`, which serializes correctly as `uint64[]`. No special string formatting needed — the `[38477 , 35673 , 58474]` format the user described is just how arrays naturally serialize. The field name was the actual problem.

### Bug 2: Blank card images during reveal
The `buildGpkCardImageUrl` function only uses the first IPFS gateway (Pinata). If Pinata is down or rate-limited, every card shows blank. 

Fix: Add IPFS gateway fallback to the card images in `PackRevealDialog.tsx`. When an `<img>` fails to load (`onError`), cycle to the next gateway. This matches the fallback pattern already used in `SimpleAssetCard.tsx` and `SimpleAssetDetailDialog.tsx`.

### Changes:

**File: `src/components/simpleassets/PackRevealDialog.tsx`**
1. Fix `card_ids` → `cardids` in the `getcards` action data (line 181)
2. Add `onError` handler to card `<img>` tags that swaps the IPFS gateway domain to the next one in the `IPFS_GATEWAYS` list
3. Track per-card gateway index in state so each card can independently retry

**File: `src/components/simpleassets/AtomicPackRevealDialog.tsx`**
1. Same IPFS fallback treatment for the card `<img>` tags (line 199)

