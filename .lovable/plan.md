# Finish the backup refresh — publish the new ZIPs, update the app, audit

The build worked. You now have three parts totalling 4.37 GB covering 2576 files (2575 images + `manifest.json`):

```text
gpk-image-mirror-part-001.zip   1.76 GB
gpk-image-mirror-part-002.zip   1.75 GB
gpk-image-mirror-part-003.zip   875.0 MB
```

`missing=879` is expected — those are the images that no IPFS gateway would serve, and we agreed to accept them.

Everything below is copy/paste. Do one step at a time and paste back what it prints. If anything differs from what is described, stop and send it to me instead of continuing.

## Step 8 — Send me the new manifest numbers first

Do this before uploading anything. The build rewrote `public\gpk-manifest.json` on your machine with the new part sizes and checksums. The app reads that file to know what to download, so it has to come back into the project — otherwise the app will still advertise the old ZIPs.

1. Press the Windows key, type `notepad`, press Enter.
2. **File → Open**, paste this into the file-name box and press Enter:

```text
C:\Users\User\Desktop\gpk-app-latest2\public\gpk-manifest.json
```

3. Press `Ctrl+End` to jump to the bottom of the file.
4. Near the bottom there is a block that starts with `"zipParts": [`. Select from `"zipParts": [` down to the closing `]` and copy it (`Ctrl+C`).
5. Paste it into the chat.

It will look roughly like this (yours will have real numbers):

```json
"zipParts": [
  { "fileName": "gpk-image-mirror-part-001.zip", "bytes": 1888888888, "sha256": "cfcd4b…", "files": 905 },
  …
]
```

I need the exact `bytes` values, which is why a screenshot or the human-readable "1.76 GB" is not enough. Once you paste it I will update the project's manifest so the app, the audit script, and the download panel all agree.

## Step 9 — Upload the ZIPs to the GitHub Release

1. In a browser, open the `gpkonwaxbackup` repository → **Releases** → open the release that currently holds the ZIP parts.
2. Click **Edit** (the pencil icon, top right of the release).
3. In the assets list, remove **every** old `gpk-image-mirror-part-*.zip` by clicking the small **x** next to each one. They must go — their checksums no longer match and leaving them causes silent corruption for anyone who downloads a mix.
4. Open `C:\Users\User\Desktop\gpk-zip-src` in File Explorer, select the three new `gpk-image-mirror-part-00*.zip` files, and drag them onto the release's upload box.
5. Wait for all three progress bars to reach 100%. This is 4.37 GB, so expect a long wait — leave the tab open and do not navigate away.
6. Click **Update release**.
7. Reload the release page and confirm exactly three assets are listed, with sizes 1.76 GB, 1.75 GB and 875 MB.

## Step 10 — Refresh the browsable mirrors

The three hosted mirrors serve individual images (not the ZIPs), and they also need the merged `manifest.json`.

### 10a. GitHub Pages (primary)

Copy the merged manifest and any new images into your local copy of the mirror repo:

```bat
copy /Y C:\Users\User\Desktop\gpk-zip-src\manifest.json C:\Users\User\Desktop\gpkonwaxbackup-repo\manifest.json
```

```bat
robocopy C:\Users\User\Desktop\gpk-zip-src C:\Users\User\Desktop\gpkonwaxbackup-repo /E /XF *.zip /XO
```

`/XF *.zip` keeps the huge ZIPs out of the repo — they belong only on the Release. `/XO` skips files that are already there and unchanged, so this is safe to re-run.

Then commit and push that repo the way you normally do, and wait for the Pages deployment to finish (green tick in the repo's Actions tab).

### 10b. Netlify

Deploy the same folder you just pushed. One thing must not be lost: the `_headers` file has to sit at the root of what you deploy, otherwise the browser blocks cross-origin image loads and the mirror shows as failed in the app.

### 10c. Cloudflare Pages

Deploy the images and `manifest.json` only. Do **not** include the ZIP parts — Cloudflare rejects any single file over 25 MB and the whole deployment will fail. If you use `.assetsignore`, confirm it still contains a `*.zip` line.

## Step 11 — Audit every mirror

Once all three deployments report complete:

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/audit-mirrors.mjs
```

This walks the manifest and checks each file on each mirror. It takes a few minutes and prints a summary at the end.

What you want to see for all three mirrors:

```text
verdict:      COMPLETE
```

If any mirror says `GAPS (...)`, the detailed lists land in `scripts\mirror-output\audit-report\` — paste me the summary block and I will tell you exactly what to re-upload where.

Note: the primary mirror also checks the three ZIP parts against the Release. If that part fails but the images pass, it usually means Step 8 has not been applied to the project manifest yet.

## Step 12 — Live check in the app

1. Open the app, go to the **Offline backup** panel.
2. Confirm it now lists three parts with the new sizes (1.76 GB / 1.75 GB / 875 MB) and a total of about 4.37 GB.
3. Download **part 3** (the smallest, 875 MB) and import it.
4. Open a card whose image is inside that part and confirm the image renders and the source indicator shows the local copy.

That is the end-to-end proof that the ZIPs, the manifest, and the app agree.

## Technical notes

- The only project-side change in all of this is replacing `public/gpk-manifest.json`'s `zipParts` block with the values from Step 8; the images themselves are hosted externally.
- `audit-mirrors.mjs` reads `public/gpk-manifest.json` and `public/atomic-manifest.json`, so the audit in Step 11 is only meaningful after the manifest update lands.
- Parts are capped at 1.76 GB because a single GitHub release asset cannot exceed 2 GB. The app's importer accepts parts individually — nothing needs to be rejoined by the end user.
- `missing=879` reflects images unavailable on every IPFS gateway; they are recorded in the manifest as absent rather than silently dropped, so a future retry can pick them up without a full rebuild.
