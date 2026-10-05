# Extra artwork on all 3 mirrors, record files from their own sources only

## Goal
- Puzzle backs, pack art and 1985 retro scans load from any of the 4 sites, so the app keeps working if one goes down.
- Mint numbers, holders, provenance and transfer records are no longer requested from the 3 image backups. Those requests always fail ("not found"), which slows down mint numbers.

## What changes

1. **Extra artwork goes onto the 3 image backups**
   - The data-mirror build already downloads `puzzles/`, `retro/` and pack art. It will also copy those folders into the image mirror output, so the next image upload puts them on GitHub, Netlify and Cloudflare.
   - The audit script checks those folders on all 4 sites.

2. **Artwork lookup tries every site in turn**
   - Puzzle pieces, retro scans and pack art try the data site first, then the 3 image backups, then the original geepeekay link as a last resort.
   - Each site gets 8 seconds, the same as card pictures. Until the image backups are re-uploaded, those extra steps fail quickly and nothing looks different.

3. **Record files skip the image backups**
   - A new lookup list for records: loaded records ZIP, then `gpk-data.pages.dev`, then raw GitHub (the workflows commit there). The 3 image backups are no longer on that list.
   - Applies to mint numbers, provenance, SA transfers and the holders list.

## What you need to do afterwards
- Re-upload the image mirror (the same steps as before) so the 3 backups get the new folders. The app works before and after this upload.

## Technical details
- `src/lib/dataMirror.ts`: add `getRecordBases()` (data site + `GITHUB_RAW_MIRROR_URL`) and `getArtworkBases()` (data site + `MIRRORS`). `resolvePuzzleImage` returns an ordered `sources[]` list and keeps `fallback`.
- Switch `saMintResolver.ts`, `provenance.ts`, `saTransfers.ts` and `gpkHolders.ts` to `getRecordBases()`.
- `retroScans.ts`, `RetroScanImage`, the puzzle image components and the pack art loader move through `sources[]` on each onError or 8s timeout, then try geepeekay.
- `scripts/build-data-mirror.mjs`: add a `--into <mirror-output>` option that copies `puzzles/`, `retro/` and `packs/` into the image mirror tree. Update `scripts/README.md` and `audit-mirrors.mjs`.
- Tests: update `saMintResolver.test.ts` mocks, add record-base tests (no image mirror URLs) and a test for the artwork fallback order.
- Add an AGENTS.md rule: record files come only from the records ZIP, the data site and raw GitHub. Static artwork is replicated on every mirror.
