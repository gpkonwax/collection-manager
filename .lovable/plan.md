# Merge the manifests, then build the final ZIPs

Composition of the staging manifest is now confirmed. I counted the pasted `findstr` output: **1545 of 1545 entries** have a `path` starting with `atomic/`. The `1548` from the second count was 1545 file hashes plus 3 ZIP-part hashes left over from an earlier split-ZIP run.

So `C:\Users\User\Desktop\gpk-zip-src\manifest.json` is **AtomicAssets-only** and contains zero SimpleAssets entries.

Manifest survey:

| Manifest | Entries | Reading |
| --- | --- | --- |
| `gpk-zip-src\manifest.json` | 1545 | AtomicAssets only — confirmed |
| `gpkonwaxbackup-repo\manifest.json` | 1030 | SimpleAssets — this is the merge input |
| `gpkonwaxbackup-repo\mirror\manifest.json` | 832 | stale partial set — ignore |
| `gpk-app-latest2\mirror-output\manifests\manifest.json` | 1545 | same AtomicAssets manifest — ignore |

Nothing failed during downloads (`missing: 0`, `pending: 0`), so no image needs re-fetching.

## Step 1 — Count staged images by type

Run each line separately:

```bat
cd /d C:\Users\User\Desktop
```

```bat
dir /s /b gpk-zip-src\atomic\*.jpg gpk-zip-src\atomic\*.gif gpk-zip-src\atomic\*.png gpk-zip-src\atomic\*.webp | find /c /v ""
```

```bat
dir /s /b gpk-zip-src\*.jpg gpk-zip-src\*.gif gpk-zip-src\*.png gpk-zip-src\*.webp | find /c /v ""
```

Send both numbers. Expected: **1545 atomic** and **2575 total** (1545 atomic plus 1030 SimpleAssets). The earlier 2542 figure omitted WebP files, which the manifest confirms exist.

Also delete the stale ZIP parts so they are not re-zipped into the new archive:

```bat
del /q C:\Users\User\Desktop\gpk-zip-src\gpk-image-mirror-part-*.zip
```

## Step 2 — Merge the two manifests

I will add `scripts/merge-manifests.mjs` to this project. It will:

- read the AtomicAssets manifest and the SimpleAssets manifest and write one combined `manifest.json`
- keep SimpleAssets keys as relative paths (no `path` field, file sits at the key) and AtomicAssets keys as CID lookup keys with their `path` field preserved exactly
- fail loudly if a key appears in both inputs with different SHA-256 values
- recompute `fileCount` and `missingCount`, preserve `atomicSchemas` and `atomicImageCount`, and drop the stale `zipParts` block
- back up the existing staging manifest as `manifest.atomic.json` before overwriting

Inputs:

- AtomicAssets: `C:\Users\User\Desktop\gpk-zip-src\manifest.json`
- SimpleAssets: `C:\Users\User\Desktop\gpkonwaxbackup-repo\manifest.json`

You copy the script over the same way as the previous scripts and run it. Expected merged total: **2575** entries.

## Step 3 — Verify the merged staging folder


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
