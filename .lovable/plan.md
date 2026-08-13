# New Netlify "data mirror" — holders manifest + geepeekay artwork

Confirmed current state:
- `manifests/gpk-topps-holders.json` returns 404 on all three image mirrors (GitHub Pages, Netlify, Cloudflare), so the View Wallet holders dropdown has nothing to load.
- Puzzle artwork in `src/lib/extraPuzzles.ts` is hotlinked live from `https://geepeekay.com/gallery/...` — roughly 135 card-back scans (OS2 x2 printings, OS3 a/b, OS4, OS5 a/b) plus the completed-puzzle reference sheets. If geepeekay.com disappears, every extra puzzle breaks.
- Pack artwork (`gpk_pack_series_*_geepeekay.jpg`) is already bundled inside the app, so it survives regardless — but it will be mirrored too so the offline/local build and any future pack art has a hosted copy.

One small new Netlify site solves all of it, and you never touch the multi-GB image mirror.

## What you do on Netlify (one time)

1. I generate a ready-to-upload folder for you (see below) containing:
   ```text
   gpk-data/
     _headers
     manifests/gpk-topps-holders.json
     packs/            (pack artwork jpgs)
     puzzles/          (geepeekay card-back scans + reference sheets)
   ```
2. Netlify dashboard > Add new site > Deploy manually > drag the whole `gpk-data` folder in.
3. Site settings > Change site name — pick something memorable, then send me the URL.

Total size is small (a few hundred MB at most, likely far less), so re-uploads take seconds.

## What I build

1. **`scripts/build-data-mirror.mjs`** — one command that assembles the `gpk-data` folder:
   - runs/reuses the holders manifest output,
   - downloads every geepeekay puzzle URL listed in `extraPuzzles.ts` (plus the Series 2 NFT reference sheet) into `puzzles/`, with retries and a skip-if-already-downloaded cache,
   - copies the bundled pack artwork into `packs/`,
   - writes `_headers` with permissive CORS,
   - writes `manifests/data-mirror-index.json` listing every file with its SHA-256 and byte size, so the audit script can verify the upload.
2. **`src/lib/dataMirror.ts`** — resolves a data-mirror path against the new Netlify site, falling back to the three existing mirrors, then to the original geepeekay URL as a last resort. Same timeout/racing style as the existing mirror-first helpers.
3. **`src/lib/extraPuzzles.ts`** — pieces keep a stable relative path (`puzzles/os3/os3back_85a.JPG`) plus the original geepeekay URL; the builder resolves through `dataMirror` so mirrored copies are preferred and geepeekay becomes the fallback rather than the only source.
4. **`src/lib/gpkHolders.ts`** — fetch the holders manifest from the data mirror list instead of the image-mirror list, keeping the existing `not-published` vs `network` error distinction.
5. **`src/components/BackupPanel.tsx`** — add a "Data mirror (manifests + artwork)" row to the mirror status list so you can see at a glance whether it is live.
6. **`scripts/audit-mirrors.mjs`** — extend it to verify the data mirror against `data-mirror-index.json` (missing files, size/hash mismatches).

## Technical notes

- Filenames are normalised to lowercase on disk and in code (geepeekay mixes `.JPG` and `.jpg`, which breaks on case-sensitive hosts).
- No hash pinning enforcement at runtime for these files — they are public artwork; the index exists for auditing, not trust.
- The image mirror, its pinned manifest, and the offline ZIP bundles are untouched.
- Downloads are rate-limited and polite (small concurrency, backoff) so we don't hammer geepeekay.com.

Once you confirm, I'll build the script and the app wiring; you then run one command, drag the folder to Netlify, and send me the URL so I can pin it in the config.
