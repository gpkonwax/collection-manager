# Finish the backup from the confirmed 2542 JPG/GIF count

The atomic top-up has already been completed and the JPG/GIF count remained **2542**. Do not run the download again.

The AtomicAssets builder can save images as **JPG, GIF, PNG, or WebP**. The previous count only included JPG and GIF, so it does not prove that 35 images are missing.

## Step 1 — Count every supported image type

Run from Desktop:

```bat
cd /d C:\Users\User\Desktop
```

```bat
dir /s /b gpk-zip-src\*.jpg gpk-zip-src\*.gif gpk-zip-src\*.png gpk-zip-src\*.webp | find /c /v ""
```

Then count only AtomicAssets images:

```bat
dir /s /b gpk-zip-src\atomic\*.jpg gpk-zip-src\atomic\*.gif gpk-zip-src\atomic\*.png gpk-zip-src\atomic\*.webp | find /c /v ""
```

Send me both numbers before continuing.

Expected results:

- **2577 total** and **1547 atomic**: the backup is complete; the apparent 35-file gap was PNG/WebP images.
- **2542 total** and **1512 atomic**: the 35 are genuinely absent or marked unavailable; inspect the manifest in Step 2.
- Any other result: stop and send both numbers so we can account for the exact difference.

## Step 2 — Inspect the manifest produced by the completed atomic run

First confirm where the manifest exists:

```bat
dir /s /b C:\Users\User\Desktop\gpk-zip-src\manifest.json C:\Users\User\Desktop\gpk-app-latest2\mirror-output\manifest.json
```

If `gpk-zip-src\manifest.json` is listed, print its totals:

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
node -e "const m=require('C:/Users/User/Desktop/gpk-zip-src/manifest.json'); console.log({files:Object.keys(m.files||{}).length,atomicImageCount:m.atomicImageCount,missing:(m.missing||[]).length,pending:Object.keys(m.errorCounts||{}).length})"
```

Interpretation:

- `atomicImageCount: 1547`, `files: 1547`, and `missing: 0` confirms all AtomicAssets images are represented.
- `missing: 35` confirms the script explicitly classified those 35 CIDs as unavailable after trying every configured gateway. In that case, **2542 is acceptable** and no further retry is needed.
- A nonzero `pending` count means the run did not finish cleanly; stop and send the totals.

## Step 3 — Verify the correct folder

The earlier verifier failed only because no folder argument was supplied, so it defaulted to `gpk-app-latest2\mirror-output`.

If `gpk-zip-src\manifest.json` exists, verify the staging folder directly:

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
node scripts/verify-mirror.mjs C:\Users\User\Desktop\gpk-zip-src
```

The result must have no `MISSING` or `CORRUPT` entries. `EXTRA` entries can indicate that the manifest contains only the AtomicAssets portion while the staging folder also contains SimpleAssets; do not build ZIPs until the manifest coverage is confirmed.

## Step 4 — Confirm manifest coverage before building

Compare the staged image count from Step 1 with the manifest `files` count from Step 2.

- If they match, proceed.
- If the manifest has **1547** entries but the folder has **2577** images, it covers AtomicAssets only. Stop and send the numbers; the SimpleAssets and AtomicAssets manifests must be merged before ZIP creation.
- If 35 images were explicitly unavailable, the final manifest should list those under `missing` and contain the remaining available files.

## Step 5 — Build the split ZIPs

Only after Steps 1–4 confirm the staging images and manifest agree, ensure `scripts\mirror-config.json` contains:

```json
"outDir": "C:\\Users\\User\\Desktop\\gpk-zip-src"
```

Then run:

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
node scripts/build-image-mirror.mjs --zip-only --split-zip
```

Record the number of ZIP parts, each byte size, each SHA-256, and the reported total file count.

## Step 6 — Publish and audit

1. Replace the old GitHub Release ZIP parts with the newly generated parts.
2. Copy the canonical `manifest.json` and any newly recovered images to the GitHub Pages, Netlify, and Cloudflare mirror trees.
3. Keep ZIP files out of the Cloudflare Pages deployment because of its 25 MB per-file limit.
4. Run:

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
node scripts/audit-mirrors.mjs
```

All three mirrors must report `COMPLETE`.

5. Open **Offline backup** in the app, confirm the combined download size matches the new ZIP parts, and test importing one part.
6. Send me the final part names and byte sizes so the app's hardcoded ZIP fallback metadata can be updated.