

## Fix Food Fight and Other Pack Unboxing — Use `atomicpacksx` Contract

### Root Cause
Food Fight (template 59072), GameStonk (53187), and WinterCon packs (59489–59492) are mapped to `burnieunpack`, which does not support them. These packs were created using the standard **`atomicpacksx`** contract (by pinknetworkx). The official unpack site is toppsgpk.io/unpack which uses this contract.

Additionally, the `fetchUnboxResults` function queries the wrong way for `atomicpacksx`. The atomicpacks contract stores results in the `unboxassets` table with **scope = pack asset ID**, not scope = contract name.

### What changes

**`src/hooks/useGpkAtomicPacks.ts`**
- Update `PACK_CONFIG` to map Food Fight and WinterCon templates to `atomicpacksx` instead of `burnieunpack`
- Fix card counts based on actual pack configuration (GameStonk = 3 cards, not 5)

```text
Updated PACK_CONFIG:
'13778'  → gpkcrashpack, 5 cards   (unchanged)
'48479'  → burnieunpack, 2 cards   (unchanged)
'51437'  → burnieunpack, 5 cards   (unchanged)
'53187'  → atomicpacksx, 3 cards   (GameStonk — fixed contract + count)
'59072'  → atomicpacksx, 3 cards   (Food Fight — fixed contract)
'59489'  → atomicpacksx, 3 cards   (WinterCon Day 1)
'59490'  → atomicpacksx, 3 cards   (WinterCon Day 2)
'59491'  → atomicpacksx, 3 cards   (WinterCon Day 3)
'59492'  → atomicpacksx, 3 cards   (WinterCon Day 4)
```

**`src/components/simpleassets/AtomicPackRevealDialog.tsx`**
- Fix `fetchUnboxResults` to use `scope: packAssetId` (the atomicpacksx pattern) instead of `scope: contract` with secondary index
- The `burnieunpack` contract likely uses the same table structure since the reveal dialog already works for Crash Gordon (`gpkcrashpack`), so this change should be compatible

**`src/components/simpleassets/AtomicPackBrowserDialog.tsx`**
- No changes needed — it already delegates to the reveal dialog correctly

### Technical detail
Per the [atomicpacks-contract README](https://github.com/pinknetworkx/atomicpacks-contract):
- Transfer pack to `atomicpacksx` with memo `unbox`
- Poll `unboxassets` table with **scope = asset_id of the pack NFT**
- Call `claimunboxed` on `atomicpacksx` with `pack_asset_id` and `origin_roll_ids`

The current `fetchUnboxResults` uses:
```typescript
code: contract, scope: contract, table: 'unboxassets',
index_position: 2, key_type: 'i64',
lower_bound: packAssetId, upper_bound: packAssetId
```

It needs to become:
```typescript
code: contract, scope: packAssetId, table: 'unboxassets', limit: 100
```

This is a simpler query that directly scopes to the pack's results.

