# Merge the manifests, then build the final ZIPs

Confirmed from the manifest in `C:\Users\User\Desktop\gpk-zip-src`:

- `files`: **1545**
- `atomicImageCount`: **1547**
- `missing`: **0**
- `pending`: **0**

That manifest describes **AtomicAssets only**. It contains no entries for the 1030 SimpleAssets images that are also sitting in the staging folder. Building the ZIPs against it now would ship an archive whose manifest covers barely half its contents, and the offline loader and every mirror audit would treat the SimpleAssets images as unknown files.

`missing: 0` and `pending: 0` also mean nothing failed. Nothing needs to be re-downloaded.


## Step 1 — Identify which candidate manifest holds SimpleAssets

Three manifests exist:

```text
C:\Users\User\Desktop\gpkonwaxbackup-repo\manifest.json
C:\Users\User\Desktop\gpkonwaxbackup-repo\mirror\manifest.json
C:\Users\User\Desktop\gpk-app-latest2\mirror-output\manifests\manifest.json
```

Check each one. Run the two lines per folder, separately:

```bat
cd /d C:\Users\User\Desktop\gpkonwaxbackup-repo
```

```bat
node -p "Object.keys(require('./manifest.json').files||{}).length"
```

```bat
node -p "Object.keys(require('./manifest.json').files||{})[0]"
```

```bat
cd /d C:\Users\User\Desktop\gpkonwaxbackup-repo\mirror
```

```bat
node -p "Object.keys(require('./manifest.json').files||{}).length"
```

```bat
node -p "Object.keys(require('./manifest.json').files||{})[0]"
```

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2\mirror-output\manifests
```

```bat
node -p "Object.keys(require('./manifest.json').files||{}).length"
```

```bat
node -p "Object.keys(require('./manifest.json').files||{})[0]"
```

Send me all six results. The SimpleAssets manifest is the one whose sample key looks like a folder path such as `QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg`, and whose count is around 1030. A bare CID sample key means that file is an AtomicAssets manifest instead.

If more than one candidate qualifies, we use the one with the highest entry count.


## Step 2 — Count staged images by type

Still needed to reconcile 1545 manifest entries against the 1512 atomic JPG/GIF counted earlier; the difference is expected to be PNG or WebP files.

```bat
cd /d C:\Users\User\Desktop
```

```bat
dir /s /b gpk-zip-src\atomic\*.jpg gpk-zip-src\atomic\*.gif gpk-zip-src\atomic\*.png gpk-zip-src\atomic\*.webp | find /c /v ""
```

```bat
dir /s /b gpk-zip-src\*.jpg gpk-zip-src\*.gif gpk-zip-src\*.png gpk-zip-src\*.webp | find /c /v ""
```

Expected: atomic count **1545**, total count **2575**. Send both numbers.

## Step 3 — I add a manifest merge script

Once Step 1 identifies the SimpleAssets manifest, I will add `scripts/merge-manifests.mjs` to this project. It will:

- read two manifest files and produce a single combined `manifest.json`
- keep SimpleAssets keys as relative paths and AtomicAssets keys as CID lookup keys with their `path` field intact
- fail loudly if a key exists in both inputs with different SHA-256 values
- recompute `fileCount`, `missingCount`, and preserve `atomicSchemas` / `atomicImageCount`
- write the merged result to the staging folder as `manifest.json`, saving the previous file as `manifest.atomic.json`

You will then copy the script over the same way as before and run it with the two source paths.

## Step 4 — Verify the merged staging folder

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/verify-mirror.mjs C:\Users\User\Desktop\gpk-zip-src
```

Required result: no `MISSING` and no `CORRUPT`. `EXTRA` must be zero or only non-image files. Do not continue until this passes.

## Step 5 — Build the split ZIPs

Confirm `scripts\mirror-config.json` has:

```json
"outDir": "C:\\Users\\User\\Desktop\\gpk-zip-src"
```

Then:

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/build-image-mirror.mjs --zip-only --split-zip
```

Send me the part count, each part's byte size and SHA-256, and the total file count it reports. The total must match the Step 2 image count plus the manifest file.

## Step 6 — Publish and audit

1. Upload the new parts to the GitHub Release, deleting the old parts.
2. Copy the merged `manifest.json` and any newly present images to the GitHub Pages, Netlify, and Cloudflare mirror trees.
3. Keep ZIP files out of Cloudflare Pages because of its 25 MB per-file limit.
4. Run the audit:

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/audit-mirrors.mjs
```

All three mirrors must report `COMPLETE`.

5. Open **Offline backup** in the app, confirm the listed download size matches the new parts, and import one part as a test.

## Technical notes

- `build-image-mirror.mjs --zip-only` reads whatever is on disk under `outDir` and zips all of it, so the ZIP contents are correct today. Only the manifest is incomplete, which is why the merge must happen before zipping.
- `verify-mirror.mjs` resolves a manifest entry's `path` field when present, which is how AtomicAssets CID keys map onto `atomic/<cid>.<ext>` files. The merge must preserve that field exactly.
- The 2-entry gap between `atomicImageCount` 1547 and `files` 1545 comes from two discovered image references resolving to CIDs already saved under another key, so no image data is absent.
