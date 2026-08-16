# Plan: Update the login/landing page with new features

## Goal
The pre-login landing page (the `!isConnected && !isViewing` block in `src/pages/Index.tsx`, ~lines 2697–2850) is out of date — it predates Pack Opening History & Replay and the P2P trading system, both of which now have full sections in the in-app Info dialog. Bring the landing page up to date and add the puzzle-builder unlock note.

## Changes (all in `src/pages/Index.tsx`, landing-page block only)

### 1. Puzzle Builder blurb — add the unlock note
In the existing "Series 2 Puzzle Builder" card (~line 2769), append a sentence to the description:

> Collect all 18 pieces of the **Messy Tessie** Series 2 puzzle and you unlock the full set of classic GPK puzzles — the Series 2 second/third printings, both Series 3 puzzles, Series 4, and both Series 5 puzzles — all playable in the same builder.

This matches the in-app copy ("OS2 — Leaky Lindsay / Messy Tessie") and the existing "classic GPK puzzles unlock with it" notice in `PuzzleBuilder.tsx`.

### 2. Add a "Pack Opening History & Replay" feature card
Add a new `FeatureCard` in the "More Features" grid (icon 🕰️) summarising:
- Rebuild every pack you've ever opened straight from the WAX chain — pack type, date, and full contents.
- Replay any opening through the full reveal and card-deal animation, with the reveal order shuffled each time.
- Download your history as JSON and load it back any time.

### 3. Add a "Card & Pack Trading (P2P)" feature card
Add a new `FeatureCard` in the "More Features" grid (icon 🔄) summarising:
- Propose card-for-card or pack-for-pack trades with any WAX account — no marketplace, no fees.
- AtomicAssets uses the official offer system; SimpleAssets uses an `eosio.msig` multisig swap so both sides execute in one atomic transaction.
- A green badge on the Trades button counts incoming offers from both protocols.

### 4. Light touch-ups to existing cards
- **View Any Wallet** card: append a sentence that the holders dropdown lists every GPK holder largest-to-smallest, perfect for finding accounts to trade with.
- **Filter by Series & Variant** card (or a new small mention): note the two skins — original Dark Cheese and a Bright bubblegum theme inspired by geepeekay.com, switchable from the header.

## Layout note
The "More Features" grid currently uses `sm:grid-cols-2`. Adding two cards keeps it balanced; the existing `sm:col-span-2` "Free Community Tool" card stays centered at the bottom. No new sections or headings are introduced — only new `FeatureCard` entries and text edits, keeping the landing page compact.

## Out of scope
- No changes to the in-app Info dialog (already up to date).
- No logic, state, or backend changes — landing-page copy only.
