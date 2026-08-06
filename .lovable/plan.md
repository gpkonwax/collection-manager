# Extra Puzzles in the Puzzle Builder (OS2 2nd/3rd printing, OS3, OS4, OS5)

Add five more classic GPK puzzles to the Puzzle Builder, built from the scanned card-back JPGs hosted on geepeekay.com instead of from NFTs. They stay hidden until the existing NFT-based Series 2 puzzle is unlocked (all 18 pieces owned).

## The puzzles

| Puzzle | Pieces | Source folder | Image pattern |
|---|---|---|---|
| OS2 — Live Mike / Jolted Joel (2nd & 3rd printing) | 18 | `/gallery/os2/backs/` | `os2_back_<num>lm.jpg` |
| OS3 A — Snooty Sam / U.S. Arnie (blue) | 18 | `/gallery/os3/backs/` | `os3back_<num>a.JPG` |
| OS3 B — Mugged Marcus / Kayo'd Cody (yellow) | 18 | `/gallery/os3/backs/` | `os3back_<num>b.JPG` |
| OS4 — Bony Tony / Unzipped Zack (green) | 21 | `/gallery/os4/backs/` | `os4_back_green_01..21.jpg` |
| OS5 D — Handy Randy / Jordan Nuts (orange) | 21 | `/gallery/os5/backs/` | `os5_back_<num>a.jpg` |
| OS5 E — Dee Faced / Terri Cloth (purple) | 21 | `/gallery/os5/backs/` | `os5_back_<num>b.jpg` |

Card numbers used per puzzle are hard-coded from the site's puzzle reference sheets (`puzzleback_18numbers_os2LM.jpg`, `..._os3SS.jpg`, `..._os3MM.jpg`, `puzzleback_os4.png`, `os5_orangepuzzle.png`, `os5_purplepuzzle.png`). Each list will be checked against the live image URLs during the build so no piece 404s.

The OS5 orange reference sheet confirms the split: its 21 pieces are all `A` cards (194A, 186A, 198A, 169A, …), so `a` backs form the first puzzle of a pair and `b` backs the second. The same check gets applied to OS3 before the lists are locked in.

## Completed-picture reference

Every puzzle gets its "here is what your completed puzzle will look like" box art, so you can see the target while building:

| Puzzle | Reference image |
|---|---|
| OS2 1st printing (existing NFT puzzle) | `/gallery/os2/puzzleback_18numbers_os2LL.jpg` |
| OS2 2nd/3rd printing | `/gallery/os2/puzzleback_18numbers_os2LM.jpg` |
| OS3 A (blue) | `/gallery/os3/puzzleback_18numbers_os3SS.jpg` |
| OS3 B (yellow) | `/gallery/os3/puzzleback_18numbers_os3MM.jpg` |
| OS4 (green) | `/gallery/os4/backs/puzzleback_os4.png` |
| OS5 D (orange) | `/gallery/os5/backs/os5_orangepuzzle.png` |
| OS5 E (purple) | `/gallery/os5/backs/os5_purplepuzzle.png` |

- Shown as a small thumbnail in the toolbar next to the puzzle name, with a "Reference" label.
- Clicking it opens a lightbox with the full sheet — which also lists the exact card numbers in that puzzle, so it doubles as the checklist.
- The existing NFT Series 2 puzzle gets the OS2 1st-printing reference too, so the feature is consistent across all seven.
- The sheets include a grey/blank "picture only" crop on the left and the numbered piece grid on the right; both are part of the same image, so no cropping work is needed.

## How it behaves

- The Puzzle tab keeps showing today's NFT Series 2 puzzle exactly as it does now, including the "you have X of 18" lock screen.
- Once you own all 18 NFT pieces, a puzzle selector appears above the canvas: `Series 2 (Your NFTs)` plus the six extra puzzles, each with a small label and piece count. Locked state shows the extras greyed out with a "Complete your Series 2 NFT puzzle to unlock" note.
- Selecting an extra puzzle loads its pieces onto the same canvas with the same behaviour: drag, 90° rotate, Scramble, and the optional Timer race.
- Each puzzle keeps its own layout in memory, so switching back and forth doesn't lose progress.
- Save/Load JSON keeps working: the export becomes keyed by puzzle id, and older single-puzzle files still import into the Series 2 NFT puzzle.
- 21-piece puzzles lay out on a 7×3 default grid; 18-piece ones stay 6×3.


## Technical notes

- New `src/lib/extraPuzzles.ts`: a `ExtraPuzzle` type (`id`, `name`, `series`, `subtitle`, `pieceCount`, `referenceUrl`, `pieces: { key, url }[]`) and a `EXTRA_PUZZLES` array with the six definitions, URLs built from geepeekay.com paths above. The existing NFT puzzle gets a `referenceUrl` constant alongside it.
- Reference thumbnail is a small `<img>` button in the toolbar opening a shadcn `Dialog` with the full-size sheet (`max-h-[85vh] object-contain`), so it never overflows.
- `PuzzleBuilder.tsx` is generalised from "assets" to a piece list: an internal `PuzzlePiece = { key: string; imageUrl: string }` derived either from the NFT assets (current path, key = cardid) or from an `ExtraPuzzle`. Drag/rotate/scramble/timer logic is untouched.
- Add `activePuzzleId` state plus a `Map<puzzleId, Map<key, PieceState>>` so layouts persist per puzzle within the session.
- Unlock gate: `puzzleAssets.length >= TOTAL_PUZZLE_PIECES` (already computed) drives whether the selector is enabled.
- Images: plain `<img>` with `loading="lazy"` — these are HTTPS jpgs on geepeekay.com, not IPFS, so `IpfsMedia` is bypassed for extra puzzles. Failed loads render the existing "No image" tile.
- `PuzzlePieceMap` export shape becomes `Record<puzzleId, Record<key, PieceState>>` with a back-compat read for the flat legacy shape in `applyImportedState` and in `Index.tsx`'s `handleExportPuzzle` / `importedPuzzle` wiring.
- No changes to the NFT/collection logic, binder, or backup mirrors.

## Open item

These images are hotlinked from geepeekay.com. If you want them included in the offline backup mirrors (so the extra puzzles still work with IPFS/site down), that's a follow-up: ~117 small jpgs added to the mirror manifest and a mirror-first URL resolver, same pattern as card images.
