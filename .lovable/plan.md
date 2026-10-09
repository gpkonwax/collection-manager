# Correct duplicate mint ordering in Classic View

## Goal
Make copies of the same card appear left to right by lowest displayed original mint, including copies with different variants and copies split across SimpleAssets and AtomicAssets.

## What I confirmed
- Classic View uses the shared natural-card comparator before collection filters are applied.
- That comparator currently prioritizes variant before mint unless category, card ID, side, and variant all match.
- In the Tiger King example, Base and Prism copies of the same `1a` card are therefore separated by variant rank, allowing `#3616` and `#3637` to appear before `#2101` and `#1173`.
- Because every collection uses this comparator, the same issue can affect other collections when one card has copies across variants.

## Changes
1. Treat cards with the same collection, card ID, and side as copies for Classic View ordering, regardless of variant.
2. Order those copies by displayed original mint, lowest first; never use bridge mint.
3. Keep unresolved mint numbers after resolved copies, while retaining deterministic ordering when mint values tie or are unavailable.
4. Preserve the existing card-ID and side sequence between different cards, and leave alternate sort modes and Saved layouts unchanged.
5. Add focused checks covering:
   - Tiger King Base and Prism copies in the reported arrangement.
   - Mixed SimpleAssets and AtomicAssets copies.
   - Another collection to prove the shared rule applies everywhere.
   - Original mint versus bridge mint and unresolved mint behavior.
6. Run the relevant sorting checks, the full test suite, and verify the Tiger King row in Classic View.

## Technical detail
The correction stays in the shared Classic View comparator and its tests. No collection-specific exception or metadata rewrite will be introduced.
