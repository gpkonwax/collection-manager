# Finish the backup: merge manifests, rebuild ZIPs, publish

Where things stand: the staging folder `C:\Users\User\Desktop\gpk-zip-src` holds every image — **2575** files (1545 AtomicAssets under `atomic\`, 1030 SimpleAssets in the CID folders). Nothing is left to download.

The only thing wrong is the bookkeeping file. `gpk-zip-src\manifest.json` lists **only** the 1545 AtomicAssets images. The 1030 SimpleAssets images sit on disk but are not listed, so any tool that trusts the manifest thinks they do not exist. The fix is to merge in the 1030 entries from `C:\Users\User\Desktop\gpkonwaxbackup-repo\manifest.json`, then rebuild the ZIPs and publish.

Every command below is short on purpose so Command Prompt cannot wrap it. Run one line at a time and paste back what it prints.

## Step 1 — Get the new merge script onto your PC

On approval I add `scripts/merge-manifests.mjs` to this project. To get it onto your machine:

1. In Lovable, open the GitHub / code download you normally use and refresh your local copy at `C:\Users\User\Desktop\gpk-app-latest2-new` — the same folder you have copied scripts from before.
2. Copy the one new file across:

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2\scripts
```

```bat
copy /Y ..\..\gpk-app-latest2-new\scripts\merge-manifests.mjs .
```

It should say `1 file(s) copied.`

## Step 2 — Run the merge

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/merge-manifests.mjs
```

The script has the two input paths built in, so there is nothing to type after the filename. It prints a summary like:

```text
atomic entries : 1545
simple entries : 1030
merged entries : 2575
backup written : gpk-zip-src\manifest.atomic.json
manifest written: gpk-zip-src\manifest.json
```

Paste the summary. If `merged entries` is not **2575**, stop there and send me the output — do not continue.

## Step 3 — Delete the old ZIP parts

The staging folder still contains ZIP parts from an earlier run. If they stay, they get zipped inside the new ZIP.

```bat
del /q C:\Users\User\Desktop\gpk-zip-src\gpk-image-mirror-part-*.zip
```

No output means it worked. Then confirm nothing is left:

```bat
dir /b C:\Users\User\Desktop\gpk-zip-src\*.zip
```

`File Not Found` is the result you want.

## Step 4 — Verify the staging folder

This re-hashes every file and checks it against the merged manifest.

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/verify-mirror.mjs C:\Users\User\Desktop\gpk-zip-src
```

It takes a few minutes on 2575 files. What you need to see: `missing 0` and `corrupt 0`. `extra` should be 0 as well — if it lists `manifest.atomic.json` that is fine and expected, since that is the backup copy the merge made. Do not go on until missing and corrupt are both zero.

## Step 5 — Build the new split ZIPs

First check the config points at the staging folder. Open `C:\Users\User\Desktop\gpk-app-latest2\scripts\mirror-config.json` in Notepad and confirm the `outDir` line reads:

```json
"outDir": "C:\\Users\\User\\Desktop\\gpk-zip-src",
```

Note the doubled backslashes — they are required. Save and close.

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/build-image-mirror.mjs --zip-only --split-zip
```

This writes parts of about 1.8 GB each. Paste the final lines: the number of parts, each part's size and SHA-256, and the total file count. The total file count should be **2576** (2575 images plus `manifest.json`).

## Step 6 — Publish

1. **GitHub Release** — go to the `gpkonwaxbackup` release that holds the ZIPs, delete the old part files, and upload the new parts from `C:\Users\User\Desktop\gpk-zip-src`.
2. **GitHub Pages mirror** — copy the merged `manifest.json` into the `gpkonwaxbackup-repo` root (over the old 1030-entry one), plus any images that are in staging but not in the repo, then commit and push.
3. **Netlify** — deploy the same tree. Keep the existing `_headers` file at the root; without it CORS breaks.
4. **Cloudflare Pages** — deploy images and manifest only. Do **not** upload ZIPs there; Cloudflare rejects files over 25 MB.

## Step 7 — Audit

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/audit-mirrors.mjs
```

All three mirrors must report `COMPLETE`. Then open **Offline backup** in the app, check the listed download size matches the new parts, and import one part as a live test.

## Technical notes

- `merge-manifests.mjs` keeps SimpleAssets keys as relative paths (the file lives at the key) and AtomicAssets keys as CID lookup keys with their `path` field untouched — `verify-mirror.mjs` resolves `path` when present, which is how `atomic/<cid>.<ext>` files are found. It aborts if the same key appears in both inputs with different SHA-256 values, recomputes `fileCount` and `missingCount`, preserves `atomicSchemas` and `atomicImageCount`, and drops the stale `zipParts` block left over from the previous split run.
- `build-image-mirror.mjs --zip-only` zips whatever is on disk under `outDir`, so the ZIP contents were already correct; only the manifest inside it was wrong. That is why the merge must happen before zipping.
- `atomicImageCount` reads 1547 while 1545 files are stored: two discovered references resolve to CIDs already saved under another key, so no image data is absent.
