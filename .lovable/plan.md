

## Update Pack Opening Wait Messages Across All Dialogs

### Problem
Current messaging says "This usually takes 2-15 seconds" which sets wrong expectations — Food Fight packs can take 2-3 minutes. Users panic when it takes longer than promised.

### Changes

**1. `src/components/simpleassets/PackRevealDialog.tsx`** (token-based packs)
- Default message: change from "This usually takes 2-15 seconds" to something like "This can take anywhere from a few seconds to 2-3 minutes depending on the indexer. Don't worry — your cards are on their way! You'll hear bell rings when they're revealed."
- 30s elapsed: "Still working... the indexer is processing your cards. Sit tight!"
- 60s elapsed: "Almost there — the blockchain is a little busy right now. Your cards are safe and will appear shortly."
- Escape timeout stays at 60s

**2. `src/components/simpleassets/AtomicPackRevealDialog.tsx`** (atomic/Food Fight packs)
- Same default message update as above
- 30s elapsed: "Still working... the indexer is processing your cards. Sit tight!"
- 60s elapsed: "Almost there — the blockchain is a little busy right now. Your cards are safe and will appear shortly."
- 90s elapsed: "The indexer is running behind, but don't worry — your cards are definitely coming. Hang in there!"

**3. Demo mode in both dialogs**
- During the 4-second demo wait, show the same reassuring default message so users get familiar with the tone before real openings

### Tone
Friendly, reassuring, mentions bell rings on reveal. No alarming language like "unusually long."

### Files Changed
- `src/components/simpleassets/PackRevealDialog.tsx`
- `src/components/simpleassets/AtomicPackRevealDialog.tsx`

