# Disclaimer Update Plan

## Current disclaimer structure (lines 3235-3252 of `src/pages/Index.tsx`)

1. Affiliation disclaimer — not affiliated with Topps, etc.
2. No minting/selling — deploys no new contracts; lists on-chain actions as "pack opening, transfers, burns, claims"
3. "This was peak WAX."
4. geepeekay.com credit — "Original pack artwork for Series 1, Series 2, and Tiger King packs"
5. Fees/risk — no fees, use at own risk, contact info

## Proposed changes (keep minimal)

### 1. Add "trades" to the on-chain actions list (paragraph 2)

The second paragraph lists what on-chain actions the tool executes. Trading is now a major feature (P2P via atomicassets offers + eosio.msig multisig swaps), but it still uses pre-existing public contracts — no new contracts deployed.

**Change:** `"pack opening, transfers, burns, claims"` → `"pack opening, transfers, trades, burns, claims"`

One word added. No new section.

### 2. Expand the geepeekay.com credit line (paragraph 4)

The existing credit covers pack artwork. The Puzzle Builder also uses card-back scans and completed puzzle reference images sourced from geepeekay.com. Expand the single credit sentence to mention the puzzle material too.

**Current:**
> Original pack artwork for Series 1, Series 2, and Tiger King packs is displayed courtesy of geepeekay.com.

**Proposed:**
> Original pack artwork for Series 1, Series 2, and Tiger King packs, plus the classic puzzle card-back scans and reference images used in the Puzzle Builder, are displayed courtesy of geepeekay.com.

Still one sentence. No new paragraph.

## What we are NOT adding
- No separate "Trading" disclaimer section — trading fits naturally in the existing "no new contracts" paragraph and doesn't need its own block.
- No new risk language — the existing "use at your own risk, transactions are irreversible" already covers trades.
- No structural changes to the disclaimer layout.
