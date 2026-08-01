# Merge the manifests, then build the final ZIPs
# Confirm manifest composition, then build the final ZIPs

Manifest survey results:

| Manifest | Entries | First key | Reading |
| --- | --- | --- | --- |
| `gpk-zip-src\manifest.json` | 1545 | (not sampled) | staging manifest, composition unknown |
| `gpkonwaxbackup-repo\manifest.json` | 1030 | `QmSRti.../base/2a.jpg` | SimpleAssets only |
| `gpkonwaxbackup-repo\mirror\manifest.json` | 832 | `QmSRti.../prism/1a.gif` | older partial SimpleAssets set, ignore |
| `gpk-app-latest2\mirror-output\manifests\manifest.json` | 1545 | `QmSRti.../back/1.jpg` | starts with a SimpleAssets key |

The last row matters: a 1545-entry manifest whose first key is a SimpleAssets path means 1545 is **not** necessarily an AtomicAssets-only count. The staging manifest may already be a combined SimpleAssets + AtomicAssets manifest, in which case no merge is needed at all.

Nothing failed in the download runs (`missing: 0`, `pending: 0`), so no image needs re-fetching regardless.

## Step 1 — Measure the composition of the staging manifest

```bat
cd /d C:\Users\User\Desktop\gpk-zip-src
```

Run each line separately:

```bat
node -p "Object.values(require('./manifest.json').files).filter(v=>v.path&&v.path.indexOf('atomic/')===0).length"
```

```bat
node -p "Object.values(require('./manifest.json').files).filter(v=>!v.path||v.path.indexOf('atomic/')!==0).length"
```

Send both numbers: **atomic entries** and **non-atomic entries**.

Interpretation:

- Around **1545 atomic / 0 non-atomic**: the staging manifest is AtomicAssets only and the 1030 SimpleAssets entries must be merged in (Step 3).
- Around **515 atomic / 1030 non-atomic**: the manifest is already combined and correct. Skip Step 3 and go straight to Step 4. In that case the earlier "1547 atomic images" figure refers to discovered references, not stored files, and we reconcile it against the on-disk counts in Step 2.
- Anything else: send the numbers and stop.

## Step 2 — Count staged images by type

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

Send both numbers. The total on-disk image count must equal the staging manifest's entry count once Step 1 and Step 3 are settled; any gap is what we chase next.

## Step 3 — Merge, only if Step 1 shows the manifest is AtomicAssets-only

I will add `scripts/merge-manifests.mjs` to this project. It will:

- read two manifest files and write a single combined `manifest.json`
- keep SimpleAssets keys as relative paths and AtomicAssets keys as CID lookup keys with their `path` field intact
- fail loudly if a key appears in both inputs with different SHA-256 values
- recompute `fileCount` and `missingCount`, and preserve `atomicSchemas` and `atomicImageCount`
- back up the existing staging manifest as `manifest.atomic.json` before overwriting

The SimpleAssets input will be `C:\Users\User\Desktop\gpkonwaxbackup-repo\manifest.json` (1030 entries). The 832-entry manifest under `mirror\` is a stale subset and will not be used.



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
