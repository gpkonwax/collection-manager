# Publish the data mirror on Cloudflare Pages

Goal: get the small data files (holders list, puzzle card-back scans, pack art) onto a dedicated Cloudflare Pages site, separate from the big image mirror, and point the app at it.

The build folder already exists and contains 131 files (8.6 MB): `scripts/data-mirror-output/gpk-data` with `puzzles/`, `packs/`, `manifests/data-mirror-index.json`, and a `_headers` file. The only thing missing inside it is your holders manifest.

## What I will change in code

1. `scripts/build-data-mirror.mjs`
   - Also look for the holders manifest in `manifests/gpk-topps-holders.json` at the project root and in `scripts/data-mirror-output/incoming/`, not only in `scripts/mirror-output/manifests/`. That way, wherever you drop the file, the build finds it.
   - Rewrite `_headers` for Cloudflare Pages (same CORS rule, Cloudflare Pages reads `_headers` the same way Netlify does, so this is a one-line comment/format change only).
   - Regenerate `data-mirror-index.json` so it lists the holders manifest with its size and hash.

2. `src/lib/dataMirror.ts`
   - Set `DATA_MIRROR_URL` to your Cloudflare Pages URL once you give it to me (must end with `/`). Comments updated to say Cloudflare instead of Netlify.

3. `src/components/BackupPanel.tsx`
   - Rename the "Data mirror" row label to "Data mirror (Cloudflare)".

4. `scripts/audit-mirrors.mjs`
   - Point the data-mirror audit at the Cloudflare base URL.

No other app behaviour changes: holders lookup, puzzle images, and pack art already prefer the data mirror and fall back to geepeekay.com / the image mirrors.

## What you do, step by step (first-timer version)

Step 1 — put your manifest where the build can see it
- Find your `gpk-topps-holders.json` file on your computer.
- Tell me where you have it, or upload it here. If you upload it I will place it into the mirror folder for you.

Step 2 — I rebuild the folder
- I run `node scripts/build-data-mirror.mjs`. It takes seconds (puzzle images are already downloaded and are skipped). It will not run the 30-minute holders scan.
- Result: `scripts/data-mirror-output/gpk-data` now has 132 files including your holders manifest.

Step 3 — you download that folder
- In the Lovable file view, download the `gpk-data` folder (or the ZIP I generate for you) to your computer and unzip it. Inside it you must see: `_headers`, `manifests/`, `packs/`, `puzzles/`.
- Important: you upload the *contents* of `gpk-data`, i.e. `_headers` must be at the top level of what you upload — not a folder called `gpk-data` sitting above it.

Step 4 — create the Cloudflare Pages project
- Go to dash.cloudflare.com and sign in.
- In the left sidebar click **Compute (Workers & Pages)**, then the **Pages** tab.
- Click **Create application** > **Pages** > **Upload assets** (this is the drag-and-drop option; you do NOT need to connect GitHub).
- Project name: `gpk-data` (this becomes `https://gpk-data.pages.dev`). If the name is taken, pick e.g. `gpk-data-mirror` — just tell me the final name.
- Drag the *contents* of your unzipped `gpk-data` folder into the upload box. 132 small files, ~9 MB — this uploads in well under a minute. Cloudflare's 25 MB per-file limit is not an issue here; the largest file is a few hundred KB.
- Click **Deploy site**, wait for "Success", then click the link to see your site URL.

Step 5 — you send me the URL
- It looks like `https://gpk-data.pages.dev`. Send it to me exactly as shown.

Step 6 — I wire it in and verify
- I set `DATA_MIRROR_URL = 'https://gpk-data.pages.dev/'` (with trailing slash).
- I check three URLs load with correct CORS headers:
  - `.../manifests/data-mirror-index.json`
  - `.../manifests/gpk-topps-holders.json`
  - one puzzle image, e.g. `.../puzzles/os3/backs/...jpg`
- I run `node scripts/audit-mirrors.mjs` so every file in the index is confirmed present.
- I check the Backup panel shows the Data mirror row green with a file count, and the View Wallet dropdown loads the holders list from Cloudflare rather than GitHub.

## Notes

- Updating later: re-run the build script, then in Cloudflare open the project > **Create deployment** > drag the folder again. Old deployments stay available; the main URL always serves the newest.
- Custom domain is optional and not needed — `*.pages.dev` is already fast and CORS-enabled via `_headers`.
- This site is intentionally separate from the multi-GB image mirrors, so republishing a manifest never means re-uploading gigabytes.
