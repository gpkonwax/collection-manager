# Finish the Cloudflare data mirror (manifest received)

Your uploaded `gpk-topps-holders.json` is valid: generated 2026-07-30, 14,255 accounts, 499,880 SimpleAssets + 436,424 AtomicAssets holdings, 1.3 MB. It just needs to go into the mirror folder and up to Cloudflare.

The build script, `_headers` CORS file, audit script and Backup panel row are already done from the last step. What remains is the manifest, the upload, and pointing the app at the new URL.

## What I do (once you approve)

1. Copy your uploaded manifest to `manifests/gpk-topps-holders.json` in the project (this is the location the build script now looks in first, so future rebuilds pick it up automatically).
2. Run `node scripts/build-data-mirror.mjs`. Takes seconds — puzzle images are already on disk. Result: `scripts/data-mirror-output/gpk-data` with 132 files, including your manifest, and a refreshed `data-mirror-index.json` listing every file with its size and sha256.
3. Repackage `scripts/data-mirror-output/gpk-data.zip` (~9.7 MB) for you to download.

## What you do

Step 1 — download
- Download `scripts/data-mirror-output/gpk-data.zip` and unzip it. Inside you must see four things: `_headers`, `manifests/`, `packs/`, `puzzles/`.

Step 2 — create the Cloudflare Pages site
- Go to dash.cloudflare.com and sign in.
- Left sidebar: **Compute (Workers & Pages)** → **Pages** tab.
- **Create application** → **Pages** → **Upload assets**. (This is drag-and-drop; you do not need GitHub.)
- Project name: `gpk-data` → your site becomes `https://gpk-data.pages.dev`. If that name is taken, use `gpk-data-mirror` and tell me the final name.
- Drag in the **contents** of the unzipped folder, so `_headers` sits at the top level of the upload — not a folder named `gpk-data` wrapping everything. This is the single most common mistake; if you get it wrong the files end up at `/gpk-data/manifests/...` and the app won't find them.
- Click **Deploy site** and wait for "Success".

Step 3 — send me the URL
- Copy the URL it shows (e.g. `https://gpk-data.pages.dev`) and paste it here.

## What I do after you send the URL

- Set `DATA_MIRROR_URL = 'https://gpk-data.pages.dev/'` (trailing slash required) in `src/lib/dataMirror.ts`.
- Verify from the sandbox that these load with `Access-Control-Allow-Origin: *`:
  - `manifests/data-mirror-index.json`
  - `manifests/gpk-topps-holders.json` (must report 14,255 accounts)
  - one puzzle image and one pack image
- Run `node scripts/audit-mirrors.mjs` — it now reads the URL straight from `src/lib/dataMirror.ts` and checks all 132 files against the index.
- Confirm in the app that the Backup panel "Data mirror (Cloudflare)" row turns green with the file count, and that the View Wallet holders dropdown loads from Cloudflare.

## Notes

- Re-publishing later: I rebuild the folder, you open the Cloudflare project → **Create deployment** → drag the folder again. The main URL always serves the newest deployment.
- The manifest is a snapshot dated 2026-07-30. When you want fresher numbers, run `node scripts/build-holders-manifest.mjs` (the ~30-minute WAX scan) and we repeat the upload.
