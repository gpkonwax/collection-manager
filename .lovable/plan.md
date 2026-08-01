# Publish the new ZIPs and get the app pointing at them

The three parts are built and you have given me their exact sizes and checksums. Two things now have to happen: the project's copy of the manifest must be corrected, and the files must go up to the mirrors.

## What is wrong right now

The project's `public/gpk-manifest.json` is stale. It lists only **832** files (your rebuilt one has 2575), its `zipParts` sizes are from the previous build, and every `sha256` in it is an empty string. The app reads this file to decide what to offer for download, and `audit-mirrors.mjs` reads it to decide what to check — so until it is replaced, both are working from wrong data.

## Step 1 — I patch the ZIP part details (I do this, no action from you)

I will update the `zipParts` block in `public/gpk-manifest.json` to exactly what you pasted:

```text
part-001   1,885,365,317 bytes   905 files   sha256 cfcd4bf6…
part-002   1,884,197,424 bytes  1186 files   sha256 a7c6f4c6…
part-003     917,537,907 bytes   485 files   sha256 e37ea9ff…
```

This immediately fixes the download panel's sizes and the ZIP portion of the audit. The file-list part of the manifest gets fixed in Step 4, once the merged manifest is live somewhere I can read it.

## Step 2 — Upload the three ZIPs to the GitHub Release

1. Open the `gpkonwaxbackup` repository in a browser → **Releases** → open the release that holds the ZIP parts.
2. Click **Edit** (the pencil icon).
3. In the assets list, remove **every** old `gpk-image-mirror-part-*.zip` with the small **x** beside it. They must go — their checksums no longer match, and a mix of old and new parts corrupts an import silently.
4. Open `C:\Users\User\Desktop\gpk-zip-src` in File Explorer, select the three new `gpk-image-mirror-part-00*.zip` files, and drag them onto the upload box.
5. Wait for all three bars to reach 100%. That is 4.37 GB — leave the tab open and do not navigate away.
6. Click **Update release**, then reload the page and confirm exactly three assets are listed.

## Step 3 — Refresh the three image mirrors

### 3a. GitHub Pages (primary)

```bat
copy /Y C:\Users\User\Desktop\gpk-zip-src\manifest.json C:\Users\User\Desktop\gpkonwaxbackup-repo\manifest.json
```

```bat
robocopy C:\Users\User\Desktop\gpk-zip-src C:\Users\User\Desktop\gpkonwaxbackup-repo /E /XF *.zip /XO
```

`/XF *.zip` keeps the giant ZIPs out of the repo — they live only on the Release. `/XO` skips files already present, so it is safe to re-run.

Commit and push that repo as you normally do, then wait for the green tick in its **Actions** tab.

### 3b. Netlify

Deploy the same folder you just pushed. The `_headers` file must stay at the root of what you deploy — without it the browser blocks the images and the mirror reports as failed in the app.

### 3c. Cloudflare Pages

Deploy the images and `manifest.json` only. Never the ZIP parts: Cloudflare rejects any file over 25 MB and the deployment fails. If you use `.assetsignore`, check it still has a `*.zip` line.

## Step 4 — Tell me when Pages is live

Once the GitHub Pages deployment has finished, say so. I will fetch the published `manifest.json`, verify it has 2575 entries, and write it into the project as `public/gpk-manifest.json` with the correct `zipParts` preserved. That is the piece that brings the app's file list up to date.

## Step 5 — Audit

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/audit-mirrors.mjs
```

Takes a few minutes. You want `verdict: COMPLETE` for all three mirrors, and the three ZIP parts listed as `OK` under the primary. If anything reports `GAPS (...)`, paste me the summary — the detailed lists are written to `scripts\mirror-output\audit-report\`.

## Step 6 — Live check in the app

1. Open the app → **Offline backup** panel.
2. Confirm three parts are listed at roughly 1.76 GB / 1.75 GB / 875 MB, about 4.37 GB total.
3. Download part 3 (the smallest) and import it.
4. Open a card whose image is in that part; confirm it renders and the source indicator shows the local copy.

## Technical notes

- `remoteMirror.ts` reads `zipParts` from `public/gpk-manifest.json` for the download list; `audit-mirrors.mjs` reads the same file for both the file list and the ZIP checks. One file drives both, which is why Steps 1 and 4 matter.
- Parts are capped at 1.76 GB because a single GitHub release asset cannot exceed 2 GB. Parts are imported individually — nothing needs rejoining by the end user.
- `missing=879` from the build is expected: those images are unavailable on every IPFS gateway. They are recorded as absent rather than dropped, so a later retry can pick them up without a full rebuild.
