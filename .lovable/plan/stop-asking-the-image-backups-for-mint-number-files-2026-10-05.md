# Stop asking the image backups for mint number files

## Goal
Mint numbers, provenance, transfer records and the holders list stop being requested from the 3 image backups (GitHub Pages, Netlify, Cloudflare). Those backups don't hold these files, so every request comes back "not found" and mint numbers show up later than they should. The image backups and their uploads stay exactly as they are.

## What changes
- Record files are looked up in this order: a loaded records ZIP, then the `gpk-data.pages.dev` data site, then raw GitHub (the workflows commit the files there).
- The 3 image backups come off that list. Card pictures still use them as before.
- Puzzle pieces, pack art and retro scans keep their current lookup.

## Technical details
- `src/lib/dataMirror.ts`: change `getDataMirrorBases()` to return only `DATA_MIRROR_URL` (when configured) plus `GITHUB_RAW_MIRROR_URL`, and drop the `MIRRORS` import. Its only callers are `saMintResolver.ts`, `provenance.ts`, `saTransfers.ts` and `resolveDataMirrorPath`, all of which fetch record files.
- `src/lib/gpkHolders.ts`: replace `[DATA_MIRROR_URL, ...MIRRORS.map(m => m.url)]` with `getDataMirrorBases()`.
- Tests: add a test confirming `getDataMirrorBases()` has no image mirror URLs and ends with raw GitHub. Existing resolver tests are unchanged, because they mock the bases.
- Verify: run the tests, then load `?view=hkka4.wam` in the preview and confirm there are no `manifests/mints` requests to the image backups and that ribbons still show mint numbers.
- AGENTS.md rule: record files come only from the records ZIP, the data site and raw GitHub, never from the image mirrors.
